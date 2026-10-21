import path from 'node:path';

import rehypeShiki, { type RehypeShikiOptions } from '@shikijs/rehype';
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
import { plantumlRenderer } from './renderers/plantuml.js';
import { wiremarkRenderer } from './renderers/wiremark.js';
import { figmaRenderer } from './renderers/figma.js';
import type { DiagramRenderCache } from './renderers/cache.js';
import { resolveFigmaAccessToken } from './renderers/figma-token.js';
import { renderHtmlPage } from './template.js';

export type { LocalAsset } from './assets.js';

/** Hard limit for the source Markdown size (plan §8.4). */
export const MAX_MARKDOWN_BYTES = 5 * 1024 * 1024;

/** Maximum UTF-8 size for syntax highlighting; larger fences stay plain escaped code. */
export const MAX_HIGHLIGHTED_CODE_BYTES = 64 * 1024;

const SHIKI_OPTIONS: RehypeShikiOptions = {
  themes: { light: 'github-light', dark: 'github-dark' },
  defaultColor: false,
  langs: ['json'],
  lazy: true,
  addLanguageClass: true,
  onError: () => undefined,
};
const SHIKI_PROCESSOR = unified().use(rehypeShiki, SHIKI_OPTIONS);

export interface CompileOptions {
  /** Path of the source Markdown file, used for diagnostics and the title fallback. */
  sourceFile: string;
  /** Optional cache shared across successive live-preview builds. */
  diagramCache?: DiagramRenderCache;
  /** Figma personal access token for URL blocks. Overrides the environment and `.env` file. */
  figmaAccessToken?: string;
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

export interface MarkdownCheckResult {
  warnings: string[];
  errors: string[];
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
  assertMarkdownSize(markdown, options.sourceFile);
  const figmaAccessToken = await resolveFigmaAccessToken(options.figmaAccessToken);

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
      renderers: [mermaidRenderer, plantumlRenderer, wiremarkRenderer, figmaRenderer],
      sourceFile: options.sourceFile,
      warnings,
      errors,
      ...(figmaAccessToken === undefined ? {} : { figmaAccessToken }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(options.diagramCache === undefined ? {} : { cache: options.diagramCache }),
    })
    .use(remarkRehype, {
      handlers: {
        // Raw HTML from untrusted Markdown is escaped, never executed (plan §8.3).
        html: (_h, node) => ({ type: 'text', value: node.value }),
      },
    })
    .use(rehypeShikiWhenNeeded)
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

/** Checks Markdown, supported diagrams, and local image references without serializing HTML. */
export async function checkMarkdown(
  markdown: string,
  options: CompileOptions,
): Promise<MarkdownCheckResult> {
  assertMarkdownSize(markdown, options.sourceFile);
  const figmaAccessToken = await resolveFigmaAccessToken(options.figmaAccessToken);

  const warnings: string[] = [];
  const errors: string[] = [];
  const assets: LocalAsset[] = [];
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkLocalAssetsPlugin, {
      sourceFile: options.sourceFile,
      assets,
      ...(options.watchPaths === undefined ? {} : { watchPaths: options.watchPaths }),
    })
    .use(remarkDiagramPlugin, {
      renderers: [mermaidRenderer, plantumlRenderer, wiremarkRenderer, figmaRenderer],
      sourceFile: options.sourceFile,
      warnings,
      errors,
      ...(figmaAccessToken === undefined ? {} : { figmaAccessToken }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(options.diagramCache === undefined ? {} : { cache: options.diagramCache }),
    })
    .use(remarkRehype, {
      handlers: {
        html: (_h, node) => ({ type: 'text', value: node.value }),
      },
    })
    .use(rehypeDiagramContainersPlugin)
    .use(remarkSafeLinksPlugin)
    .use(wrapTablesPlugin);

  try {
    const tree = processor.parse(markdown);
    await processor.run(tree);
  } catch (error) {
    throw toDiagnosticError(error, 'Markdown check failed', {
      sourceFile: options.sourceFile,
    });
  }

  return { warnings, errors };
}

function assertMarkdownSize(markdown: string, sourceFile: string): void {
  const byteLength = Buffer.byteLength(markdown, 'utf8');
  if (byteLength > MAX_MARKDOWN_BYTES) {
    throw new DiagnosticError(
      `source Markdown is too large: ${byteLength} bytes (limit ${MAX_MARKDOWN_BYTES} bytes)`,
      { sourceFile },
    );
  }
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

/** Avoids loading Shiki themes for documents without a labeled code fence. */
function rehypeShikiWhenNeeded() {
  return async (tree: HastRoot): Promise<HastRoot | undefined> => {
    const skippedCode = skipOversizedCodeFences(tree);
    try {
      if (!containsLabeledCodeFence(tree)) {
        return;
      }
      return (await SHIKI_PROCESSOR.run(tree)) as HastRoot;
    } finally {
      for (const { code, className } of skippedCode) {
        code.properties.className = className;
      }
    }
  };
}

function skipOversizedCodeFences(
  node: HastRoot | Element,
  skipped: Array<{ code: Element; className: string[] }> = [],
): Array<{ code: Element; className: string[] }> {
  for (const child of node.children) {
    if (child.type !== 'element') {
      continue;
    }
    if (child.tagName === 'pre') {
      const code = child.children.find(
        (candidate): candidate is Element =>
          candidate.type === 'element' && candidate.tagName === 'code',
      );
      const className = code?.properties.className;
      const classes = Array.isArray(className)
        ? className.filter((value): value is string => typeof value === 'string')
        : [];
      if (
        code !== undefined &&
        classes.some(
          (value) => value.startsWith('language-') && value.length > 'language-'.length,
        ) &&
        hastByteLength(code) > MAX_HIGHLIGHTED_CODE_BYTES
      ) {
        skipped.push({ code, className: classes });
        const remainingClasses = classes.filter((value) => !value.startsWith('language-'));
        if (remainingClasses.length === 0) {
          delete code.properties.className;
        } else {
          code.properties.className = remainingClasses;
        }
      }
    }
    skipOversizedCodeFences(child, skipped);
  }
  return skipped;
}

function hastByteLength(node: HastRoot | Element): number {
  return node.children.reduce((total, child) => {
    if (child.type === 'text') {
      return total + Buffer.byteLength(child.value, 'utf8');
    }
    return child.type === 'element' ? total + hastByteLength(child) : total;
  }, 0);
}

function containsLabeledCodeFence(node: HastRoot | Element): boolean {
  for (const child of node.children) {
    if (child.type !== 'element') {
      continue;
    }
    if (child.tagName === 'pre') {
      const code = child.children.find(
        (candidate): candidate is Element =>
          candidate.type === 'element' && candidate.tagName === 'code',
      );
      const classes = code?.properties.className;
      if (
        Array.isArray(classes) &&
        classes.some(
          (className) =>
            typeof className === 'string' &&
            className.startsWith('language-') &&
            className.length > 'language-'.length,
        )
      ) {
        return true;
      }
    }
    if (containsLabeledCodeFence(child)) {
      return true;
    }
  }
  return false;
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
