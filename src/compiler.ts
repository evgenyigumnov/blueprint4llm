import path from 'node:path';

import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import type { Element, Root as HastRoot } from 'hast';
import type { Nodes as MdastNode, Root as MdastRoot } from 'mdast';

import { remarkLocalAssetsPlugin } from './assets.js';
import type { LocalAsset } from './assets.js';
import { DiagnosticError, toDiagnosticError } from './errors.js';
import { remarkDiagramPlugin } from './plugins/remark-diagrams.js';
import { rehypeDiagramContainersPlugin } from './plugins/rehype-diagram-containers.js';
import { remarkSafeLinksPlugin } from './plugins/remark-safe-links.js';
import { mermaidRenderer } from './renderers/mermaid.js';
import { wiremarkRenderer } from './renderers/wiremark.js';
import type { DiagramRenderCache } from './renderers/cache.js';
import { renderHtmlPage } from './template.js';

export type { LocalAsset } from './assets.js';

/** Hard limit for the source Markdown size (plan §8.4). */
export const MAX_MARKDOWN_BYTES = 5 * 1024 * 1024;

export interface CompileOptions {
  /** Path of the source Markdown file, used for diagnostics and the title fallback. */
  sourceFile: string;
  /** Optional cache shared across successive live-preview builds. */
  diagramCache?: DiagramRenderCache;
  /** Optional set populated with local image paths, including missing references. */
  watchPaths?: Set<string>;
  /** Aborts outstanding renderer work when a newer source version replaces this build. */
  signal?: AbortSignal;
}

export interface CompiledBlueprint {
  html: string;
  title: string;
  assets: LocalAsset[];
  warnings: string[];
  /** Non-fatal diagram diagnostics; callers can report these while using the compiled output. */
  errors?: string[];
}

/**
 * Compiles Markdown into a complete standalone HTML5 document.
 *
 * GFM Markdown and supported diagram fences are compiled in one remark
 * pipeline; each renderer's SVG is embedded into the generated HTML.
 */
export async function compileMarkdown(
  markdown: string,
  options: CompileOptions,
): Promise<CompiledBlueprint> {
  const byteLength = Buffer.byteLength(markdown, 'utf8');
  if (byteLength > MAX_MARKDOWN_BYTES) {
    throw new DiagnosticError(
      `source Markdown is too large: ${byteLength} bytes (limit ${MAX_MARKDOWN_BYTES} bytes)`,
      { sourceFile: options.sourceFile },
    );
  }

  let headingTitle: string | undefined;
  const warnings: string[] = [];
  const errors: string[] = [];
  const assets: LocalAsset[] = [];
  const collectTitle = () => (tree: MdastRoot) => {
    headingTitle = findFirstH1Text(tree);
  };

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(collectTitle)
    .use(remarkLocalAssetsPlugin, {
      sourceFile: options.sourceFile,
      assets,
      ...(options.watchPaths === undefined ? {} : { watchPaths: options.watchPaths }),
    })
    .use(remarkDiagramPlugin, {
      renderers: [mermaidRenderer, wiremarkRenderer],
      sourceFile: options.sourceFile,
      warnings,
      errors,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(options.diagramCache === undefined ? {} : { cache: options.diagramCache }),
    })
    .use(remarkRehype, {
      handlers: {
        // Raw HTML from untrusted Markdown is escaped, never executed (plan §8.3).
        html: (_h, node) => ({ type: 'text', value: node.value }),
      },
    })
    .use(rehypeDiagramContainersPlugin)
    .use(remarkSafeLinksPlugin)
    .use(wrapTablesPlugin)
    .use(rehypeStringify);

  let bodyHtml: string;
  try {
    const file = await processor.process(markdown);
    bodyHtml = String(file);
  } catch (error) {
    throw toDiagnosticError(error, 'Markdown render failed', {
      sourceFile: options.sourceFile,
    });
  }

  const fallbackTitle = path.basename(options.sourceFile, path.extname(options.sourceFile));
  const title = headingTitle || fallbackTitle || 'Blueprint';
  const lang = detectLanguage(markdown);

  const html = renderHtmlPage({ lang, title, bodyHtml });

  return { html, title, assets, warnings, errors };
}

/** Detects the dominant document language from the presence of Cyrillic letters. */
export function detectLanguage(markdown: string): 'ru' | 'en' {
  return /[Ѐ-ӿԀ-ԯ]/.test(markdown) ? 'ru' : 'en';
}

/** Finds the text of the first top-level `# heading`, if any. */
export function findFirstH1Text(tree: MdastRoot): string | undefined {
  for (const node of tree.children) {
    if (node.type === 'heading' && node.depth === 1) {
      return mdastText(node).trim();
    }
  }
  return undefined;
}

function mdastText(node: MdastNode): string {
  if (node.type === 'text' || node.type === 'inlineCode') {
    return node.value;
  }
  if (node.type === 'image' || node.type === 'code') {
    return '';
  }
  if ('children' in node && Array.isArray(node.children)) {
    return (node.children as MdastNode[]).map((child) => mdastText(child)).join('');
  }
  return '';
}

/** Rehype transformer: wraps every `table` into a scroll-friendly `<div class="bp-table">`. */
function wrapTablesPlugin() {
  return (tree: HastRoot) => {
    wrapTables(tree);
  };
}

function wrapTables(node: HastRoot | Element): void {
  const children = node.children;
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (child === undefined) {
      continue;
    }
    if (child.type === 'element' && child.tagName === 'table') {
      children[index] = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['bp-table'] },
        children: [child],
      };
      continue;
    }
    if (child.type === 'element') {
      wrapTables(child);
    }
  }
}
