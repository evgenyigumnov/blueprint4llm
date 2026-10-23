import type { Element } from 'hast';
import type { Nodes as MdastNode } from 'mdast';

import { formatDiagnostic, type BlueprintDiagnostic, type DiagnosticCode } from '../diagnostics.js';
import { parseAndValidateSvg } from '../svg/parse-and-validate.js';
import { scopeSvgIds } from '../svg/scope-ids.js';
import type { DiagramRenderCache } from '../renderers/cache.js';
import type { DiagramRenderContext, DiagramRenderer } from '../renderers/types.js';
import { createDiagnosticCard } from '../diagnostics-html.js';

export const MAX_DIAGRAM_SOURCE_BYTES = 256 * 1024;

export interface DiagramBlock {
  node: Extract<MdastNode, { type: 'code' }>;
  renderer: DiagramRenderer;
}

export interface DiagramDiagnosticOptions {
  sourceFile: string;
  warnings: string[];
  errors: string[];
  diagnostics?: BlueprintDiagnostic[];
  figmaAccessToken?: string;
  signal?: AbortSignal;
  cache?: DiagramRenderCache;
  language: 'ru' | 'en';
}

/** Renders one block, replacing an isolated failure with a readable inline diagnostic. */
export async function processDiagramBlock(
  block: DiagramBlock,
  index: number,
  options: DiagramDiagnosticOptions,
): Promise<void> {
  const diagramId = `bp-diagram-${String(index + 1).padStart(3, '0')}`;
  const start = block.node.position?.start;
  const startLine = start?.line;
  const sourceBytes = Buffer.byteLength(block.node.value, 'utf8');
  const sourceLimit = block.renderer.maxSourceBytes ?? MAX_DIAGRAM_SOURCE_BYTES;
  if (sourceBytes > sourceLimit) {
    const diagnostic = makeDiagnostic(
      'diagram.limit',
      `diagram block is too large: ${sourceBytes} bytes (limit ${sourceLimit} bytes)`,
      block,
      options.sourceFile,
      diagramId,
      startLine,
      start?.column,
    );
    showBlockFailure(block, [diagnostic], options);
    return;
  }

  const context: DiagramRenderContext = {
    diagramId,
    sourceFile: options.sourceFile,
    line: startLine ?? 1,
    ...(typeof block.node.meta === 'string' ? { metadata: block.node.meta } : {}),
    ...(block.renderer.name === 'figma' && options.figmaAccessToken !== undefined
      ? { figmaAccessToken: options.figmaAccessToken }
      : {}),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  };

  let result;
  try {
    throwIfAborted(options.signal);
    result =
      options.cache === undefined
        ? await block.renderer.render(block.node.value, context)
        : await options.cache.render(block.renderer, block.node.value, context);
    throwIfAborted(options.signal);
  } catch (error) {
    throwIfAborted(options.signal);
    const diagnostic = makeRenderDiagnostic(error, block, context, diagramId);
    showBlockFailure(block, [diagnostic], options);
    return;
  }

  const diagnostics = [
    ...result.warnings.map((warning): BlueprintDiagnostic => {
      const line = mapSourceLine(startLine, warning.line, block.node.value);
      return {
        severity: 'warning',
        code: 'renderer.warning',
        scope: 'diagram',
        sourceFile: options.sourceFile,
        ...(line === undefined ? {} : { line }),
        column: warning.column ?? (warning.line === undefined ? start?.column : 1) ?? 1,
        diagramId,
        renderer: block.renderer.name,
        message: warning.message,
      };
    }),
    ...(result.errors ?? []).map((error): BlueprintDiagnostic => {
      const line = mapSourceLine(startLine, error.line, block.node.value);
      return {
        severity: 'error',
        code: 'diagram.render',
        scope: 'diagram',
        sourceFile: options.sourceFile,
        ...(line === undefined ? {} : { line }),
        column: error.column ?? (error.line === undefined ? start?.column : 1) ?? 1,
        diagramId,
        renderer: block.renderer.name,
        message: error.message,
      };
    }),
  ];

  let svg: Element;
  try {
    svg = parseAndValidateSvg(result.svg);
    preserveIntrinsicSvgWidth(svg);
    scopeSvgIds(svg, diagramId);
  } catch (error) {
    throwIfAborted(options.signal);
    const diagnostic = makeDiagnostic(
      'diagram.svg',
      `unsafe or invalid SVG: ${errorMessage(error)}`,
      block,
      options.sourceFile,
      diagramId,
      startLine,
      start?.column,
    );
    showBlockFailure(block, [...diagnostics, diagnostic], options);
    return;
  }
  recordDiagnostics(diagnostics, options);

  const figure: Element = {
    type: 'element',
    tagName: 'figure',
    properties: {
      className: ['bp-diagram', `bp-diagram--${block.renderer.name}`],
      'data-diagram-id': diagramId,
    },
    children: [svg],
  };
  if (diagnostics.length === 0) {
    block.node.data = {
      ...block.node.data,
      hName: 'figure',
      hProperties: figure.properties,
      hChildren: [svg],
    };
    return;
  }

  block.node.data = {
    ...block.node.data,
    hName: 'div',
    hProperties: { className: ['bp-diagram-with-diagnostics'] },
    hChildren: [
      figure,
      ...diagnostics.map((diagnostic) => createDiagnosticCard(diagnostic, options.language)),
    ],
  };
}

