import { OpenApiError } from './openapi-error.js';
import type {
  OpenApiObject,
  OpenApiReferenceKind,
  OpenApiSource,
  OpenApiValue,
} from './openapi-types.js';
import { childPointer, openApiError } from './openapi-value.js';

export const MAX_OPENAPI_REFERENCES = 2_000;

export interface ResolvedOpenApiReference {
  pointer: string;
  value: OpenApiValue;
}

export interface ResolvedReferenceObject {
  pointer: string;
  value: OpenApiObject;
  fieldPointers: ReadonlyMap<string, string>;
}

export interface OpenApiReferenceOptions {
  warn(message: string, summary: string, pointer: string): void;
  signal?: AbortSignal;
}

/** Resolves local JSON Pointer references without reading files or making network requests. */
export class OpenApiReferenceResolver {
  private references = 0;
  private readonly targetMemo = new Map<string, ResolvedOpenApiReference>();
  private readonly usedTargets = new Set<string>();

  constructor(
    private readonly source: OpenApiSource,
    private readonly options: OpenApiReferenceOptions,
  ) {}

  get referencedPointers(): ReadonlySet<string> {
    return this.usedTargets;
  }

  resolve(
    reference: string,
    referencePointer: string,
    expected: OpenApiReferenceKind,
  ): ResolvedOpenApiReference {
    throwIfAborted(this.options.signal);
    this.countReference(referencePointer);
    const pointer = parseReferencePointer(reference, referencePointer, this.source);
    const cacheKey = `${expected}\0${pointer}`;
    const cached = this.targetMemo.get(cacheKey);
    if (cached !== undefined) return cached;

    const value = lookupPointer(this.source.value, pointer, referencePointer, this.source);
    assertExpectedTarget(value, pointer, referencePointer, expected, this.source);
    const result = { pointer, value };
    this.usedTargets.add(pointer);
    this.targetMemo.set(cacheKey, result);
    return result;
  }

  /** Resolves a chain of Reference Objects and applies only supported summary/description siblings. */
  resolveObject(
    value: OpenApiValue | undefined,
    pointer: string,
    expected: Exclude<OpenApiReferenceKind, 'schema'>,
  ): ResolvedReferenceObject {
    if (!(value instanceof Map)) {
      throw openApiError(`${expected} must be an object`, pointer, this.source);
    }
    const result = this.resolveObjectChain(value, pointer, expected, new Set());
    return result;
  }

  private resolveObjectChain(
    value: OpenApiObject,
    pointer: string,
    expected: Exclude<OpenApiReferenceKind, 'schema'>,
    chain: Set<string>,
  ): ResolvedReferenceObject {
    const reference = value.get('$ref');
    if (reference === undefined) {
      const fieldPointers = new Map<string, string>();
      for (const key of value.keys()) fieldPointers.set(key, childPointer(pointer, key));
      return { pointer, value, fieldPointers };
    }
    if (typeof reference !== 'string') {
      throw openApiError('$ref must be a string', childPointer(pointer, '$ref'), this.source);
    }

    const referencePointer = childPointer(pointer, '$ref');
    const target = this.resolve(reference, referencePointer, expected);
    if (!(target.value instanceof Map)) {
      throw openApiError(`$ref target must be a ${expected} object`, referencePointer, this.source);
    }
    if (chain.has(target.pointer)) {
      throw openApiError(
        `cyclic $ref chain is not supported for ${expected} objects`,
        referencePointer,
        this.source,
      );
    }

    const nextChain = new Set(chain);
    nextChain.add(target.pointer);
    const resolved = this.resolveObjectChain(target.value, target.pointer, expected, nextChain);
    const valueWithOverrides = new Map(resolved.value);
    const fieldPointers = new Map(resolved.fieldPointers);

    for (const [key, sibling] of value) {
      if (key === '$ref') continue;
      if (key === 'summary' || key === 'description') {
        if (typeof sibling !== 'string') {
          throw openApiError(
            `Reference Object field "${key}" must be a string`,
            childPointer(pointer, key),
            this.source,
          );
        }
        valueWithOverrides.set(key, sibling);
        fieldPointers.set(key, childPointer(pointer, key));
      } else if (expected === 'path item' && isPathItemMergeField(key)) {
        throw openApiError(
          'Path Item $ref with local operations or parameters is not supported',
          childPointer(pointer, key),
          this.source,
        );
      } else {
        this.options.warn(
          `ignored sibling field "${key}" next to $ref at ${pointer}`,
          `reference siblings (${key})`,
          childPointer(pointer, key),
        );
      }
    }
    return { pointer: resolved.pointer, value: valueWithOverrides, fieldPointers };
  }

  private countReference(pointer: string): void {
    this.references += 1;
    if (this.references > MAX_OPENAPI_REFERENCES) {
      throw openApiError(
        `OpenAPI reference limit exceeded: ${this.references} (limit ${MAX_OPENAPI_REFERENCES})`,
        pointer,
        this.source,
      );
    }
  }
}

