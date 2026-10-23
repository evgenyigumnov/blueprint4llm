import { isAlias, isMap, isScalar, isSeq, LineCounter, parseDocument, type Node } from 'yaml';

import { OpenApiError } from './openapi-error.js';
import type {
  OpenApiObject,
  OpenApiPosition,
  OpenApiSource,
  OpenApiSourceFormat,
  OpenApiValue,
} from './openapi-types.js';

export const MAX_OPENAPI_SOURCE_BYTES = 256 * 1024;
export const MAX_OPENAPI_AST_NODES = 10_000;
export const MAX_OPENAPI_AST_DEPTH = 64;
export const OPENAPI_SUPPORTED_VERSION = '3.1.1';

const ALLOWED_TAGS = new Set([
  'tag:yaml.org,2002:bool',
  'tag:yaml.org,2002:float',
  'tag:yaml.org,2002:int',
  'tag:yaml.org,2002:map',
  'tag:yaml.org,2002:null',
  'tag:yaml.org,2002:seq',
  'tag:yaml.org,2002:str',
]);

interface AstTask {
  node: Node;
  pointer: string;
  depth: number;
}

/** Parses one YAML 1.2 or strict JSON OpenAPI source document. */
export function parseOpenApiSource(source: string): OpenApiSource {
  assertSourceSize(source);
  const format = detectSourceFormat(source);
  if (format === 'json') {
    assertJsonSyntax(source);
  }

  const lineCounter = new LineCounter();
  const document = parseDocument(source, {
    version: '1.2',
    schema: format === 'json' ? 'json' : 'core',
    uniqueKeys: true,
    lineCounter,
    prettyErrors: false,
    strict: true,
    merge: false,
    resolveKnownTags: false,
    logLevel: 'error',
  });

  const parseError = document.errors[0];
  if (parseError !== undefined) {
    const message =
      parseError.code === 'MULTIPLE_DOCS'
        ? 'multiple YAML documents are not supported'
        : parseError.code === 'DUPLICATE_KEY'
          ? 'duplicate mapping key'
          : `invalid ${format.toUpperCase()}: ${parseError.message}`;
    throw errorAtOffset(message, parseError.pos[0], lineCounter, undefined, parseError);
  }

  if (document.directives.yaml.version !== '1.2') {
    throw errorAtOffset('only YAML 1.2 is supported', 0, lineCounter);
  }

  const root = document.contents;
  if (root === null) {
    throw errorAtOffset('OpenAPI document must be an object', 0, lineCounter, '#');
  }

  const positions = validateAndIndexAst(root, lineCounter);
  let value: OpenApiValue;
  try {
    value = document.toJS({ mapAsMap: true, maxAliasCount: 0 }) as OpenApiValue;
  } catch (error) {
    throw errorAtOffset('could not convert OpenAPI source tree', 0, lineCounter, '#', error);
  }

  if (!(value instanceof Map)) {
    throw errorAtOffset('OpenAPI document must be an object', nodeOffset(root), lineCounter, '#');
  }
  validateOpenApiVersion(value as OpenApiObject, positions);

  return { value, positions, format };
}

function assertSourceSize(source: string): void {
  const bytes = Buffer.byteLength(source, 'utf8');
  if (bytes > MAX_OPENAPI_SOURCE_BYTES) {
    throw new OpenApiError(
      `OpenAPI source is too large: ${bytes} bytes (limit ${MAX_OPENAPI_SOURCE_BYTES} bytes)`,
      { pointer: '#', line: 1, column: 1 },
    );
  }
}

function detectSourceFormat(source: string): OpenApiSourceFormat {
  let offset = source.charCodeAt(0) === 0xfeff ? 1 : 0;
  while (offset < source.length) {
    while (offset < source.length && /\s/u.test(source[offset] ?? '')) {
      offset += 1;
    }
    if (source[offset] !== '#') {
      break;
    }
    const lineEnd = source.indexOf('\n', offset);
    offset = lineEnd === -1 ? source.length : lineEnd + 1;
  }

  const first = source[offset];
  return first === '{' || first === '[' ? 'json' : 'yaml';
}

