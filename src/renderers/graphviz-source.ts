import { GRAPHVIZ_ENGINES, type GraphvizEngine } from './graphviz-worker-protocol.js';

export interface GraphvizMetadata {
  engine: GraphvizEngine;
}

/** Parses the strict `engine=<name>` metadata used by Graphviz fences. */
export function parseGraphvizMetadata(metadata: string | undefined): GraphvizMetadata {
  const value = metadata?.trim();
  if (value === undefined || value.length === 0) {
    return { engine: 'dot' };
  }

  let engine: string | undefined;
  for (const token of value.split(/\s+/)) {
    const separator = token.indexOf('=');
    if (separator <= 0) {
      throw new Error(`invalid Graphviz metadata parameter "${token}"; expected key=value`);
    }

    const key = token.slice(0, separator);
    let parameterValue = token.slice(separator + 1);
    if (parameterValue.startsWith('"') || parameterValue.endsWith('"')) {
      if (!(parameterValue.startsWith('"') && parameterValue.endsWith('"'))) {
        throw new Error(`invalid quoted Graphviz metadata parameter "${token}"`);
      }
      parameterValue = parameterValue.slice(1, -1);
    }

    if (parameterValue.length === 0) {
      throw new Error(`Graphviz metadata parameter "${key}" must not be empty`);
    }
    if (key !== 'engine') {
      throw new Error(`unknown Graphviz metadata parameter "${key}"`);
    }
    if (engine !== undefined) {
      throw new Error('Graphviz metadata parameter "engine" must not be repeated');
    }
    if (!GRAPHVIZ_ENGINES.includes(parameterValue as GraphvizEngine)) {
      throw new Error(
        `unsupported Graphviz engine "${parameterValue}"; supported engines: ${GRAPHVIZ_ENGINES.join(', ')}`,
      );
    }
    engine = parameterValue;
  }

  return { engine: (engine ?? 'dot') as GraphvizEngine };
}

/** Rejects trailing DOT documents because Viz.js renders only the first graph. */
export function assertSingleGraphSource(source: string): void {
  const openingBrace = findGraphOpeningBrace(source);
  if (openingBrace === undefined) {
    return;
  }

  const closingBrace = findGraphClosingBrace(source, openingBrace);
  if (closingBrace === undefined) {
    return;
  }

  if (hasNonCommentContent(source, closingBrace + 1)) {
    throw new Error('a Graphviz block must contain exactly one graph');
  }
}

function findGraphOpeningBrace(source: string): number | undefined {
  let sawGraphKeyword = false;
  for (let index = 0; index < source.length;) {
    const skippedComment = skipComment(source, index);
    if (skippedComment !== undefined) {
      index = skippedComment;
      continue;
    }

    const character = source[index]!;
    if (character === '"') {
      index = skipQuotedString(source, index);
      continue;
    }
    if (character === '<' && source[index + 1] === '<') {
      index = skipHtmlLabel(source, index);
      continue;
    }
    if (sawGraphKeyword && character === '{') {
      return index;
    }
    if (isIdentifierStart(character)) {
      const end = readIdentifierEnd(source, index);
      const word = source.slice(index, end);
      if (word === 'graph' || word === 'digraph') {
        sawGraphKeyword = true;
      }
      index = end;
      continue;
    }
    index += 1;
  }
  return undefined;
}

function findGraphClosingBrace(source: string, openingBrace: number): number | undefined {
  let depth = 0;
  for (let index = openingBrace; index < source.length;) {
    const skippedComment = skipComment(source, index);
    if (skippedComment !== undefined) {
      index = skippedComment;
      continue;
    }

    const character = source[index]!;
    if (character === '"') {
      index = skipQuotedString(source, index);
      continue;
    }
    if (character === '<' && source[index + 1] === '<') {
      index = skipHtmlLabel(source, index);
      continue;
    }
    if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
    index += 1;
  }
  return undefined;
}

function hasNonCommentContent(source: string, start: number): boolean {
  for (let index = start; index < source.length;) {
    const skippedComment = skipComment(source, index);
    if (skippedComment !== undefined) {
      index = skippedComment;
      continue;
    }
    if (/\s/.test(source[index]!)) {
      index += 1;
      continue;
    }
    return true;
  }
  return false;
}

function skipComment(source: string, index: number): number | undefined {
  if (source.startsWith('//', index) || source[index] === '#') {
    const end = source.indexOf('\n', index);
    return end < 0 ? source.length : end + 1;
  }
  if (source.startsWith('/*', index)) {
    const end = source.indexOf('*/', index + 2);
    return end < 0 ? source.length : end + 2;
  }
  return undefined;
}

function skipQuotedString(source: string, start: number): number {
  for (let index = start + 1; index < source.length; index += 1) {
    if (source[index] === '\\') {
      index += 1;
    } else if (source[index] === '"') {
      return index + 1;
    }
  }
  return source.length;
}

function skipHtmlLabel(source: string, start: number): number {
  let angleDepth = 1;
  let insideTag = false;
  let quote: '"' | "'" | undefined;

  for (let index = start + 1; index < source.length; index += 1) {
    if (source.startsWith('<!--', index)) {
      const commentEnd = source.indexOf('-->', index + 4);
      if (commentEnd < 0) {
        return source.length;
      }
      index = commentEnd + 2;
      continue;
    }

    const character = source[index]!;
    if (insideTag && quote !== undefined) {
      if (character === quote) {
        quote = undefined;
      }
      continue;
    }
    if (insideTag && (character === '"' || character === "'")) {
      quote = character;
      continue;
    }
    if (character === '<') {
      angleDepth += 1;
      insideTag = true;
    } else if (character === '>') {
      angleDepth -= 1;
      insideTag = false;
      if (angleDepth === 0) {
        return index + 1;
      }
    }
  }

  return source.length;
}

function isIdentifierStart(character: string): boolean {
  return /[A-Za-z_\u0080-\uFFFF]/.test(character);
}

function readIdentifierEnd(source: string, start: number): number {
  let index = start + 1;
  while (index < source.length && /[A-Za-z_\u0080-\uFFFF0-9]/.test(source[index]!)) {
    index += 1;
  }
  return index;
}
