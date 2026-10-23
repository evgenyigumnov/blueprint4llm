import type {
  ApiSchema,
  ApiSchemaComposition,
  ApiSchemaProperty,
  OpenApiObject,
  OpenApiSource,
  OpenApiValue,
} from './openapi-types.js';
import { OpenApiReferenceResolver } from './openapi-refs.js';
import {
  childPointer,
  openApiError,
  optionalBoolean,
  optionalString,
  stringArray,
} from './openapi-value.js';

export const OPENAPI_SCHEMA_DIALECT = 'https://spec.openapis.org/oas/3.1/dialect/base';

const SCHEMA_TYPES = new Set(['null', 'boolean', 'object', 'array', 'number', 'integer', 'string']);
const DISPLAYED_SCHEMA_FIELDS = new Set([
  '$ref',
  '$schema',
  'type',
  'format',
  'description',
  'required',
  'properties',
  'items',
  'additionalProperties',
  'enum',
  'allOf',
  'oneOf',
  'anyOf',
  'readOnly',
  'writeOnly',
]);
const UNSUPPORTED_ID_FIELDS = new Set(['$id', '$anchor', '$dynamicRef', '$dynamicAnchor']);
const COMPOSITION_FIELDS = ['allOf', 'oneOf', 'anyOf'] as const;

export interface OpenApiSchemaContext {
  source: OpenApiSource;
  resolver: OpenApiReferenceResolver;
  warn(message: string, summary: string, pointer: string): void;
  signal?: AbortSignal;
}

/** Parses the schema subset shown by the static API summary and keeps reference edges intact. */
export function parseOpenApiSchema(
  value: OpenApiValue | undefined,
  pointer: string,
  context: OpenApiSchemaContext,
): ApiSchema {
  throwIfAborted(context.signal);
  if (typeof value === 'boolean') return emptySchema(pointer, value);
  if (!(value instanceof Map)) {
    throw openApiError('Schema Object must be an object or boolean', pointer, context.source);
  }

  assertDialect(value, pointer, context.source);
  assertUnsupportedIdentifiers(value, pointer, context.source);
  const type = parseSchemaType(value.get('type'), childPointer(pointer, 'type'), context.source);
  const format = optionalString(value, 'format', pointer, context.source);
  const description = optionalString(value, 'description', pointer, context.source);
  const required = stringArray(value, 'required', pointer, context.source);
  const properties = parseProperties(value, pointer, context);
  const items = value.has('items')
    ? parseOpenApiSchema(value.get('items'), childPointer(pointer, 'items'), context)
    : undefined;
  const additionalProperties = parseAdditionalProperties(value, pointer, context);
  const enumValues = parseEnum(value, pointer, context.source);
  const compositions = parseCompositions(value, pointer, context);
  const readOnly = optionalBoolean(value, 'readOnly', pointer, context.source) ?? false;
  const writeOnly = optionalBoolean(value, 'writeOnly', pointer, context.source) ?? false;
  const ref = parseSchemaReference(value, pointer, context);

  for (const key of value.keys()) {
    if (!DISPLAYED_SCHEMA_FIELDS.has(key)) {
      context.warn(
        `schema keyword "${key}" is not shown at ${childPointer(pointer, key)}`,
        `schema keyword ${key}`,
        childPointer(pointer, key),
      );
    }
  }

  return {
    pointer,
    ...(type === undefined ? {} : { type }),
    ...(format === undefined ? {} : { format }),
    ...(description === undefined ? {} : { description }),
    required,
    properties,
    ...(items === undefined ? {} : { items }),
    ...(additionalProperties === undefined ? {} : { additionalProperties }),
    ...(enumValues === undefined ? {} : { enum: enumValues }),
    compositions,
    readOnly,
    writeOnly,
    ...(ref === undefined ? {} : { ref }),
  };
}

function emptySchema(pointer: string, booleanSchema: boolean): ApiSchema {
  return {
    pointer,
    booleanSchema,
    required: [],
    properties: [],
    compositions: [],
    readOnly: false,
    writeOnly: false,
  };
}

function assertDialect(object: OpenApiObject, pointer: string, source: OpenApiSource): void {
  const dialect = object.get('$schema');
  if (dialect !== undefined && dialect !== OPENAPI_SCHEMA_DIALECT) {
    throw openApiError(
      `unsupported JSON Schema dialect: ${String(dialect)}; supported: ${OPENAPI_SCHEMA_DIALECT}`,
      childPointer(pointer, '$schema'),
      source,
    );
  }
}

