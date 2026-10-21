import type { FigmaNode } from './figma-json.js';
import {
  escapeXml,
  formatNumber,
  formatNodeReference,
  isFiniteNumber,
  isRecord,
  nodeError,
  type FigmaSvgBox,
} from './figma-svg-geometry.js';

export interface FigmaSvgPaint {
  color: string;
  opacity: number;
}

/** Reads visible solid paints and rejects paint types this renderer cannot reproduce. */
export function readNodePaints(node: FigmaNode, property: 'fills' | 'strokes'): FigmaSvgPaint[] {
  const value = node.source[property];
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw nodeError(node, `has invalid ${property}`);
  }

  const paints: FigmaSvgPaint[] = [];
  for (const paint of value) {
    if (!isRecord(paint) || typeof paint.type !== 'string') {
      throw nodeError(node, `has an invalid paint in ${property}`);
    }
    if (paint.visible !== undefined && typeof paint.visible !== 'boolean') {
      throw nodeError(node, `has invalid paint visibility in ${property}`);
    }
    if (paint.visible === false) {
      continue;
    }
    if (paint.type !== 'SOLID') {
      throw new Error(
        `unsupported Figma paint type "${paint.type}" at node ${formatNodeReference(node)}`,
      );
    }
    if (!isRecord(paint.color)) {
      throw nodeError(node, 'has an invalid SOLID paint color');
    }

    const { r, g, b } = paint.color;
    const colorAlpha = paint.color.a ?? 1;
    const paintOpacity = paint.opacity ?? 1;
    if (
      !isUnitInterval(r) ||
      !isUnitInterval(g) ||
      !isUnitInterval(b) ||
      !isUnitInterval(colorAlpha) ||
      !isUnitInterval(paintOpacity)
    ) {
      throw nodeError(node, 'has an invalid SOLID paint color or opacity');
    }

    paints.push({
      color: `#${[r, g, b].map((component) => toHex(component as number)).join('')}`,
      opacity: (colorAlpha as number) * (paintOpacity as number),
    });
  }
  return paints;
}

/** Returns the overall node opacity after validating the Figma value. */
export function readNodeOpacity(node: FigmaNode): number {
  const opacity = node.source.opacity ?? 1;
  if (!isUnitInterval(opacity)) {
    throw nodeError(node, 'has invalid opacity');
  }
  return opacity;
}

export function renderFillElement(shape: string, paint: FigmaSvgPaint): string {
  return addAttributes(shape, [
    ['fill', paint.color],
    ...(paint.opacity === 1
      ? []
      : [['fill-opacity', formatNumber(paint.opacity)] as [string, string]]),
    ['stroke', 'none'],
  ]);
}

export function renderStrokeElement(node: FigmaNode, shape: string, paint: FigmaSvgPaint): string {
  return addAttributes(shape, strokeAttributes(node, paint));
}

function strokeAttributes(node: FigmaNode, paint: FigmaSvgPaint): Array<[string, string]> {
  const weight = node.source.strokeWeight ?? 1;
  if (!isFiniteNumber(weight) || weight < 0) {
    throw nodeError(node, 'has invalid strokeWeight');
  }
  const alignment = node.source.strokeAlign ?? 'CENTER';
  if (alignment !== 'CENTER') {
    throw new Error(
      `unsupported Figma stroke alignment "${String(alignment)}" at node ${formatNodeReference(node)}`,
    );
  }
  const dashArray = node.source.strokeDashes;
  if (dashArray !== undefined && (!Array.isArray(dashArray) || dashArray.length > 0)) {
    throw nodeError(node, 'uses unsupported stroke dashes');
  }
  if (node.source.individualStrokeWeights !== undefined) {
    throw nodeError(node, 'uses unsupported individual stroke weights');
  }
  if (
    Array.isArray(node.source.variableWidthPoints) &&
    node.source.variableWidthPoints.length > 0
  ) {
    throw nodeError(node, 'uses unsupported variable-width strokes');
  }

  const lineCap = readLineCap(node);
  const lineJoin = readLineJoin(node);
  return [
    ['fill', 'none'],
    ['stroke', paint.color],
    ...(paint.opacity === 1
      ? []
      : [['stroke-opacity', formatNumber(paint.opacity)] as [string, string]]),
    ['stroke-width', formatNumber(weight)],
    ['stroke-linecap', lineCap],
    ['stroke-linejoin', lineJoin],
  ];
}

