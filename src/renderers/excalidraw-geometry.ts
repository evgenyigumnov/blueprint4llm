import type { ExcalidrawBounds, ExcalidrawElement, ExcalidrawPoint } from './excalidraw-schema.js';
import { isSupportedShapeType } from './excalidraw-schema.js';

export interface ArrowheadGeometry {
  kind: 'arrow' | 'triangle';
  points: ExcalidrawPoint[];
}

/** Returns conservative bounds for an element, including its stroke and arrowheads. */
export function getExcalidrawElementBounds(element: ExcalidrawElement): ExcalidrawBounds {
  const bounds = emptyBounds();
  if (isPlaceholder(element)) {
    const box = placeholderBox(element);
    addRotatedRect(bounds, box.x, box.y, box.width, box.height, element.angle, element);
    expandBounds(bounds, Math.max(element.strokeWidth / 2, 1));
    return bounds;
  }

  if (element.type === 'line' || element.type === 'arrow') {
    const points = scenePoints(element);
    for (const point of points) {
      addRotatedPoint(bounds, point, element);
    }
    for (const atStart of [true, false]) {
      const head = getArrowheadGeometry(element, atStart);
      for (const point of head?.points ?? []) {
        addRotatedPoint(bounds, point, element);
      }
    }
    if (points.every((point) => point.x === points[0]?.x && point.y === points[0]?.y)) {
      const point = rotatePoint(points[0] ?? { x: element.x, y: element.y }, element);
      addPoint(bounds, point, Math.max(element.strokeWidth / 2, 1));
    } else {
      expandBounds(bounds, element.strokeWidth / 2);
    }
    return bounds;
  }

  if (element.type === 'text') {
    if (element.backgroundColor !== 'transparent') {
      addRotatedRect(
        bounds,
        element.x,
        element.y,
        element.width,
        element.height,
        element.angle,
        element,
      );
    }
    addTextBounds(bounds, element);
    return bounds;
  }

  addRotatedRect(
    bounds,
    element.x,
    element.y,
    element.width,
    element.height,
    element.angle,
    element,
  );
  expandBounds(bounds, element.strokeWidth / 2);
  return bounds;
}

/** Creates the geometric points for one supported arrowhead at an endpoint. */
export function getArrowheadGeometry(
  element: ExcalidrawElement,
  atStart: boolean,
): ArrowheadGeometry | undefined {
  const kind = atStart ? element.startArrowhead : element.endArrowhead;
  if (kind === undefined || kind === null || element.points === undefined) {
    return undefined;
  }
  const points = scenePoints(element);
  const endpointIndex = atStart ? 0 : points.length - 1;
  const tip = points[endpointIndex];
  if (tip === undefined) {
    return undefined;
  }
  let neighbor: ExcalidrawPoint | undefined;
  if (atStart) {
    for (let index = 1; index < points.length; index += 1) {
      const candidate = points[index];
      if (candidate !== undefined && distanceSquared(tip, candidate) > 0) {
        neighbor = candidate;
        break;
      }
    }
  } else {
    for (let index = points.length - 2; index >= 0; index -= 1) {
      const candidate = points[index];
      if (candidate !== undefined && distanceSquared(tip, candidate) > 0) {
        neighbor = candidate;
        break;
      }
    }
  }
  if (neighbor === undefined) {
    return undefined;
  }

  let direction = atStart
    ? { x: tip.x - neighbor.x, y: tip.y - neighbor.y }
    : { x: tip.x - neighbor.x, y: tip.y - neighbor.y };
  const length = Math.hypot(direction.x, direction.y);
  if (length === 0) {
    return undefined;
  }
  direction = { x: direction.x / length, y: direction.y / length };
  const size = Math.max(6, Math.min(12, 4 + element.strokeWidth * 2));
  const halfWidth = size * 0.46;
  const base = { x: tip.x - direction.x * size, y: tip.y - direction.y * size };
  const perpendicular = { x: -direction.y * halfWidth, y: direction.x * halfWidth };
  const pointsForHead = [
    tip,
    { x: base.x + perpendicular.x, y: base.y + perpendicular.y },
    { x: base.x - perpendicular.x, y: base.y - perpendicular.y },
  ];
  return {
    kind: kind === 'triangle' ? 'triangle' : 'arrow',
    points: pointsForHead,
  };
}

export function scenePoints(element: ExcalidrawElement): ExcalidrawPoint[] {
  return (element.points ?? []).map((point) => ({
    x: element.x + point.x,
    y: element.y + point.y,
  }));
}

export function rotatePoint(point: ExcalidrawPoint, element: ExcalidrawElement): ExcalidrawPoint {
  if (element.angle === 0) {
    return point;
  }
  const center = { x: element.x + element.width / 2, y: element.y + element.height / 2 };
  const sin = Math.sin(element.angle);
  const cos = Math.cos(element.angle);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos };
}

export function placeholderBox(element: ExcalidrawElement): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const width = Math.max(element.width, 120);
  const height = Math.max(element.height, 32);
  return {
    x: element.x,
    y: element.y,
    width,
    height,
  };
}

export function isPlaceholder(element: ExcalidrawElement): boolean {
  return !isSupportedShapeType(element.type) || (element.type === 'arrow' && element.elbowed);
}

function addTextBounds(bounds: ExcalidrawBounds, element: ExcalidrawElement): void {
  const lines = (element.text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const lineHeight = element.fontSize * element.lineHeight;
  const width = Math.max(
    element.width,
    ...lines.map((line) => approximateTextWidth(line, element.fontSize)),
  );
  let left = element.x;
  if (element.textAlign === 'center') {
    left = element.x + (element.width - width) / 2;
  } else if (element.textAlign === 'right') {
    left = element.x + element.width - width;
  }
  const top = element.y - element.fontSize * 0.25;
  const height = Math.max(
    element.height,
    lineHeight * Math.max(0, lines.length - 1) + element.fontSize * 1.25,
  );
  addRotatedRect(bounds, left, top, width, height, element.angle, element);
}

function approximateTextWidth(text: string, fontSize: number): number {
  // One em per Unicode code point keeps fallback-font glyphs inside the viewBox.
  let codePoints = 0;
  for (const _character of text) {
    codePoints += 1;
  }
  return codePoints * fontSize;
}

function addRotatedRect(
  bounds: ExcalidrawBounds,
  x: number,
  y: number,
  width: number,
  height: number,
  angle: number,
  element?: ExcalidrawElement,
): void {
  const corners = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
  for (const corner of corners) {
    addPoint(bounds, element === undefined || angle === 0 ? corner : rotatePoint(corner, element));
  }
}

function addRotatedPoint(
  bounds: ExcalidrawBounds,
  point: ExcalidrawPoint,
  element: ExcalidrawElement,
): void {
  addPoint(bounds, rotatePoint(point, element));
}

function addPoint(bounds: ExcalidrawBounds, point: ExcalidrawPoint, padding = 0): void {
  bounds.minX = Math.min(bounds.minX, point.x - padding);
  bounds.minY = Math.min(bounds.minY, point.y - padding);
  bounds.maxX = Math.max(bounds.maxX, point.x + padding);
  bounds.maxY = Math.max(bounds.maxY, point.y + padding);
}

function expandBounds(bounds: ExcalidrawBounds, padding: number): void {
  bounds.minX -= padding;
  bounds.minY -= padding;
  bounds.maxX += padding;
  bounds.maxY += padding;
}

function emptyBounds(): ExcalidrawBounds {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

function distanceSquared(left: ExcalidrawPoint, right: ExcalidrawPoint): number {
  return (left.x - right.x) ** 2 + (left.y - right.y) ** 2;
}
