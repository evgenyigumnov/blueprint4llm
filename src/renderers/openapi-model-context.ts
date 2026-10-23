import type { ApiDocument, OpenApiObject, OpenApiSource } from './openapi-types.js';
import type { OpenApiReferenceResolver } from './openapi-refs.js';
import type { OpenApiSchemaContext } from './openapi-schema.js';
import { childPointer } from './openapi-value.js';

export interface OpenApiModelContext {
  source: OpenApiSource;
  resolver: OpenApiReferenceResolver;
  warnings: ApiDocument['warnings'];
  signal?: AbortSignal;
}

export function openApiSchemaContext(context: OpenApiModelContext): OpenApiSchemaContext {
  return {
    source: context.source,
    resolver: context.resolver,
    ...(context.signal === undefined ? {} : { signal: context.signal }),
    warn: (message, summary, pointer) => addWarning(context, message, summary, pointer),
  };
}

export function warnUnshownFields(
  object: OpenApiObject,
  pointer: string,
  displayed: ReadonlySet<string>,
  context: OpenApiModelContext,
): void {
  for (const key of object.keys()) {
    if (displayed.has(key) || key === '$ref') continue;
    addWarning(
      context,
      `field "${key}" is not shown at ${childPointer(pointer, key)}`,
      key,
      childPointer(pointer, key),
    );
  }
}

export function addWarning(
  context: OpenApiModelContext,
  message: string,
  summary: string,
  pointer: string,
): void {
  pushOpenApiWarning(context.warnings, context.source, message, summary, pointer);
}

export function pushOpenApiWarning(
  warnings: ApiDocument['warnings'],
  source: OpenApiSource,
  message: string,
  summary: string,
  pointer: string,
): void {
  const position = source.positions.get(pointer);
  warnings.push({
    message,
    summary,
    ...(position === undefined ? {} : { line: position.line, column: position.column }),
  });
}

export function throwIfOpenApiAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new Error('OpenAPI rendering was aborted');
  }
}
