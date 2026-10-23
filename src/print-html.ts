import { fromHtml } from 'hast-util-from-html';
import rehypeStringify from 'rehype-stringify';
import { unified } from 'unified';
import type { Element, Root } from 'hast';

import type { CompiledBlueprint } from './compiler.js';
import { getNotoSansFontCss } from './noto-fonts.js';

const MAX_PDF_IMAGE_BYTES = 20 * 1024 * 1024;

/**
 * Creates the self-contained HTML document that Chromium prints.
 * It starts from the exact HTML emitted by the Markdown compiler.
 */
export async function createPrintHtml(compiled: CompiledBlueprint): Promise<string> {
  const tree = fromHtml(compiled.html);
  const assets = new Map(compiled.assets.map((asset) => [asset.outputUrl, asset]));

  replaceImageSources(tree, assets);
  const head = findElement(tree, 'head');
  if (head === undefined) {
    throw new Error('compiled HTML is missing its <head> element');
  }

  head.children.push({
    type: 'element',
    tagName: 'style',
    properties: {},
    children: [
      {
        type: 'text',
        value: createPrintStyles(
          compiled.html.includes('bp-diagram--d2') ? '' : await getNotoSansFontCss(),
        ),
      },
    ],
  });

  return String(unified().use(rehypeStringify).stringify(tree));
}

function replaceImageSources(
  root: Root,
  assets: ReadonlyMap<string, CompiledBlueprint['assets'][number]>,
): void {
  visitElements(root, (element) => {
    if (element.tagName !== 'img') {
      return;
    }

    const source = getStringProperty(element, 'src');
    if (source === undefined) {
      throw new Error('an image in the compiled HTML is missing its source URL');
    }

    if (/^https?:\/\//i.test(source)) {
      throw new Error(
        `cannot include external image "${source}" in a PDF; save the image next to the Markdown file and use a relative path`,
      );
    }

    const asset = assets.get(source);
    if (asset === undefined) {
      throw new Error(`cannot prepare image "${source}" for PDF; its local asset is unavailable`);
    }
    if (asset.bytes.byteLength > MAX_PDF_IMAGE_BYTES) {
      throw new Error(
        `local image "${asset.originalUrl}" is too large for PDF (${asset.bytes.byteLength} bytes; limit ${MAX_PDF_IMAGE_BYTES} bytes)`,
      );
    }

    element.properties.src = `data:${asset.mimeType};base64,${Buffer.from(asset.bytes).toString('base64')}`;
  });
}

function getStringProperty(element: Element, key: string): string | undefined {
  const value = element.properties[key];
  return typeof value === 'string' ? value : undefined;
}

function findElement(root: Root, tagName: string): Element | undefined {
  let result: Element | undefined;
  visitElements(root, (element) => {
    if (result === undefined && element.tagName === tagName) {
      result = element;
    }
  });
  return result;
}

function visitElements(root: Root | Element, visit: (element: Element) => void): void {
  for (const child of root.children) {
    if (child.type !== 'element') {
      continue;
    }
    visit(child);
    visitElements(child, visit);
  }
}

function createPrintStyles(fontCss: string): string {
  return `${fontCss}

@media print {
  body { font-family: 'Noto Sans', sans-serif; }
  svg text, svg tspan { font-family: 'Noto Sans', sans-serif !important; }
  h1, h2, h3, h4, h5, h6 { break-after: avoid; page-break-after: avoid; }
  img, figure, .bp-diagram { max-width: 100%; break-inside: avoid; page-break-inside: avoid; }
  img { max-height: 220mm; object-fit: contain; }
  .bp-diagram { width: 100%; margin: 6mm 0; padding: 4mm; overflow: visible; }
  .bp-diagram > svg { max-width: 100% !important; max-height: 220mm; object-fit: contain; }
  .bp-table { width: 100%; max-width: 100%; overflow: visible; }
  table { width: 100%; max-width: 100%; table-layout: fixed; }
  thead { display: table-header-group; }
  th, td { overflow-wrap: anywhere; word-break: normal; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  pre { white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
  a { color: inherit; }
  *, *::before, *::after { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;
}