/** Renders a plain text node as selectable SVG text. */
export function renderTextNode(
  node: FigmaNode,
  box: FigmaSvgBox,
  transform: string | undefined,
  fills: readonly FigmaSvgPaint[],
  strokes: readonly FigmaSvgPaint[],
): string {
  const characters = node.source.characters;
  if (typeof characters !== 'string') {
    throw nodeError(node, 'has no text characters string');
  }
  if (characters.length === 0 || (fills.length === 0 && strokes.length === 0)) {
    return '';
  }

  validateTextOverrides(node);
  const styleValue = node.source.style;
  const style = styleValue === undefined ? {} : styleValue;
  if (!isRecord(style)) {
    throw nodeError(node, 'has invalid text style');
  }

  const fontSize = readPositiveStyleNumber(node, style, 'fontSize', 14);
  const fontWeight = readStyleNumber(node, style, 'fontWeight', 400);
  if (fontWeight < 1 || fontWeight > 1000) {
    throw nodeError(node, 'has invalid text fontWeight');
  }
  const letterSpacing = readStyleNumber(node, style, 'letterSpacing', 0);
  const lineHeight = readPositiveStyleNumber(node, style, 'lineHeightPx', fontSize * 1.2);
  const fontFamily = readFontFamily(node, style.fontFamily);
  const italic = style.italic ?? false;
  if (typeof italic !== 'boolean') {
    throw nodeError(node, 'has invalid text italic setting');
  }

  const anchor = readTextAnchor(node, style.textAlignHorizontal);
  const verticalOffset = readVerticalOffset(
    node,
    style.textAlignVertical,
    box,
    characters,
    lineHeight,
  );
  const decoration = readTextDecoration(node, style.textDecoration);
  const textCase = readTextCase(node, style.textCase);
  const lines = characters.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n');
  const firstX = box.x + (anchor === 'middle' ? box.width / 2 : anchor === 'end' ? box.width : 0);
  const firstY = box.y + verticalOffset;
  const xmlText = lines
    .map((line, index) => {
      const text = applyTextCase(line, textCase);
      const position =
        index === 0 ? `y="${formatNumber(firstY)}"` : `dy="${formatNumber(lineHeight)}"`;
      return `<tspan x="${formatNumber(firstX)}" ${position}>${escapeXml(text)}</tspan>`;
    })
    .join('');

  const attributes: Array<[string, string]> = [
    ['font-family', fontFamily],
    ['font-size', formatNumber(fontSize)],
    ['font-weight', formatNumber(fontWeight)],
    ['letter-spacing', formatNumber(letterSpacing)],
    ['text-anchor', anchor],
    ['dominant-baseline', 'text-before-edge'],
    ['xml:space', 'preserve'],
    ...(italic ? [['font-style', 'italic'] as [string, string]] : []),
    ...(decoration === undefined ? [] : [['text-decoration', decoration] as [string, string]]),
    ...(textCase === undefined ? [] : [['text-transform', textCase] as [string, string]]),
    ...(transform === undefined ? [] : [['transform', transform] as [string, string]]),
  ];

  const fillPaints: Array<FigmaSvgPaint | undefined> =
    fills.length === 0 ? [undefined] : [...fills];
  const strokePaints: Array<FigmaSvgPaint | undefined> =
    strokes.length === 0 ? [undefined] : [...strokes];
  const textElements: string[] = [];
  for (const fill of fillPaints) {
    for (const stroke of strokePaints) {
      const paintAttributes: Array<[string, string]> = [
        ...attributes,
        ['fill', fill?.color ?? 'none'],
        ...(fill === undefined || fill.opacity === 1
          ? []
          : [['fill-opacity', formatNumber(fill.opacity)] as [string, string]]),
        ...(stroke === undefined
          ? []
          : strokeAttributes(node, stroke).filter(([name]) => name !== 'fill')),
      ];
      const serializedAttributes = paintAttributes
        .map(([name, value]) => ` ${name}="${escapeXml(value)}"`)
        .join('');
      textElements.push(`<text${serializedAttributes}>${xmlText}</text>`);
    }
  }
  return textElements.join('');
}

export function wrapNodeContent(content: string, opacity: number): string {
  if (content.length === 0) {
    return '';
  }
  const attribute = opacity === 1 ? '' : ` opacity="${formatNumber(opacity)}"`;
  return `<g${attribute}>${content}</g>`;
}

export function addAttributes(element: string, attributes: readonly [string, string][]): string {
  const end = element.endsWith('/>') ? '/>' : '>';
  const body = end === '/>' ? element.slice(0, -2) : element.slice(0, -1);
  return `${body}${attributes.map(([name, value]) => ` ${name}="${escapeXml(value)}"`).join('')}${end}`;
}

function readLineCap(node: FigmaNode): string {
  const value = node.source.strokeCap ?? 'NONE';
  if (value === 'NONE') {
    return 'butt';
  }
  if (value === 'ROUND') {
    return 'round';
  }
  if (value === 'SQUARE') {
    return 'square';
  }
  throw new Error(
    `unsupported Figma stroke cap "${String(value)}" at node ${formatNodeReference(node)}`,
  );
}