export function parseReferencePointer(
  reference: string,
  referencePointer: string,
  source: OpenApiSource,
): string {
  if (!reference.startsWith('#/')) {
    if (reference.startsWith('#')) {
      throw openApiError(
        'fragment-only $ref values such as "#" are not supported',
        referencePointer,
        source,
      );
    }
    throw openApiError(
      'external $ref is not supported; embed the referenced object in this block',
      referencePointer,
      source,
    );
  }

  let fragment: string;
  try {
    fragment = decodeURIComponent(reference.slice(1));
  } catch (error) {
    throw openApiError(
      'invalid percent-encoding in $ref fragment',
      referencePointer,
      source,
      error,
    );
  }
  if (!fragment.startsWith('/')) {
    throw openApiError('invalid JSON Pointer fragment in $ref', referencePointer, source);
  }

  const segments = fragment
    .slice(1)
    .split('/')
    .map((segment) => {
      if (/~(?![01])/u.test(segment)) {
        throw openApiError('invalid JSON Pointer escape in $ref', referencePointer, source);
      }
      return segment.replace(/~1/gu, '/').replace(/~0/gu, '~');
    });
  return segments.reduce((pointer, segment) => childPointer(pointer, segment), '#');
}

function lookupPointer(
  root: OpenApiValue,
  pointer: string,
  referencePointer: string,
  source: OpenApiSource,
): OpenApiValue {
  if (pointer === '#') return root;
  const segments = pointer.slice(2).split('/').map(decodePointerSegment);
  let current: OpenApiValue = root;
  let currentPointer = '#';

  for (const segment of segments) {
    currentPointer = childPointer(currentPointer, segment);
    if (current instanceof Map) {
      if (!current.has(segment)) throw unresolvedReference(referencePointer, pointer, source);
      current = current.get(segment) as OpenApiValue;
      continue;
    }
    if (Array.isArray(current)) {
      if (!/^(0|[1-9]\d*)$/u.test(segment)) {
        throw unresolvedReference(referencePointer, pointer, source);
      }
      const index = Number(segment);
      const next = current[index];
      if (next === undefined) throw unresolvedReference(referencePointer, pointer, source);
      current = next;
      continue;
    }
    throw unresolvedReference(referencePointer, pointer, source);
  }
  return current;
}

function decodePointerSegment(segment: string): string {
  return segment.replace(/~1/gu, '/').replace(/~0/gu, '~');
}

function unresolvedReference(
  referencePointer: string,
  targetPointer: string,
  source: OpenApiSource,
): OpenApiError {
  return openApiError(`unresolved $ref: ${targetPointer}`, referencePointer, source);
}

function assertExpectedTarget(
  value: OpenApiValue,
  targetPointer: string,
  referencePointer: string,
  expected: OpenApiReferenceKind,
  source: OpenApiSource,
): void {
  if (expected === 'schema' && (value instanceof Map || typeof value === 'boolean')) return;
  if (expected !== 'schema' && value instanceof Map && isExpectedObject(value, expected)) return;
  throw openApiError(
    `$ref target at ${targetPointer} must be a ${expected}${expected === 'schema' ? '' : ' object'}`,
    referencePointer,
    source,
  );
}

function isExpectedObject(
  value: OpenApiObject,
  expected: Exclude<OpenApiReferenceKind, 'schema'>,
): boolean {
  if (value.has('$ref')) return true;
  switch (expected) {
    case 'parameter':
      return (
        typeof value.get('name') === 'string' &&
        typeof value.get('in') === 'string' &&
        hasOnlyFields(value, PARAMETER_OBJECT_FIELDS)
      );
    case 'request body':
      return value.get('content') instanceof Map && hasOnlyFields(value, REQUEST_BODY_FIELDS);
    case 'response':
      return (
        typeof value.get('description') === 'string' && hasOnlyFields(value, RESPONSE_OBJECT_FIELDS)
      );
    case 'header':
      return hasOnlyFields(value, HEADER_OBJECT_FIELDS);
    case 'path item':
      return [...value.keys()].every(
        (key) => PATH_ITEM_FIELDS.has(key) || OPENAPI_METHODS.has(key) || key.startsWith('x-'),
      );
  }
}

function hasOnlyFields(value: OpenApiObject, supported: ReadonlySet<string>): boolean {
  return [...value.keys()].every((key) => supported.has(key) || key.startsWith('x-'));
}

function isPathItemMergeField(key: string): boolean {
  return key === 'parameters' || OPENAPI_METHODS.has(key);
}

const OPENAPI_METHODS = new Set([
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
]);
const PATH_ITEM_FIELDS = new Set(['$ref', 'summary', 'description', 'servers', 'parameters']);
const PARAMETER_OBJECT_FIELDS = new Set([
  'name',
  'in',
  'description',
  'required',
  'deprecated',
  'allowEmptyValue',
  'style',
  'explode',
  'allowReserved',
  'schema',
  'example',
  'examples',
  'content',
]);
const REQUEST_BODY_FIELDS = new Set(['description', 'content', 'required']);
const RESPONSE_OBJECT_FIELDS = new Set(['description', 'headers', 'content', 'links']);
const HEADER_OBJECT_FIELDS = new Set([
  'description',
  'required',
  'deprecated',
  'allowEmptyValue',
  'style',
  'explode',
  'allowReserved',
  'schema',
  'example',
  'examples',
  'content',
]);

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new Error('OpenAPI rendering was aborted');
  }
}
