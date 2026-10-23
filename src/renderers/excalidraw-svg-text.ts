import type { ExcalidrawElement } from './excalidraw-schema.js';
import { formatExcalidrawNumber } from './excalidraw-svg-utils.js';

/** Renders every saved text line without clipping it to the original element height. */
export function renderExcalidrawText(element: ExcalidrawElement): string {
  const text = (element.text ?? '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  const x = textX(element);
  const y = element.y;
  const anchor = textAnchor(element.textAlign);
  const tspans = lines
    .map((line, index) => {
      const lineY = y + index * element.fontSize * element.lineHeight;
      return `<tspan x="${formatExcalidrawNumber(x)}" y="${formatExcalidrawNumber(lineY)}">${escapeExcalidrawXml(line)}</tspan>`;
    })
    .join('');
  return `<text xml:space="preserve" font-family="sans-serif" font-size="${formatExcalidrawNumber(element.fontSize)}" font-weight="400" text-anchor="${anchor}" dominant-baseline="text-before-edge" fill="${escapeExcalidrawXmlAttribute(element.strokeColor)}" stroke="none">${tspans}</text>`;
}

export function escapeExcalidrawXml(value: string): string {
  return value.replace(/[&<>]/g, (character) => {
    if (character === '&') return '&amp;';
    if (character === '<') return '&lt;';
    return '&gt;';
  });
}

export function escapeExcalidrawXmlAttribute(value: string): string {
  return escapeExcalidrawXml(value).replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function textX(element: ExcalidrawElement): number {
  if (element.textAlign === 'center') {
    return element.x + element.width / 2;
  }
  if (element.textAlign === 'right') {
    return element.x + element.width;
  }
  return element.x;
}

function textAnchor(align: ExcalidrawElement['textAlign']): 'start' | 'middle' | 'end' {
  if (align === 'center') {
    return 'middle';
  }
  return align === 'right' ? 'end' : 'start';
}