function assertJsonSyntax(source: string): void {
  try {
    JSON.parse(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const offset = readJsonErrorOffset(message, source.length);
    const detail = message.replace(/ at position \d+(?: \(line \d+ column \d+\))?$/u, '');
    throw new OpenApiError(`invalid JSON: ${detail}`, positionAt(source, offset));
  }
}

function readJsonErrorOffset(message: string, fallbackOffset: number): number {
  const match = message.match(/ at position (\d+)/u);
  return match?.[1] === undefined ? fallbackOffset : Number(match[1]);
}

function validateAndIndexAst(root: Node, lineCounter: LineCounter): Map<string, OpenApiPosition> {
  const positions = new Map<string, OpenApiPosition>();
  const stack: AstTask[] = [{ node: root, pointer: '#', depth: 1 }];
  let nodeCount = 0;

  while (stack.length > 0) {
    const task = stack.pop();
    if (task === undefined) {
      continue;
    }
    assertDepth(task.depth, task.pointer, task.node, lineCounter);
    nodeCount = countNode(nodeCount, task.pointer, task.node, lineCounter);
    positions.set(task.pointer, positionForNode(task.node, lineCounter));
    assertSupportedTag(task.node, task.pointer, lineCounter);

    if (isAlias(task.node)) {
      throw errorAtNode('YAML aliases are not supported', task.node, lineCounter, task.pointer);
    }
    if (isScalar(task.node)) {
      if (typeof task.node.value === 'number' && !Number.isFinite(task.node.value)) {
        throw errorAtNode(
          'non-finite YAML numbers (.nan and .inf) are not supported',
          task.node,
          lineCounter,
          task.pointer,
        );
      }
      continue;
    }
    if (isSeq(task.node)) {
      for (let index = task.node.items.length - 1; index >= 0; index -= 1) {
        const item = task.node.items[index];
        if (item !== undefined && isNode(item)) {
          stack.push({ node: item, pointer: `${task.pointer}/${index}`, depth: task.depth + 1 });
        }
      }
      continue;
    }
    if (isMap(task.node)) {
      const additions: AstTask[] = [];
      for (const pair of task.node.items) {
        if (!isNode(pair.key)) {
          throw errorAtOffset(
            'mapping keys must be strings',
            nodeOffset(task.node),
            lineCounter,
            task.pointer,
          );
        }
        nodeCount = countNode(nodeCount, task.pointer, pair.key, lineCounter);
        assertSupportedTag(pair.key, task.pointer, lineCounter);
        if (isAlias(pair.key)) {
          throw errorAtNode('YAML aliases are not supported', pair.key, lineCounter, task.pointer);
        }
        if (!isScalar(pair.key) || typeof pair.key.value !== 'string') {
          throw errorAtNode('mapping keys must be strings', pair.key, lineCounter, task.pointer);
        }
        if (isMergeKey(pair.key)) {
          throw errorAtNode(
            'YAML merge keys are not supported',
            pair.key,
            lineCounter,
            task.pointer,
          );
        }

        const valuePointer = `${task.pointer}/${escapePointerSegment(pair.key.value)}`;
        if (pair.value !== null && isNode(pair.value)) {
          additions.push({ node: pair.value, pointer: valuePointer, depth: task.depth + 1 });
        } else {
          positions.set(valuePointer, positionForNode(pair.key, lineCounter));
        }
      }
      for (let index = additions.length - 1; index >= 0; index -= 1) {
        const addition = additions[index];
        if (addition !== undefined) {
          stack.push(addition);
        }
      }
    }
  }

  return positions;
}

function isNode(value: unknown): value is Node {
  return isAlias(value) || isScalar(value) || isMap(value) || isSeq(value);
}

function isMergeKey(node: Node): boolean {
  return (
    isScalar(node) &&
    node.value === '<<' &&
    node.type === 'PLAIN' &&
    (node.tag === undefined || node.tag === 'tag:yaml.org,2002:merge')
  );
}

function assertSupportedTag(node: Node, pointer: string, lineCounter: LineCounter): void {
  if (node.tag !== undefined && !ALLOWED_TAGS.has(node.tag)) {
    throw errorAtNode('custom YAML tags are not supported', node, lineCounter, pointer);
  }
}

function assertDepth(depth: number, pointer: string, node: Node, lineCounter: LineCounter): void {
  if (depth > MAX_OPENAPI_AST_DEPTH) {
    throw errorAtNode(
      `OpenAPI source tree exceeds the depth limit of ${MAX_OPENAPI_AST_DEPTH}`,
      node,
      lineCounter,
      pointer,
    );
  }
}

function countNode(count: number, pointer: string, node: Node, lineCounter: LineCounter): number {
  const nextCount = count + 1;
  if (nextCount > MAX_OPENAPI_AST_NODES) {
    throw errorAtNode(
      `OpenAPI source tree exceeds the node limit of ${MAX_OPENAPI_AST_NODES}`,
      node,
      lineCounter,
      pointer,
    );
  }
  return nextCount;
}

function validateOpenApiVersion(
  value: OpenApiObject,
  positions: ReadonlyMap<string, OpenApiPosition>,
): void {
  const version = value.get('openapi');
  const pointer = '#/openapi';
  const position = positions.get(pointer) ?? positions.get('#');
  const options = {
    pointer,
    ...(position === undefined ? {} : { line: position.line, column: position.column }),
  };
  if (typeof version !== 'string') {
    const message =
      version === undefined
        ? 'missing required field "openapi"'
        : 'OpenAPI field "openapi" must be a string';
    throw new OpenApiError(message, options);
  }
  if (version !== OPENAPI_SUPPORTED_VERSION) {
    throw new OpenApiError(
      `unsupported OpenAPI version: ${version}; supported: ${OPENAPI_SUPPORTED_VERSION}`,
      options,
    );
  }
}

function errorAtNode(
  message: string,
  node: Node,
  lineCounter: LineCounter,
  pointer: string,
): OpenApiError {
  return errorAtOffset(message, nodeOffset(node), lineCounter, pointer);
}

function errorAtOffset(
  message: string,
  offset: number,
  lineCounter: LineCounter,
  pointer?: string,
  cause?: unknown,
): OpenApiError {
  const location = lineCounter.linePos(offset);
  return new OpenApiError(message, {
    ...(pointer === undefined ? {} : { pointer }),
    line: location.line || 1,
    column: location.col || 1,
    ...(cause === undefined ? {} : { cause }),
  });
}

function positionAt(source: string, offset: number): { line: number; column: number } {
  const lineCounter = new LineCounter();
  lineCounter.addNewLine(0);
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\n') {
      lineCounter.addNewLine(index + 1);
    }
  }
  const position = lineCounter.linePos(offset);
  return { line: position.line || 1, column: position.col || 1 };
}

function positionForNode(node: Node, lineCounter: LineCounter): OpenApiPosition {
  const position = lineCounter.linePos(nodeOffset(node));
  return { line: position.line || 1, column: position.col || 1 };
}

function nodeOffset(node: Node): number {
  return node.range?.[0] ?? 0;
}

function escapePointerSegment(segment: string): string {
  return segment.replace(/~/gu, '~0').replace(/\//gu, '~1');
}
