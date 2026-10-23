import type {
  ApiDocument,
  ApiOperation,
  ApiParameter,
  OpenApiObject,
  OpenApiSource,
  OpenApiValue,
} from './openapi-types.js';
import { OpenApiReferenceResolver } from './openapi-refs.js';
import {
  addWarning,
  openApiSchemaContext,
  pushOpenApiWarning,
  throwIfOpenApiAborted,
  warnUnshownFields,
  type OpenApiModelContext,
} from './openapi-model-context.js';
import {
  parseOpenApiMediaTypes,
  parseOpenApiRequestBody,
  parseOpenApiResponses,
} from './openapi-model-content.js';
import { OPENAPI_SCHEMA_DIALECT, parseOpenApiSchema } from './openapi-schema.js';
import {
  asObject,
  childPointer,
  openApiError,
  optionalBoolean,
  optionalObject,
  optionalString,
  requiredString,
  stringArray,
} from './openapi-value.js';

export const MAX_OPENAPI_OPERATIONS = 200;
export const MAX_OPENAPI_NAMED_SCHEMAS = 500;

const METHODS = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);
const PARAMETER_LOCATIONS = new Set(['path', 'query', 'header', 'cookie']);
/** Builds the renderer model and validates every field that it presents. */
export function buildOpenApiModel(source: OpenApiSource, signal?: AbortSignal): ApiDocument {
  throwIfOpenApiAborted(signal);
  const root = asObject(source.value, '#', source, 'OpenAPI document');
  const info = asObject(root.get('info'), '#/info', source, 'field "info"');
  const title = requiredString(info, 'title', '#/info', source);
  const version = requiredString(info, 'version', '#/info', source);
  const description = optionalString(info, 'description', '#/info', source);
  validateRootDialect(root, source);

  const paths = optionalObject(root, 'paths', '#', source);
  const components = optionalObject(root, 'components', '#', source);
  if (paths === undefined && components === undefined) {
    throw openApiError('OpenAPI document must contain "paths" or "components"', '#', source);
  }

  const warnings: ApiDocument['warnings'] = [];
  const resolver = new OpenApiReferenceResolver(source, {
    ...(signal === undefined ? {} : { signal }),
    warn: (message, summary, pointer) =>
      pushOpenApiWarning(warnings, source, message, summary, pointer),
  });
  const context: OpenApiModelContext = {
    source,
    warnings,
    resolver,
    ...(signal === undefined ? {} : { signal }),
  };
  const schemas = parseNamedSchemas(components, context);
  const operations = parsePaths(paths, context);
  warnUnusedComponentDefinitions(components, resolver, context);
  warnUnshownFields(info, '#/info', new Set(['title', 'version', 'description']), context);
  warnUnshownFields(
    root,
    '#',
    new Set(['openapi', 'info', 'paths', 'components', 'jsonSchemaDialect']),
    context,
  );
  return {
    title,
    version,
    positions: source.positions,
    ...(description === undefined ? {} : { description }),
    operations,
    schemas,
    warnings,
  };
}

function validateRootDialect(root: OpenApiObject, source: OpenApiSource): void {
  const dialect = root.get('jsonSchemaDialect');
  if (dialect !== undefined && dialect !== OPENAPI_SCHEMA_DIALECT) {
    throw openApiError(
      `unsupported JSON Schema dialect: ${String(dialect)}; supported: ${OPENAPI_SCHEMA_DIALECT}`,
      '#/jsonSchemaDialect',
      source,
    );
  }
}

function parseNamedSchemas(
  components: OpenApiObject | undefined,
  context: OpenApiModelContext,
): ApiDocument['schemas'] {
  if (components === undefined) return [];
  const componentSchemas = optionalObject(components, 'schemas', '#/components', context.source);
  if (componentSchemas === undefined) return [];
  if (componentSchemas.size > MAX_OPENAPI_NAMED_SCHEMAS) {
    throw openApiError(
      `OpenAPI named schema limit exceeded: ${componentSchemas.size} (limit ${MAX_OPENAPI_NAMED_SCHEMAS})`,
      '#/components/schemas',
      context.source,
    );
  }
  const schemas: ApiDocument['schemas'] = [];
  for (const [name, value] of componentSchemas) {
    throwIfOpenApiAborted(context.signal);
    const pointer = childPointer('#/components/schemas', name);
    schemas.push({
      name,
      pointer,
      schema: parseOpenApiSchema(value, pointer, openApiSchemaContext(context)),
    });
  }
  warnUnshownFields(
    components,
    '#/components',
    new Set(['schemas', 'parameters', 'requestBodies', 'responses', 'headers', 'pathItems']),
    context,
  );
  return schemas;
}