function showBlockFailure(
  block: DiagramBlock,
  diagnostics: BlueprintDiagnostic[],
  options: DiagramDiagnosticOptions,
): void {
  recordDiagnostics(diagnostics, options);
  block.node.data = {
    ...block.node.data,
    hName: 'div',
    hProperties: { className: ['bp-diagnostic-container'] },
    hChildren: diagnostics.map((diagnostic) => createDiagnosticCard(diagnostic, options.language)),
  };
}

function recordDiagnostics(
  diagnostics: readonly BlueprintDiagnostic[],
  options: DiagramDiagnosticOptions,
): void {
  for (const diagnostic of diagnostics) {
    options.diagnostics?.push(diagnostic);
    const message = formatDiagnostic(diagnostic);
    (diagnostic.severity === 'warning' ? options.warnings : options.errors).push(message);
  }
}

function makeDiagnostic(
  code: DiagnosticCode,
  message: string,
  block: DiagramBlock,
  sourceFile: string,
  diagramId: string,
  line: number | undefined,
  column: number | undefined,
): BlueprintDiagnostic {
  return {
    severity: 'error',
    code,
    scope: 'diagram',
    sourceFile,
    ...(line === undefined ? {} : { line }),
    ...(column === undefined ? {} : { column }),
    diagramId,
    renderer: block.renderer.name,
    message,
  };
}

function makeRenderDiagnostic(
  error: unknown,
  block: DiagramBlock,
  context: DiagramRenderContext,
  diagramId: string,
): BlueprintDiagnostic {
  const location = readRendererLocation(error);
  const line = mapSourceLine(context.line, location.line, block.node.value);
  const column =
    location.column ?? (location.line === undefined ? block.node.position?.start.column : 1);
  const message =
    error instanceof Error ? stripLocalLine(error.message, location.line) : String(error);
  const wrapped = / render failed: /.test(message)
    ? message
    : `${block.renderer.name} render failed: ${message}`;
  return {
    severity: 'error',
    code: 'diagram.render',
    scope: 'diagram',
    sourceFile: context.sourceFile,
    ...(line === undefined ? {} : { line }),
    ...(column === undefined ? {} : { column }),
    diagramId,
    renderer: block.renderer.name,
    message: wrapped,
  };
}

function readRendererLocation(error: unknown): { line?: number; column?: number } {
  if (typeof error !== 'object' || error === null) {
    return {};
  }
  const candidate = error as {
    loc?: { line?: number; col?: number };
    line?: number;
    column?: number;
    message?: string;
  };
  const parsedLocation = candidate.message?.match(
    /(?:Parse|Lexical) error on line (\d+)(?:, column (\d+))?/i,
  );
  const line =
    candidate.loc?.line ??
    candidate.line ??
    (parsedLocation ? Number(parsedLocation[1]) : undefined);
  const column =
    candidate.loc?.col ??
    candidate.column ??
    (parsedLocation?.[2] ? Number(parsedLocation[2]) : undefined);
  return {
    ...(typeof line === 'number' ? { line } : {}),
    ...(typeof column === 'number' ? { column } : {}),
  };
}

function stripLocalLine(message: string, line: number | undefined): string {
  return line === undefined ? message : message.replace(new RegExp(` \\(line ${line}\\)$`), '');
}

function mapSourceLine(
  blockLine: number | undefined,
  rendererLine: number | undefined,
  source: string,
): number | undefined {
  if (blockLine === undefined || rendererLine === undefined) {
    return blockLine;
  }
  const sourceLineCount = source.split(/\r\n|\r|\n/).length;
  return blockLine + Math.min(Math.max(rendererLine, 1), sourceLineCount);
}

/** Keeps wide diagrams scrollable instead of shrinking Mermaid's percentage-width root. */
function preserveIntrinsicSvgWidth(svg: Element): void {
  const width = svg.properties.width;
  const viewBox = svg.properties.viewBox;
  if (typeof width !== 'string' || !width.trim().endsWith('%') || typeof viewBox !== 'string') {
    return;
  }
  const dimensions = viewBox.trim().split(/[\s,]+/);
  const intrinsicWidth = Number(dimensions[2]);
  if (Number.isFinite(intrinsicWidth) && intrinsicWidth > 0) {
    svg.properties.width = String(intrinsicWidth);
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new Error('diagram rendering was aborted');
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