function readLineJoin(node: FigmaNode): string {
  const value = node.source.strokeJoin ?? 'MITER';
  if (value === 'MITER') {
    return 'miter';
  }
  if (value === 'ROUND') {
    return 'round';
  }
  if (value === 'BEVEL') {
    return 'bevel';
  }
  throw new Error(
    `unsupported Figma stroke join "${String(value)}" at node ${formatNodeReference(node)}`,
  );
}

function validateTextOverrides(node: FigmaNode): void {
  const overrides = node.source.characterStyleOverrides;
  if (overrides !== undefined) {
    if (
      !Array.isArray(overrides) ||
      overrides.some((value) => !isFiniteNumber(value) || value < 0)
    ) {
      throw nodeError(node, 'has invalid characterStyleOverrides');
    }
    if (overrides.some((value) => value !== 0)) {
      throw nodeError(node, 'uses unsupported per-character text styles');
    }
  }
}

function readFontFamily(node: FigmaNode, value: unknown): string {
  if (value === undefined) {
    return 'sans-serif';
  }
  if (
    typeof value !== 'string' ||
    value.length > 200 ||
    hasControlCharacters(value) ||
    /[;{}]|url\s*\(/i.test(value)
  ) {
    throw nodeError(node, 'has an unsafe or invalid text fontFamily');
  }
  return value.length === 0 ? 'sans-serif' : value;
}

function readTextAnchor(node: FigmaNode, value: unknown): 'start' | 'middle' | 'end' {
  const alignment = value ?? 'LEFT';
  if (alignment === 'LEFT' || alignment === 'JUSTIFIED') {
    return 'start';
  }
  if (alignment === 'CENTER') {
    return 'middle';
  }
  if (alignment === 'RIGHT') {
    return 'end';
  }
  throw nodeError(node, 'has invalid textAlignHorizontal');
}

function readVerticalOffset(
  node: FigmaNode,
  value: unknown,
  box: FigmaSvgBox,
  characters: string,
  lineHeight: number,
): number {
  const alignment = value ?? 'TOP';
  if (alignment !== 'TOP' && alignment !== 'CENTER' && alignment !== 'BOTTOM') {
    throw nodeError(node, 'has invalid textAlignVertical');
  }
  if (alignment === 'TOP') {
    return 0;
  }
  const lines = characters.split(/\r\n|\r|\n/).length;
  const textHeight = lines * lineHeight;
  return alignment === 'CENTER'
    ? Math.max(0, (box.height - textHeight) / 2)
    : Math.max(0, box.height - textHeight);
}

function readTextDecoration(node: FigmaNode, value: unknown): string | undefined {
  const decoration = value ?? 'NONE';
  if (decoration === 'NONE') {
    return undefined;
  }
  if (decoration === 'UNDERLINE') {
    return 'underline';
  }
  if (decoration === 'STRIKETHROUGH') {
    return 'line-through';
  }
  throw nodeError(node, 'has unsupported textDecoration');
}

function readTextCase(
  node: FigmaNode,
  value: unknown,
): 'uppercase' | 'lowercase' | 'capitalize' | undefined {
  const textCase = value ?? 'ORIGINAL';
  if (textCase === 'ORIGINAL') {
    return undefined;
  }
  if (textCase === 'UPPER') {
    return 'uppercase';
  }
  if (textCase === 'LOWER') {
    return 'lowercase';
  }
  if (textCase === 'TITLE') {
    return 'capitalize';
  }
  throw nodeError(node, 'has unsupported textCase');
}

function applyTextCase(value: string, textCase: string | undefined): string {
  if (textCase === 'uppercase') {
    return value.toUpperCase();
  }
  if (textCase === 'lowercase') {
    return value.toLowerCase();
  }
  if (textCase === 'capitalize') {
    return value.replace(/(^|\s)\S/g, (character) => character.toUpperCase());
  }
  return value;
}

function readPositiveStyleNumber(
  node: FigmaNode,
  style: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const value = readStyleNumber(node, style, key, fallback);
  if (value <= 0) {
    throw nodeError(node, `has invalid text ${key}`);
  }
  return value;
}

function readStyleNumber(
  node: FigmaNode,
  style: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const value = style[key] ?? fallback;
  if (!isFiniteNumber(value)) {
    throw nodeError(node, `has invalid text ${key}`);
  }
  return value;
}

function isUnitInterval(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0 && value <= 1;
}

function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0)!;
    return codePoint < 0x20 || (codePoint >= 0x7f && codePoint <= 0x9f);
  });
}

function toHex(value: number): string {
  return Math.round(value * 255)
    .toString(16)
    .padStart(2, '0');
}
