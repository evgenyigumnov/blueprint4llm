import type { PencilNode } from './pencil-schema.js';
import { escapePencilXml, formatPencilSvgNumber } from './pencil-svg-utils.js';

const MAX_PENCIL_TEXT_LINES = 10_000;

interface TextLayout {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  baseline: number;
  anchorX: number;
  anchor: 'start' | 'middle' | 'end';
}

export interface PencilTextBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Renders Pencil text with safe XML escaping and approximate width-based wrapping. */
export function renderPencilText(
  node: PencilNode,
  x: number,
  y: number,
  width: number,
  height: number,
  commonAttributes: string,
): string {
  const layout = createTextLayout(node, x, y, width, height);
  const attributes = [
    `x="${formatPencilSvgNumber(layout.anchorX)}"`,
    `y="${formatPencilSvgNumber(layout.baseline)}"`,
    `text-anchor="${layout.anchor}"`,
    `font-size="${formatPencilSvgNumber(layout.fontSize)}"`,
    `font-family="${escapePencilXml(stringProperty(node, 'fontFamily', 'sans-serif'))}"`,
    `font-weight="${escapePencilXml(String(node.fontWeight ?? '400'))}"`,
    `font-style="${escapePencilXml(stringProperty(node, 'fontStyle', 'normal'))}"`,
    `letter-spacing="${formatPencilSvgNumber(numberProperty(node, 'letterSpacing', 0))}"`,
  ];
  const decorations = [
    node.underline === true ? 'underline' : '',
    node.strikethrough === true ? 'line-through' : '',
  ].filter((decoration) => decoration !== '');
  if (decorations.length > 0) {
    attributes.push(`text-decoration="${decorations.join(' ')}"`);
  }
  const tspans = layout.lines
    .map(
      (line, index) =>
        `<tspan x="${formatPencilSvgNumber(layout.anchorX)}" dy="${index === 0 ? '0' : formatPencilSvgNumber(layout.lineHeight)}">${escapePencilXml(line)}</tspan>`,
    )
    .join('');
  return `<text ${attributes.join(' ')} ${commonAttributes}>${tspans}</text>`;
}

/** Returns the approximate rendered text bounds for a node in the SVG viewBox. */
export function getPencilTextBounds(
  node: PencilNode,
  x: number,
  y: number,
  width: number,
  height: number,
): PencilTextBounds {
  const layout = createTextLayout(node, x, y, width, height);
  const longestLine = Math.max(
    ...layout.lines.map((line) => estimateTextWidth(line, layout.fontSize)),
  );
  const textLeft =
    layout.anchor === 'middle'
      ? layout.anchorX - longestLine / 2
      : layout.anchor === 'end'
        ? layout.anchorX - longestLine
        : layout.anchorX;
  const textTop = layout.baseline - layout.fontSize;
  const textBottom = layout.baseline + Math.max(0, layout.lines.length - 1) * layout.lineHeight;
  return {
    minX: Math.min(x, textLeft),
    minY: Math.min(y, textTop),
    maxX: Math.max(x + width, textLeft + longestLine),
    maxY: Math.max(y + height, textBottom),
  };
}

function createTextLayout(
  node: PencilNode,
  x: number,
  y: number,
  width: number,
  height: number,
): TextLayout {
  const content = typeof node.content === 'string' ? node.content : '';
  assertLineLimit(content, node.id);
  const fontSize = numberProperty(node, 'fontSize', 16);
  const lineHeight = fontSize * numberProperty(node, 'lineHeight', 1.2);
  const wraps = node.textGrowth === 'fixed-width' || node.textGrowth === 'fixed-width-height';
  const lines = wraps ? wrapText(content, fontSize, width, node.id) : content.split(/\r\n|\r|\n/);
  assertRenderedLineLimit(lines.length, node.id);
  const textHeight = Math.max(fontSize, lines.length * lineHeight);
  const layoutHeight = node.textGrowth === 'fixed-width' ? Math.max(height, textHeight) : height;
  const baseline =
    node.textAlignVertical === 'top'
      ? y + fontSize
      : node.textAlignVertical === 'bottom'
        ? y + layoutHeight - textHeight + fontSize
        : y + (layoutHeight - textHeight) / 2 + fontSize;
  const alignment =
    node.textAlign === 'center'
      ? { x: x + width / 2, anchor: 'middle' as const }
      : node.textAlign === 'right'
        ? { x: x + width, anchor: 'end' as const }
        : { x, anchor: 'start' as const };
  return {
    lines,
    fontSize,
    lineHeight,
    baseline,
    anchorX: alignment.x,
    anchor: alignment.anchor,
  };
}