function assertUnsupportedIdentifiers(
  object: OpenApiObject,
  pointer: string,
  source: OpenApiSource,
): void {
  for (const field of UNSUPPORTED_ID_FIELDS) {
    if (object.has(field)) {
      throw openApiError(
        `JSON Schema keyword "${field}" is not supported`,
        childPointer(pointer, field),
        source,
      );
    }
  }
}

function parseSchemaType(
  value: OpenApiValue | undefined,
  pointer: string,
  source: OpenApiSource,
): string | string[] | undefined {
  if (value === undefined) return undefined;
  const types = Array.isArray(value) ? value : [value];
  if (
    types.length === 0 ||
    types.some((item) => typeof item !== 'string' || !SCHEMA_TYPES.has(item))
  ) {
    throw openApiError(
      'schema "type" must be a JSON Schema type or an array of types',
      pointer,
      source,
    );
  }
  return Array.isArray(value) ? (types as string[]) : (types[0] as string);
}

function parseProperties(
  object: OpenApiObject,
  pointer: string,
  context: OpenApiSchemaContext,
): ApiSchemaProperty[] {
  const propertiesValue = object.get('properties');
  if (propertiesValue === undefined) return [];
  if (!(propertiesValue instanceof Map)) {
    throw openApiError(
      'schema "properties" must be an object',
      childPointer(pointer, 'properties'),
      context.source,
    );
  }
  const properties: ApiSchemaProperty[] = [];
  for (const [name, value] of propertiesValue) {
    const propertyPointer = childPointer(childPointer(pointer, 'properties'), name);
    properties.push({
      name,
      pointer: propertyPointer,
      schema: parseOpenApiSchema(value, propertyPointer, context),
    });
  }
  return properties;
}

function parseAdditionalProperties(
  object: OpenApiObject,
  pointer: string,
  context: OpenApiSchemaContext,
): boolean | ApiSchema | undefined {
  const value = object.get('additionalProperties');
  if (value === undefined) return undefined;
  const fieldPointer = childPointer(pointer, 'additionalProperties');
  if (typeof value === 'boolean') return value;
  return parseOpenApiSchema(value, fieldPointer, context);
}

function parseEnum(
  object: OpenApiObject,
  pointer: string,
  source: OpenApiSource,
): OpenApiValue[] | undefined {
  const value = object.get('enum');
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw openApiError('schema "enum" must be an array', childPointer(pointer, 'enum'), source);
  }
  return value;
}

function parseCompositions(
  object: OpenApiObject,
  pointer: string,
  context: OpenApiSchemaContext,
): ApiSchemaComposition[] {
  const compositions: ApiSchemaComposition[] = [];
  for (const kind of COMPOSITION_FIELDS) {
    const value = object.get(kind);
    if (value === undefined) continue;
    if (!Array.isArray(value)) {
      throw openApiError(
        `schema "${kind}" must be an array`,
        childPointer(pointer, kind),
        context.source,
      );
    }
    compositions.push({
      kind,
      schemas: value.map((schema, index) =>
        parseOpenApiSchema(
          schema,
          childPointer(childPointer(pointer, kind), String(index)),
          context,
        ),
      ),
    });
  }
  return compositions;
}

function parseSchemaReference(
  object: OpenApiObject,
  pointer: string,
  context: OpenApiSchemaContext,
): ApiSchema['ref'] {
  const value = object.get('$ref');
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw openApiError('$ref must be a string', childPointer(pointer, '$ref'), context.source);
  }
  const target = context.resolver.resolve(value, childPointer(pointer, '$ref'), 'schema');
  const targetName = schemaNameAtPointer(target.pointer);
  return {
    reference: value,
    targetPointer: target.pointer,
    ...(targetName === undefined ? {} : { targetName }),
  };
}

function schemaNameAtPointer(pointer: string): string | undefined {
  const prefix = '#/components/schemas/';
  if (!pointer.startsWith(prefix)) return undefined;
  const finalSegment = pointer.slice(prefix.length).split('/')[0];
  return finalSegment?.replace(/~1/gu, '/').replace(/~0/gu, '~');
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new Error('OpenAPI rendering was aborted');
  }
}