function parsePaths(
  paths: OpenApiObject | undefined,
  context: OpenApiModelContext,
): ApiOperation[] {
  if (paths === undefined) return [];
  const operations: ApiOperation[] = [];
  for (const [path, pathItemValue] of paths) {
    throwIfOpenApiAborted(context.signal);
    const pathPointer = childPointer('#/paths', path);
    if (!path.startsWith('/'))
      throw openApiError('path keys must start with "/"', pathPointer, context.source);
    const pathItem = context.resolver.resolveObject(pathItemValue, pathPointer, 'path item');
    const commonParameters = parseParameters(
      pathItem.value.get('parameters'),
      pathItem.fieldPointers.get('parameters') ?? childPointer(pathItem.pointer, 'parameters'),
      context,
      'path',
    );
    for (const [method, value] of pathItem.value) {
      if (!METHODS.has(method)) continue;
      throwIfOpenApiAborted(context.signal);
      if (!(value instanceof Map)) {
        throw openApiError(
          'Operation Object must be an object',
          childPointer(pathItem.pointer, method),
          context.source,
        );
      }
      operations.push(
        parseOperation(
          method,
          path,
          value,
          childPointer(pathItem.pointer, method),
          commonParameters,
          context,
        ),
      );
      if (operations.length > MAX_OPENAPI_OPERATIONS) {
        throw openApiError(
          `OpenAPI operation limit exceeded: ${operations.length} (limit ${MAX_OPENAPI_OPERATIONS})`,
          childPointer(pathItem.pointer, method),
          context.source,
        );
      }
    }
    warnUnshownFields(
      pathItem.value,
      pathItem.pointer,
      new Set([...METHODS, '$ref', 'parameters']),
      context,
    );
  }
  return operations;
}

function parseOperation(
  method: string,
  path: string,
  operation: OpenApiObject,
  pointer: string,
  commonParameters: ApiParameter[],
  context: OpenApiModelContext,
): ApiOperation {
  const operationParameters = parseParameters(
    operation.get('parameters'),
    childPointer(pointer, 'parameters'),
    context,
    'operation',
  );
  const parameters = mergeParameters(
    commonParameters,
    operationParameters,
    pointer,
    context.source,
  );
  const requestBodyValue = operation.get('requestBody');
  const requestBody =
    requestBodyValue === undefined
      ? undefined
      : parseOpenApiRequestBody(requestBodyValue, childPointer(pointer, 'requestBody'), context);
  const responsesValue = operation.get('responses');
  if (responsesValue === undefined) {
    throw openApiError(
      'Operation Object requires "responses"',
      childPointer(pointer, 'responses'),
      context.source,
    );
  }
  const responses = parseOpenApiResponses(
    responsesValue,
    childPointer(pointer, 'responses'),
    context,
  );
  if (responses.length === 0) {
    throw openApiError(
      'Operation Object must define at least one response',
      childPointer(pointer, 'responses'),
      context.source,
    );
  }
  const tags = stringArray(operation, 'tags', pointer, context.source);
  const summary = optionalString(operation, 'summary', pointer, context.source);
  const description = optionalString(operation, 'description', pointer, context.source);
  const operationId = optionalString(operation, 'operationId', pointer, context.source);
  const deprecated = optionalBoolean(operation, 'deprecated', pointer, context.source) ?? false;
  warnUnshownFields(
    operation,
    pointer,
    new Set([
      'summary',
      'description',
      'operationId',
      'tags',
      'deprecated',
      'parameters',
      'requestBody',
      'responses',
    ]),
    context,
  );
  return {
    method: method.toUpperCase(),
    path,
    pointer,
    ...(summary === undefined ? {} : { summary }),
    ...(description === undefined ? {} : { description }),
    ...(operationId === undefined ? {} : { operationId }),
    tags,
    deprecated,
    parameters,
    ...(requestBody === undefined ? {} : { requestBody }),
    responses,
  };
}

