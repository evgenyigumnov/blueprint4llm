import {
  getArrowheadGeometry,
  isPlaceholder,
  placeholderBox,
  scenePoints,
} from './excalidraw-geometry.js';
import type { ExcalidrawElement, ExcalidrawPoint } from './excalidraw-schema.js';
import { formatExcalidrawNumber, escapeAttribute, escapeText } from './excalidraw-svg-utils.js';
import { escapeExcalidrawXmlAttribute, renderExcalidrawText } from './excalidraw-svg-text.js';

/** Renders one non-deleted element as a self-contained SVG fragment. */
export function renderExcalidrawElement(element: ExcalidrawElement): string {
  const groupIds = element.groupIds.map(escapeAttribute).join(' ');
  const attributes = [
    `data-element-id="${escapeAttribute(element.id)}"`,
    `data-group-ids="${groupIds}"`,
  ];
  if (element.opacity < 100) {
    attributes.push(`opacity="${formatExcalidrawNumber(element.opacity / 100)}"`);
  }
  if (element.angle !== 0) {
    const centerX = element.x + element.width / 2;
    const centerY = element.y + element.height / 2;
    attributes.push(
      `transform="rotate(${formatExcalidrawNumber((element.angle * 180) / Math.PI)} ${formatExcalidrawNumber(centerX)} ${formatExcalidrawNumber(centerY)})"`,
    );
  }
  const body = isPlaceholder(element)
    ? renderPlaceholder(element)
    : renderSupportedElement(element);
  return `<g ${attributes.join(' ')}>${body}</g>`;
}

function renderSupportedElement(element: ExcalidrawElement): string {
  if (element.type === 'text') {
    const background =
      element.backgroundColor === 'transparent'
        ? ''
        : `<rect x="${formatExcalidrawNumber(element.x)}" y="${formatExcalidrawNumber(element.y)}" width="${formatExcalidrawNumber(element.width)}" height="${formatExcalidrawNumber(element.height)}" fill="${escapeAttribute(element.backgroundColor)}" stroke="none"/>`;
    return background + renderExcalidrawText(element);
  }
  if (element.type === 'line' || element.type === 'arrow') {
    return renderLinearElement(element);
  }
  const common = shapeAttributes(element);
  if (element.type === 'ellipse') {
    return `<ellipse cx="${formatExcalidrawNumber(element.x + element.width / 2)}" cy="${formatExcalidrawNumber(element.y + element.height / 2)}" rx="${formatExcalidrawNumber(element.width / 2)}" ry="${formatExcalidrawNumber(element.height / 2)}" ${common}/>`;
  }
  if (element.type === 'diamond') {
    const x = element.x;
    const y = element.y;
    const right = x + element.width;
    const bottom = y + element.height;
    const centerX = x + element.width / 2;
    const centerY = y + element.height / 2;
    return `<polygon points="${formatExcalidrawNumber(centerX)},${formatExcalidrawNumber(y)} ${formatExcalidrawNumber(right)},${formatExcalidrawNumber(centerY)} ${formatExcalidrawNumber(centerX)},${formatExcalidrawNumber(bottom)} ${formatExcalidrawNumber(x)},${formatExcalidrawNumber(centerY)}" ${common}/>`;
  }
  return `<rect x="${formatExcalidrawNumber(element.x)}" y="${formatExcalidrawNumber(element.y)}" width="${formatExcalidrawNumber(element.width)}" height="${formatExcalidrawNumber(element.height)}" ${common}/>`;
}

function renderLinearElement(element: ExcalidrawElement): string {
  const points = scenePoints(element);
  const allSame = points.every((point) => point.x === points[0]?.x && point.y === points[0]?.y);
  if (allSame) {
    const point = points[0] ?? { x: element.x, y: element.y };
    return `<circle cx="${formatExcalidrawNumber(point.x)}" cy="${formatExcalidrawNumber(point.y)}" r="${formatExcalidrawNumber(Math.max(1, element.strokeWidth / 2))}" fill="${escapeAttribute(element.strokeColor)}"/>`;
  }
  const path = points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${formatExcalidrawNumber(point.x)} ${formatExcalidrawNumber(point.y)}`,
    )
    .join(' ');
  const parts = [
    `<path d="${path}" fill="none" ${strokeAttributes(element)}/>`,
    renderArrowhead(element, true),
    renderArrowhead(element, false),
  ];
  return parts.filter(Boolean).join('');
}

function renderArrowhead(element: ExcalidrawElement, atStart: boolean): string {
  const head = getArrowheadGeometry(element, atStart);
  if (head === undefined) {
    return '';
  }
  const [tip, firstBase, secondBase] = head.points;
  if (tip === undefined || firstBase === undefined || secondBase === undefined) {
    return '';
  }
  const formatPoint = (point: ExcalidrawPoint) =>
    `${formatExcalidrawNumber(point.x)} ${formatExcalidrawNumber(point.y)}`;
  if (head.kind === 'triangle') {
    return `<path d="M ${formatPoint(tip)} L ${formatPoint(firstBase)} L ${formatPoint(secondBase)} Z" fill="${escapeAttribute(element.strokeColor)}" stroke="${escapeAttribute(element.strokeColor)}" stroke-width="${formatExcalidrawNumber(element.strokeWidth)}"/>`;
  }
  return `<path d="M ${formatPoint(firstBase)} L ${formatPoint(tip)} L ${formatPoint(secondBase)}" fill="none" ${strokeAttributes(element)}/>`;
}

function renderPlaceholder(element: ExcalidrawElement): string {
  const box = placeholderBox(element);
  const image = element.type === 'image';
  const label = image ? 'Изображение не поддерживается' : `${element.type}: не поддерживается`;
  const x = formatExcalidrawNumber(box.x);
  const y = formatExcalidrawNumber(box.y);
  const width = formatExcalidrawNumber(box.width);
  const height = formatExcalidrawNumber(box.height);
  const centerX = formatExcalidrawNumber(box.x + box.width / 2);
  const centerY = formatExcalidrawNumber(box.y + box.height / 2);
  const stroke = escapeAttribute(element.strokeColor);
  const fontSize = formatExcalidrawNumber(Math.min(16, Math.max(10, element.fontSize)));
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${escapeAttribute(element.backgroundColor)}" stroke="${stroke}" stroke-width="${formatExcalidrawNumber(element.strokeWidth)}" stroke-dasharray="6 4"/><text x="${centerX}" y="${centerY}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="${fontSize}" fill="${stroke}">${escapeText(label)} (${escapeExcalidrawXmlAttribute(element.id)})</text>`;
}

function shapeAttributes(element: ExcalidrawElement): string {
  const fill = element.backgroundColor === 'transparent' ? 'none' : element.backgroundColor;
  return `fill="${escapeAttribute(fill)}" ${strokeAttributes(element)}`;
}

function strokeAttributes(element: ExcalidrawElement): string {
  const dash =
    element.strokeStyle === 'dashed'
      ? ' stroke-dasharray="8 6"'
      : element.strokeStyle === 'dotted'
        ? ' stroke-dasharray="1 5" stroke-linecap="round"'
        : '';
  return `stroke="${escapeAttribute(element.strokeColor)}" stroke-width="${formatExcalidrawNumber(element.strokeWidth)}" stroke-linecap="round" stroke-linejoin="round"${dash}`;
}
