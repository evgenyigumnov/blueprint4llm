import type { PencilLayoutNode } from './pencil-layout.js';
import type { PencilNode } from './pencil-schema.js';
import { getPencilTextBounds } from './pencil-svg-text.js';

interface Matrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Includes rotated nodes, parent transforms, and strokes in the SVG viewBox. */
export function getPencilVisualBounds(nodes: PencilLayoutNode[]): Bounds {
  const bounds: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const node of nodes) {
    collectVisualBounds(node, identityMatrix(), bounds);
  }
  if (bounds.minX === Infinity) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  }
  // Leave one pixel for antialiasing and strokes at rounded boundaries.
  bounds.minX -= 1;
  bounds.minY -= 1;
  bounds.maxX += 1;
  bounds.maxY += 1;
  return bounds;
}

function collectVisualBounds(node: PencilLayoutNode, parent: Matrix, bounds: Bounds): void {
  const { x, y, width, height, node: pencilNode } = node;
  const rotation = numberProperty(pencilNode, 'rotation', 0);
  const transform = multiply(parent, rotationMatrix(-rotation, x, y));
  const strokeExpansion = numberProperty(pencilNode, 'strokeWidth', 0) / 2;
  const textBounds =
    pencilNode.type === 'text' ? getPencilTextBounds(pencilNode, x, y, width, height) : undefined;
  const minX = (textBounds?.minX ?? x) - strokeExpansion;
  const minY = (textBounds?.minY ?? y) - strokeExpansion;
  const maxX = (textBounds?.maxX ?? x + width) + strokeExpansion;
  const maxY = (textBounds?.maxY ?? y + height) + strokeExpansion;
  const points = [
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
  ];
  for (const [pointX, pointY] of points) {
    const point = applyMatrix(transform, pointX!, pointY!);
    bounds.minX = Math.min(bounds.minX, point.x);
    bounds.minY = Math.min(bounds.minY, point.y);
    bounds.maxX = Math.max(bounds.maxX, point.x);
    bounds.maxY = Math.max(bounds.maxY, point.y);
  }
  for (const child of node.children) {
    collectVisualBounds(child, transform, bounds);
  }
}

function identityMatrix(): Matrix {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

function rotationMatrix(degrees: number, x: number, y: number): Matrix {
  const radians = (degrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    a: cosine,
    b: sine,
    c: -sine,
    d: cosine,
    e: x - cosine * x + sine * y,
    f: y - sine * x - cosine * y,
  };
}

function multiply(left: Matrix, right: Matrix): Matrix {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  };
}

function applyMatrix(matrix: Matrix, x: number, y: number): { x: number; y: number } {
  return {
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  };
}

function numberProperty(node: PencilNode, key: string, fallback: number): number {
  const value = node[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