function parseParameters(
  value: OpenApiValue | undefined,
  pointer: string,
  context: OpenApiModelContext,
  level: string,
): ApiParameter[] {
  if (value === undefined) return [];
  if (!Array.isArray(value))
    throw openApiError('parameters must be an array', pointer, context.source);
  const parameters: ApiParameter[] = [];
  const seen = new Set<string>();
  for (const [index, item] of value.entries()) {
    throwIfOpenApiAborted(context.signal);
    const itemPointer = childPointer(pointer, String(index));
    const resolved = context.resolver.resolveObject(item, itemPointer, 'parameter');
    const name = requiredString(resolved.value, 'name', resolved.pointer, context.source);
    const location = requiredString(resolved.value, 'in', resolved.pointer, context.source);
    if (!PARAMETER_LOCATIONS.has(location)) {
      throw openApiError(
        `unsupported parameter location: ${location}`,
        resolved.fieldPointers.get('in') ?? childPointer(resolved.pointer, 'in'),
        context.source,
      );
    }
    const required =
      optionalBoolean(resolved.value, 'required', resolved.pointer, context.source) ?? false;
    if (location === 'path' && !required) {
      throw openApiError(
        'path parameters must set "required: true"',
        resolved.fieldPointers.get('required') ?? childPointer(resolved.pointer, 'required'),
        context.source,
      );
    }
    const schemaValue = resolved.value.get('schema');
    const contentValue = resolved.value.get('content');
    if (schemaValue !== undefined && contentValue !== undefined) {
      throw openApiError(
        'parameter must use either "schema" or "content"',
        resolved.pointer,
        context.source,
      );
    }
    if (schemaValue === undefined && contentValue === undefined) {
      throw openApiError(
        'parameter requires "schema" or "content"',
        resolved.pointer,
        context.source,
      );
    }
    const schema =
      schemaValue === undefined
        ? undefined
        : parseOpenApiSchema(
            schemaValue,
            childPointer(resolved.pointer, 'schema'),
            openApiSchemaContext(context),
          );
    const content =
      contentValue === undefined
        ? []
        : parseOpenApiMediaTypes(contentValue, childPointer(resolved.pointer, 'content'), context);
    const parameterDescription = optionalString(
      resolved.value,
      'description',
      resolved.pointer,
      context.source,
    );
    const parameter: ApiParameter = {
      name,
      in: location,
      required,
      pointer: resolved.pointer,
      ...(parameterDescription === undefined ? {} : { description: parameterDescription }),
      ...(schema === undefined ? {} : { schema }),
      content,
    };
    const key = `${location}\0${name}`;
    if (seen.has(key))
      throw openApiError(
        `duplicate ${level} parameter: (${location}, ${name})`,
        itemPointer,
        context.source,
      );
    seen.add(key);
    warnUnshownFields(
      resolved.value,
      resolved.pointer,
      new Set(['name', 'in', 'required', 'description', 'schema', 'content']),
      context,
    );
    parameters.push(parameter);
  }
  return parameters;
}

function mergeParameters(
  common: ApiParameter[],
  operation: ApiParameter[],
  pointer: string,
  source: OpenApiSource,
): ApiParameter[] {
  const merged = [...common];
  for (const parameter of operation) {
    const index = merged.findIndex(
      (existing) => existing.in === parameter.in && existing.name === parameter.name,
    );
    if (index < 0) merged.push(parameter);
    else merged[index] = parameter;
  }
  if (merged.some((parameter) => !parameter)) {
    throw openApiError('could not merge parameters', pointer, source);
  }
  return merged;
}

function warnUnusedComponentDefinitions(
  components: OpenApiObject | undefined,
  resolver: OpenApiReferenceResolver,
  context: OpenApiModelContext,
): void {
  if (components === undefined) return;
  for (const group of ['parameters', 'requestBodies', 'responses', 'headers', 'pathItems']) {
    const definitions = optionalObject(components, group, '#/components', context.source);
    if (definitions === undefined) continue;
    for (const name of definitions.keys()) {
      const pointer = childPointer(childPointer('#/components', group), name);
      if (!resolver.referencedPointers.has(pointer)) {
        addWarning(
          context,
          `unused component ${group} "${name}" is not shown at ${pointer}`,
          `unused ${group}`,
          pointer,
        );
      }
    }
  }
}
