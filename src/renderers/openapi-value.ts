import { OpenApiError } from './openapi-error.js';
import type { OpenApiObject, OpenApiSource, OpenApiValue } from './openapi-types.js';

export function childPointer(pointer: string, segment: string): string {
  return `${pointer}/${escapePointerSegment(segment)}`;
}

export function escapePointerSegment(segment: string): string {
  return segment.replace(/~/gu, '~0').replace(/\//gu, '~1');
}

export function asObject(
  value: OpenApiValue | undefined,
  pointer: string,
  source: OpenApiSource,
  label: string,
): OpenApiObject {
  if (!(value instanceof Map)) {
    throw openApiError(`${label} must be an object`, pointer, source);
  }
  return value;
}

export function optionalObject(
  object: OpenApiObject,
  key: string,
  pointer: string,
  source: OpenApiSource,
): OpenApiObject | undefined {
  const value = object.get(key);
  if (value === undefined) return undefined;
  return asObject(value, childPointer(pointer, key), source, `field "${key}"`);
}

export function requiredString(
  object: OpenApiObject,
  key: string,
  pointer: string,
  source: OpenApiSource,
): string {
  const value = object.get(key);
  if (typeof value !== 'string' || value.length === 0) {
    throw openApiError(
      `field "${key}" must be a non-empty string`,
      childPointer(pointer, key),
      source,
    );
  }
  return value;
}

export function optionalString(
  object: OpenApiObject,
  key: string,
  pointer: string,
  source: OpenApiSource,
): string | undefined {
  const value = object.get(key);
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw openApiError(`field "${key}" must be a string`, childPointer(pointer, key), source);
  }
  return value;
}

export function optionalBoolean(
  object: OpenApiObject,
  key: string,
  pointer: string,
  source: OpenApiSource,
): boolean | undefined {
  const value = object.get(key);
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') {
    throw openApiError(`field "${key}" must be a boolean`, childPointer(pointer, key), source);
  }
  return value;
}

export function stringArray(
  object: OpenApiObject,
  key: string,
  pointer: string,
  source: OpenApiSource,
): string[] {
  const value = object.get(key);
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw openApiError(
      `field "${key}" must be an array of strings`,
      childPointer(pointer, key),
      source,
    );
  }
  return value.map((item, index) => {
    if (typeof item !== 'string') {
      throw openApiError(
        `field "${key}" must contain only strings`,
        childPointer(childPointer(pointer, key), String(index)),
        source,
      );
    }
    return item;
  });
}

export function openApiError(
  message: string,
  pointer: string,
  source: OpenApiSource,
  cause?: unknown,
): OpenApiError {
  const position = source.positions.get(pointer) ?? source.positions.get('#');
  return new OpenApiError(message, {
    pointer,
    ...(position === undefined ? {} : { line: position.line, column: position.column }),
    ...(cause === undefined ? {} : { cause }),
  });
}
