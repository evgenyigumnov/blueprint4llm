import type { DiagramWarning } from './types.js';
import type { GraphvizEngineMessage, GraphvizRenderOutput } from './graphviz-worker-protocol.js';

export class GraphvizRenderError extends Error {
  readonly line: number | undefined;
  readonly column: number | undefined;

  constructor(message: string, location: { line?: number; column?: number } = {}) {
    super(message);
    this.name = 'GraphvizRenderError';
    this.line = location.line;
    this.column = location.column;
  }
}

/** Converts Viz.js errors and warnings into the renderer's shared result contract. */
export function readGraphvizResult(result: GraphvizRenderOutput): {
  svg: string;
  warnings: DiagramWarning[];
} {
  const messages = result.errors
    .map((item) => normalizeEngineMessage(item))
    .filter(({ message }) => !isUnicodeWidthFallbackWarning(message));
  const failures =
    result.status === 'failure' ? messages : messages.filter((item) => item.level === 'error');
  if (failures.length > 0 || result.status === 'failure') {
    const failure = failures.find((item) => item.level === 'error') ??
      failures[0] ?? { message: 'Graphviz did not produce an SVG' };
    const location = readGraphvizLocation(failure.message);
    throw new GraphvizRenderError(`Graphviz render failed: ${failure.message}`, location);
  }
  if (result.output === undefined) {
    throw new GraphvizRenderError('Graphviz render failed: no SVG output was returned');
  }

  return {
    svg: result.output,
    warnings: messages.map(({ message }) => ({ message, ...readGraphvizLocation(message) })),
  };
}

/** Extracts a one-based line and optional column from a Graphviz message. */
export function readGraphvizLocation(message: string): { line?: number; column?: number } {
  const match = message.match(/\bline\s+(\d+)(?:\s*[,;]\s*column\s+(\d+))?/i);
  if (match === null) {
    return {};
  }
  return {
    line: Number(match[1]),
    ...(match[2] === undefined ? {} : { column: Number(match[2]) }),
  };
}

function normalizeEngineMessage(item: GraphvizEngineMessage): GraphvizEngineMessage {
  return {
    message: item.message.trim(),
    ...(item.level === undefined ? {} : { level: item.level }),
  };
}

/** Viz.js uses hard-coded font metrics and emits this warning for UTF-8 bytes in SVG labels. */
function isUnicodeWidthFallbackWarning(message: string): boolean {
  return /^Warning: no value for width of non-ASCII character \d+\. Falling back to width of space character$/i.test(
    message,
  );
}