function wrapText(text: string, fontSize: number, width: number, nodeId: string): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r\n|\r|\n/)) {
    if (paragraph === '') {
      appendLine(lines, '', nodeId);
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = '';
    let lineWidth = 0;
    for (const word of words) {
      const wordWidth = estimateTextWidth(word, fontSize);
      const candidateWidth =
        lineWidth + (line === '' ? 0 : estimateTextWidth(' ', fontSize)) + wordWidth;
      if (line !== '' && candidateWidth > width) {
        appendLine(lines, line, nodeId);
        line = '';
      }
      if (wordWidth > width) {
        let tail = '';
        let tailWidth = 0;
        for (const part of splitLongWord(word, fontSize, width)) {
          if (tail !== '') {
            appendLine(lines, tail, nodeId);
          }
          tail = part;
          tailWidth = estimateTextWidth(part, fontSize);
        }
        line = tail;
        lineWidth = tailWidth;
      } else {
        if (line === '') {
          line = word;
          lineWidth = wordWidth;
        } else {
          line = `${line} ${word}`;
          lineWidth = candidateWidth;
        }
      }
    }
    if (line !== '') {
      appendLine(lines, line, nodeId);
    }
  }
  return lines.length === 0 ? [''] : lines;
}

function* splitLongWord(word: string, fontSize: number, width: number): Generator<string> {
  let chunk = '';
  let chunkWidth = 0;
  for (const character of word) {
    const characterWidth = estimateTextWidth(character, fontSize);
    if (chunk !== '' && chunkWidth + characterWidth > width) {
      yield chunk;
      chunk = '';
      chunkWidth = 0;
    }
    chunk += character;
    chunkWidth += characterWidth;
  }
  if (chunk !== '') {
    yield chunk;
  }
}

function estimateTextWidth(text: string, fontSize: number): number {
  let units = 0;
  for (const character of text) {
    if (/\s/.test(character)) {
      units += 0.3;
    } else if (/[ilI1.,:;'!|]/.test(character)) {
      units += 0.3;
    } else if (/[MW@#%&]/.test(character)) {
      units += 0.85;
    } else {
      units += 0.56;
    }
  }
  return units * fontSize;
}

function assertLineLimit(text: string, nodeId: string): void {
  let lineBreaks = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '\r' || character === '\n') {
      lineBreaks += 1;
      if (lineBreaks >= MAX_PENCIL_TEXT_LINES) {
        throw new Error(`Pencil text node "${nodeId}" exceeds ${MAX_PENCIL_TEXT_LINES} lines`);
      }
      if (character === '\r' && text[index + 1] === '\n') {
        index += 1;
      }
    }
  }
}

function appendLine(lines: string[], line: string, nodeId: string): void {
  lines.push(line);
  assertRenderedLineLimit(lines.length, nodeId);
}

function assertRenderedLineLimit(lineCount: number, nodeId: string): void {
  if (lineCount > MAX_PENCIL_TEXT_LINES) {
    throw new Error(`Pencil text node "${nodeId}" exceeds ${MAX_PENCIL_TEXT_LINES} lines`);
  }
}

function numberProperty(node: PencilNode, key: string, fallback: number): number {
  const value = node[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringProperty(node: PencilNode, key: string, fallback: string): string {
  const value = node[key];
  return typeof value === 'string' ? value : fallback;
}
