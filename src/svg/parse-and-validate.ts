import { fromHtml } from 'hast-util-from-html';
import type { Element, RootContent } from 'hast';

const FORBIDDEN_ELEMENTS = new Set([
  'script',
  'foreignobject',
  'iframe',
  'object',
  'embed',
  'audio',
  'video',
  'canvas',
]);

/** Parses renderer output as HAST and requires one SVG root element. */
export function parseAndValidateSvg(svg: string): Element {
  const tree = fromHtml(svg, { fragment: true });
  const content = tree.children.filter(isSignificantContent);
  if (content.length !== 1 || content[0]?.type !== 'element' || content[0].tagName !== 'svg') {
    throw new Error('diagram renderer output must contain exactly one root <svg> element');
  }
  validateSvgSubtree(content[0]);
  return content[0];
}

function isSignificantContent(node: RootContent): boolean {
  return node.type !== 'text' || node.value.trim().length > 0;
}

function validateSvgSubtree(node: Element): void {
  if (FORBIDDEN_ELEMENTS.has(node.tagName.toLowerCase())) {
    throw new Error(`diagram SVG contains forbidden <${node.tagName}> content`);
  }

  for (const [name, value] of Object.entries(node.properties)) {
    const normalizedName = name.toLowerCase();
    if (normalizedName.startsWith('on')) {
      throw new Error(`diagram SVG contains forbidden event attribute "${name}"`);
    }
    if (normalizedName === 'src') {
      throw new Error('diagram SVG contains a forbidden external resource attribute "src"');
    }

    if (typeof value === 'string') {
      if (
        normalizedName === 'href' ||
        normalizedName === 'xlink:href' ||
        normalizedName === 'xlinkhref'
      ) {
        if (!value.trim().startsWith('#')) {
          throw new Error('diagram SVG contains a non-fragment href reference');
        }
      }
      validateCssReferences(value);
    }
  }

  for (const child of node.children) {
    if (child.type === 'element') {
      validateSvgSubtree(child);
    } else if (node.tagName.toLowerCase() === 'style' && child.type === 'text') {
      validateCssReferences(child.value);
    }
  }
}

function validateCssReferences(value: string): void {
  const normalizedCss = decodeCssEscapes(value).replace(/\/\*[\s\S]*?\*\//g, '');
  if (/@import\b/i.test(normalizedCss)) {
    throw new Error('diagram SVG contains a forbidden CSS @import rule');
  }

  for (const match of normalizedCss.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)) {
    const reference = (match[1] ?? match[2] ?? match[3] ?? '').trim();
    if (!reference.startsWith('#')) {
      throw new Error('diagram SVG contains a non-fragment CSS url() reference');
    }
  }
}

function decodeCssEscapes(value: string): string {
  return value
    .replace(/\\([\da-f]{1,6})(?:\r\n|[\t\n\f\r ])?/gi, (_match, hex: string) => {
      const codePoint = Number.parseInt(hex, 16);
      return codePoint === 0 || codePoint > 0x10ffff ? '\uFFFD' : String.fromCodePoint(codePoint);
    })
    .replace(/\\([^\r\n\f])/g, '$1');
}
