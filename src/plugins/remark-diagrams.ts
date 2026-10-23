import type { Nodes as MdastNode, Root as MdastRoot } from 'mdast';

import type { BlueprintDiagnostic } from '../diagnostics.js';
import { DiagnosticError } from '../errors.js';
import type { DiagramRenderCache } from '../renderers/cache.js';
import type { DiagramRenderer } from '../renderers/types.js';
import { processDiagramBlock } from './diagram-diagnostics.js';
import type { DiagramBlock } from './diagram-diagnostics.js';

export { MAX_DIAGRAM_SOURCE_BYTES } from './diagram-diagnostics.js';

export const MAX_DIAGRAM_BLOCKS = 100;

export interface RemarkDiagramOptions {
  renderers: readonly DiagramRenderer[];
  sourceFile: string;
  warnings: string[];
  errors: string[];
  /** Structured records collected alongside the legacy message arrays. */
  diagnostics?: BlueprintDiagnostic[];
  language?: 'ru' | 'en';
  requireSingleDiagram?: boolean;
  figmaAccessToken?: string;
  signal?: AbortSignal;
  cache?: DiagramRenderCache;
}

/** Replaces supported fenced code blocks with figure elements containing inline SVG. */
export function remarkDiagramPlugin(options: RemarkDiagramOptions) {
  const renderersByLanguage = createRendererMap(options.renderers);

  return async (tree: MdastRoot): Promise<void> => {
    const blocks: DiagramBlock[] = [];
    collectDiagramBlocks(tree, renderersByLanguage, blocks);

    if (options.requireSingleDiagram === true && blocks.length !== 1) {
      throw new DiagnosticError(
        `single-diagram export requires exactly one supported diagram block; found ${blocks.length}`,
        { sourceFile: options.sourceFile },
      );
    }

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
      await processDiagramBlock(block, index, {
        sourceFile: options.sourceFile,
        warnings: options.warnings,
        errors: options.errors,
        ...(options.diagnostics === undefined ? {} : { diagnostics: options.diagnostics }),
        language: options.language ?? 'en',
        ...(options.figmaAccessToken === undefined
          ? {}
          : { figmaAccessToken: options.figmaAccessToken }),
        ...(options.signal === undefined ? {} : { signal: options.signal }),
        ...(options.cache === undefined ? {} : { cache: options.cache }),
      });
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
