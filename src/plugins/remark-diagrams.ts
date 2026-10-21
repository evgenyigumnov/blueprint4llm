import type { Element } from 'hast';
import type { Nodes as MdastNode, Root as MdastRoot } from 'mdast';

import { DiagnosticError } from '../errors.js';
import { parseAndValidateSvg } from '../svg/parse-and-validate.js';
import { scopeSvgIds } from '../svg/scope-ids.js';
import type { DiagramRenderCache } from '../renderers/cache.js';
import type { DiagramRenderContext, DiagramRenderer, DiagramWarning } from '../renderers/types.js';

export const MAX_DIAGRAM_BLOCKS = 100;
export const MAX_DIAGRAM_SOURCE_BYTES = 256 * 1024;

export interface RemarkDiagramOptions {
  renderers: readonly DiagramRenderer[];
  sourceFile: string;
  warnings: string[];
  errors: string[];
  figmaAccessToken?: string;
  signal?: AbortSignal;
  cache?: DiagramRenderCache;
}

interface DiagramBlock {
  node: Extract<MdastNode, { type: 'code' }>;
  renderer: DiagramRenderer;
}

/** Replaces supported fenced code blocks with figure elements containing inline SVG. */
export function remarkDiagramPlugin(options: RemarkDiagramOptions) {
  const renderersByLanguage = createRendererMap(options.renderers);

  return async (tree: MdastRoot): Promise<void> => {
    const blocks: DiagramBlock[] = [];
    collectDiagramBlocks(tree, renderersByLanguage, blocks);

    if (blocks.length > MAX_DIAGRAM_BLOCKS) {
      const excessBlock = blocks[MAX_DIAGRAM_BLOCKS];
      if (excessBlock !== undefined) {
        throw diagnosticAtBlock(
          `too many diagram blocks: ${blocks.length} (limit ${MAX_DIAGRAM_BLOCKS})`,
          excessBlock,
          options.sourceFile,
        );
      }
    }

    for (const [index, block] of blocks.entries()) {
      const sourceBytes = Buffer.byteLength(block.node.value, 'utf8');
      const sourceLimit = block.renderer.maxSourceBytes ?? MAX_DIAGRAM_SOURCE_BYTES;
      if (sourceBytes > sourceLimit) {
        throw diagnosticAtBlock(
          `diagram block is too large: ${sourceBytes} bytes (limit ${sourceLimit} bytes)`,
          block,
          options.sourceFile,
        );
      }

      const diagramId = `bp-diagram-${String(index + 1).padStart(3, '0')}`;
      const startLine = block.node.position?.start.line;
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
        result =
          options.cache === undefined
            ? await block.renderer.render(block.node.value, context)
            : await options.cache.render(block.renderer, block.node.value, context);
        const svg = parseAndValidateSvg(result.svg);
        preserveIntrinsicSvgWidth(svg);
        scopeSvgIds(svg, diagramId);
        block.node.data = {
          ...block.node.data,
          hName: 'figure',
          hProperties: {
            className: ['bp-diagram', `bp-diagram--${block.renderer.name}`],
            'data-diagram-id': diagramId,
          },
          hChildren: [svg],
        };
      } catch (error) {
        throw createRenderDiagnostic(error, block, context);
      }

      for (const warning of result.warnings) {
        options.warnings.push(
          formatWarning(warning, block, options.sourceFile, block.renderer.name),
        );
      }
      for (const error of result.errors ?? []) {
        options.errors.push(formatError(error, block, options.sourceFile, block.renderer.name));
      }
    }
  };
}

function diagnosticAtBlock(
  message: string,
  block: DiagramBlock,
  sourceFile: string,
): DiagnosticError {
  const position = block.node.position?.start;
  return new DiagnosticError(message, {
    sourceFile,
    ...(position === undefined ? {} : { line: position.line, column: position.column }),
  });
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

function createRendererMap(renderers: readonly DiagramRenderer[]): Map<string, DiagramRenderer> {
  const map = new Map<string, DiagramRenderer>();
  for (const renderer of renderers) {
    for (const language of renderer.languages) {
      if (map.has(language)) {
        throw new Error(`multiple diagram renderers are registered for \`${language}\``);
      }
      map.set(language, renderer);
    }
  }
  return map;
}

function collectDiagramBlocks(
  node: MdastRoot | MdastNode,
  renderers: Map<string, DiagramRenderer>,
  blocks: DiagramBlock[],
): void {
  if (node.type === 'code' && typeof node.lang === 'string') {
    const renderer = renderers.get(node.lang);
    if (renderer !== undefined) {
      blocks.push({ node, renderer });
    }
  }

  if ('children' in node) {
    for (const child of node.children as MdastNode[]) {
      collectDiagramBlocks(child, renderers, blocks);
    }
  }
}

function createRenderDiagnostic(
  error: unknown,
  block: DiagramBlock,
  context: DiagramRenderContext,
): DiagnosticError {
  const location = readRendererLocation(error);
  const line = mapSourceLine(context.line, location.line, block.node.value);
  const column =
    location.column ?? (location.line === undefined ? block.node.position?.start.column : 1);
  const message =
    error instanceof Error ? stripLocalLine(error.message, location.line) : String(error);
  return new DiagnosticError(`${block.renderer.name} render failed: ${message}`, {
    sourceFile: context.sourceFile,
    ...(line === undefined ? {} : { line }),
    ...(column === undefined ? {} : { column }),
    cause: error,
  });
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
  if (line === undefined) {
    return message;
  }
  return message.replace(new RegExp(` \\(line ${line}\\)$`), '');
}

function formatWarning(
  warning: DiagramWarning,
  block: DiagramBlock,
  sourceFile: string,
  rendererName: string,
): string {
  const blockLine = block.node.position?.start.line;
  const line =
    warning.line === undefined
      ? blockLine
      : blockLine === undefined
        ? undefined
        : blockLine + warning.line;
  const column = warning.column ?? 1;
  const location = line === undefined ? sourceFile : `${sourceFile}:${line}:${column}`;
  return `${location}: ${rendererName} warning: ${warning.message}`;
}

function formatError(
  error: { message: string; line?: number; column?: number },
  block: DiagramBlock,
  sourceFile: string,
  rendererName: string,
): string {
  const line = mapSourceLine(block.node.position?.start.line, error.line, block.node.value);
  const column = error.column ?? 1;
  const location = line === undefined ? sourceFile : `${sourceFile}:${line}:${column}`;
  return `${location}: ${rendererName} error: ${error.message}`;
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
