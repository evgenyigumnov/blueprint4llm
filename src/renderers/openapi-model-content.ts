import type {
  ApiMediaType,
  ApiParameter,
  ApiRequestBody,
  ApiResponse,
  OpenApiObject,
  OpenApiValue,
} from './openapi-types.js';
import type { OpenApiModelContext } from './openapi-model-context.js';
import {
  openApiSchemaContext,
  throwIfOpenApiAborted,
  warnUnshownFields,
} from './openapi-model-context.js';
import { parseOpenApiSchema } from './openapi-schema.js';
import {
  asObject,
  childPointer,
  openApiError,
  optionalBoolean,
  optionalObject,
  optionalString,
  requiredString,
} from './openapi-value.js';

const HTTP_STATUS = /^[1-5]\d\d$/u;
const RESPONSE_RANGE = /^[1-5]XX$/u;

export function parseOpenApiRequestBody(
  value: OpenApiValue,
  pointer: string,
  context: OpenApiModelContext,
): ApiRequestBody {
  const resolved = context.resolver.resolveObject(value, pointer, 'request body');
  const required =
    optionalBoolean(resolved.value, 'required', resolved.pointer, context.source) ?? false;
  const description = optionalString(
    resolved.value,
    'description',
    resolved.pointer,
    context.source,
  );
  const contentValue = resolved.value.get('content');
  if (contentValue === undefined) {
    throw openApiError(
      'Request Body Object requires "content"',
      childPointer(resolved.pointer, 'content'),
      context.source,
    );
  }
  const content = parseOpenApiMediaTypes(
    contentValue,
    childPointer(resolved.pointer, 'content'),
    context,
  );
  warnUnshownFields(
    resolved.value,
    resolved.pointer,
    new Set(['required', 'description', 'content']),
    context,
  );
  return {
    required,
    ...(description === undefined ? {} : { description }),
    pointer: resolved.pointer,
    content,
  };
}

export function parseOpenApiResponses(
  value: OpenApiValue,
  pointer: string,
  context: OpenApiModelContext,
): ApiResponse[] {
  const responseEntries = [...asObject(value, pointer, context.source, 'responses').entries()];
  const responses: ApiResponse[] = [];
  for (const [status, responseValue] of responseEntries) {
    throwIfOpenApiAborted(context.signal);
    if (status !== 'default' && !HTTP_STATUS.test(status) && !RESPONSE_RANGE.test(status)) {
      throw openApiError(
        `invalid response code: ${status}`,
        childPointer(pointer, status),
        context.source,
      );
    }
    const responsePointer = childPointer(pointer, status);
    const resolved = context.resolver.resolveObject(responseValue, responsePointer, 'response');
    const description = requiredString(
      resolved.value,
      'description',
      resolved.pointer,
      context.source,
    );
    const contentValue = resolved.value.get('content');
    const content =
      contentValue === undefined
        ? []
        : parseOpenApiMediaTypes(contentValue, childPointer(resolved.pointer, 'content'), context);
    const headers = parseResponseHeaders(resolved.value, resolved.pointer, context);
    warnUnshownFields(
      resolved.value,
      resolved.pointer,
      new Set(['description', 'headers', 'content']),
      context,
    );
    responses.push({ status, description, pointer: resolved.pointer, content, headers });
  }
  return responses;
}

function parseResponseHeaders(
  response: OpenApiObject,
  pointer: string,
  context: OpenApiModelContext,
): ApiParameter[] {
  const headers = optionalObject(response, 'headers', pointer, context.source);
  if (headers === undefined) return [];
  const result: ApiParameter[] = [];
  for (const [name, headerValue] of headers) {
    const headerPointer = childPointer(childPointer(pointer, 'headers'), name);
    const resolved = context.resolver.resolveObject(headerValue, headerPointer, 'header');
    const schemaValue = resolved.value.get('schema');
    const contentValue = resolved.value.get('content');
    if (schemaValue !== undefined && contentValue !== undefined) {
      throw openApiError(
        'Header Object must use either "schema" or "content"',
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
    const description = optionalString(
      resolved.value,
      'description',
      resolved.pointer,
      context.source,
    );
    result.push({
      name,
      in: 'header',
      required:
        optionalBoolean(resolved.value, 'required', resolved.pointer, context.source) ?? false,
      ...(description === undefined ? {} : { description }),
      pointer: resolved.pointer,
      ...(schema === undefined ? {} : { schema }),
      content,
    });
    warnUnshownFields(
      resolved.value,
      resolved.pointer,
      new Set(['description', 'required', 'schema', 'content']),
      context,
    );
  }
  return result;
}

export function parseOpenApiMediaTypes(
  value: OpenApiValue,
  pointer: string,
  context: OpenApiModelContext,
): ApiMediaType[] {
  const entries = [...asObject(value, pointer, context.source, 'content').entries()];
  return entries.map(([mediaType, mediaValue]) => {
    const mediaPointer = childPointer(pointer, mediaType);
    const media = asObject(mediaValue, mediaPointer, context.source, 'Media Type Object');
    const schemaValue = media.get('schema');
    const schema =
      schemaValue === undefined
        ? undefined
        : parseOpenApiSchema(
            schemaValue,
            childPointer(mediaPointer, 'schema'),
            openApiSchemaContext(context),
          );
    warnUnshownFields(media, mediaPointer, new Set(['schema']), context);
    return { mediaType, pointer: mediaPointer, ...(schema === undefined ? {} : { schema }) };
  });
}
