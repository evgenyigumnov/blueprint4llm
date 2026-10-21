import type { PencilLayout, PencilLayoutNode } from './pencil-layout.js';
import type { PencilNode } from './pencil-schema.js';
import { getPencilVisualBounds } from './pencil-svg-bounds.js';
import { renderPencilText } from './pencil-svg-text.js';
import { escapePencilXml, formatPencilSvgNumber } from './pencil-svg-utils.js';

const MAX_PENCIL_SVG_BYTES = 4 * 1024 * 1024;
const MAX_PENCIL_SVG_SIDE = 16_384;

interface RenderState {
  nextClipId: number;
}

/** Converts the Pencil layout into a bounded, self-contained SVG. */
export function renderPencilSvg(layout: PencilLayout): string {
  const state: RenderState = { nextClipId: 1 };
  const children = layout.children.map((node) => renderNode(node, state)).join('');
  const bounds = getPencilVisualBounds(layout.children);
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  if (width > MAX_PENCIL_SVG_SIDE || height > MAX_PENCIL_SVG_SIDE) {
    throw new Error(
      `Pencil SVG is too large: ${formatPencilSvgNumber(width)} × ${formatPencilSvgNumber(height)} px (limit ${MAX_PENCIL_SVG_SIDE} px per side)`,
    );
  }

  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg"',
    ` width="${formatPencilSvgNumber(width)}" height="${formatPencilSvgNumber(height)}"`,
    ` viewBox="${formatPencilSvgNumber(bounds.minX)} ${formatPencilSvgNumber(bounds.minY)} ${formatPencilSvgNumber(width)} ${formatPencilSvgNumber(height)}">`,
    '<title>Pencil diagram</title>',
    children,
    '</svg>',
  ].join('');
  const byteLength = Buffer.byteLength(svg, 'utf8');
  if (byteLength > MAX_PENCIL_SVG_BYTES) {
    throw new Error(
      `Pencil SVG is too large: ${byteLength} bytes (limit ${MAX_PENCIL_SVG_BYTES} bytes)`,
    );
  }
  return svg;
}

function renderNode(node: PencilLayoutNode, state: RenderState): string {
  const { node: pencilNode, x, y, width, height } = node;
  const parts = [renderShape(pencilNode, x, y, width, height)];
  const children = node.children.map((child) => renderNode(child, state)).join('');
  if (children !== '') {
    parts.push(
      pencilNode.type === 'frame' && pencilNode.clip === true
        ? renderClippedChildren(pencilNode, children, x, y, width, height, state)
        : children,
    );
  }

  const attributes: string[] = [];
  const rotation = numberProperty(pencilNode, 'rotation', 0);
  if (rotation !== 0) {
    // SVG uses clockwise-positive angles; Pencil uses counter-clockwise angles.
    attributes.push(
      `transform="rotate(${formatPencilSvgNumber(-rotation)} ${formatPencilSvgNumber(x)} ${formatPencilSvgNumber(y)})"`,
    );
  }
  const opacity = numberProperty(pencilNode, 'opacity', 1);
  if (opacity < 1) {
    attributes.push(`opacity="${formatPencilSvgNumber(opacity)}"`);
  }
  return `<g${attributes.length === 0 ? '' : ` ${attributes.join(' ')}`}>${parts.join('')}</g>`;
}

function renderClippedChildren(
  node: PencilNode,
  children: string,
  x: number,
  y: number,
  width: number,
  height: number,
  state: RenderState,
): string {
  const id = `pencil-clip-${state.nextClipId}`;
  state.nextClipId += 1;
  const shape = roundedRectanglePath(node.cornerRadius, x, y, width, height);
  const clipShape =
    shape === undefined
      ? `<rect x="${formatPencilSvgNumber(x)}" y="${formatPencilSvgNumber(y)}" width="${formatPencilSvgNumber(width)}" height="${formatPencilSvgNumber(height)}"/>`
      : `<path d="${escapePencilXml(shape)}"/>`;
  return `<defs><clipPath id="${id}" clipPathUnits="userSpaceOnUse">${clipShape}</clipPath></defs><g clip-path="url(#${id})">${children}</g>`;
}

function renderShape(
  node: PencilNode,
  x: number,
  y: number,
  width: number,
  height: number,
): string {
  const common = paintAttributes(node);
  switch (node.type) {
    case 'frame':
    case 'rectangle': {
      const roundedPath = roundedRectanglePath(node.cornerRadius, x, y, width, height);
      if (roundedPath !== undefined) {
        return `<path d="${escapePencilXml(roundedPath)}" ${common}/>`;
      }
      return `<rect x="${formatPencilSvgNumber(x)}" y="${formatPencilSvgNumber(y)}" width="${formatPencilSvgNumber(width)}" height="${formatPencilSvgNumber(height)}" ${common}/>`;
    }
    case 'group':
      return node.fill === undefined && node.stroke === undefined
        ? ''
        : `<rect x="${formatPencilSvgNumber(x)}" y="${formatPencilSvgNumber(y)}" width="${formatPencilSvgNumber(width)}" height="${formatPencilSvgNumber(height)}" ${common}/>`;
    case 'ellipse':
      return `<ellipse cx="${formatPencilSvgNumber(x + width / 2)}" cy="${formatPencilSvgNumber(y + height / 2)}" rx="${formatPencilSvgNumber(width / 2)}" ry="${formatPencilSvgNumber(height / 2)}" ${common}/>`;
    case 'polygon':
      return `<polygon points="${polygonPoints(node, x, y, width, height)}" ${common}/>`;
    case 'path':
      return renderPath(node, x, y, width, height, common);
    case 'text':
      return renderPencilText(node, x, y, width, height, common);
  }
}

function renderPath(
  node: PencilNode,
  x: number,
  y: number,
  width: number,
  height: number,
  common: string,
): string {
  const geometry = typeof node.geometry === 'string' ? node.geometry : '';
  const pathViewBox: number[] = Array.isArray(node.viewBox) ? node.viewBox : [0, 0, width, height];
  const [viewX, viewY, viewWidth, viewHeight] = pathViewBox as [number, number, number, number];
  const transform =
    viewX === 0 && viewY === 0 && viewWidth === width && viewHeight === height
      ? `translate(${formatPencilSvgNumber(x)} ${formatPencilSvgNumber(y)})`
      : `translate(${formatPencilSvgNumber(x)} ${formatPencilSvgNumber(y)}) scale(${formatPencilSvgNumber(width / viewWidth)} ${formatPencilSvgNumber(height / viewHeight)}) translate(${formatPencilSvgNumber(-viewX)} ${formatPencilSvgNumber(-viewY)})`;
  const fillRule = node.fillRule === 'evenodd' ? ' fill-rule="evenodd"' : '';
  return `<path d="${escapePencilXml(geometry)}" transform="${transform}"${fillRule} ${common}/>`;
}

function polygonPoints(
  node: PencilNode,
  x: number,
  y: number,
  width: number,
  height: number,
): string {
  const count = numberProperty(node, 'polygonCount', 6);
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
    return `${formatPencilSvgNumber(centerX + (Math.cos(angle) * width) / 2)},${formatPencilSvgNumber(centerY + (Math.sin(angle) * height) / 2)}`;
  }).join(' ');
}

function roundedRectanglePath(
  value: unknown,
  x: number,
  y: number,
  width: number,
  height: number,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const rawRadii = Array.isArray(value) ? value : [value, value, value, value];
  let [topLeft, topRight, bottomRight, bottomLeft] = rawRadii.map((radius) =>
    typeof radius === 'number' ? Math.max(0, radius) : 0,
  );
  const scale = Math.min(
    1,
    ratioToFit(width, topLeft! + topRight!),
    ratioToFit(width, bottomLeft! + bottomRight!),
    ratioToFit(height, topLeft! + bottomLeft!),
    ratioToFit(height, topRight! + bottomRight!),
  );
  topLeft! *= scale;
  topRight! *= scale;
  bottomRight! *= scale;
  bottomLeft! *= scale;
  if (topLeft === 0 && topRight === 0 && bottomRight === 0 && bottomLeft === 0) {
    return undefined;
  }
  return [
    `M ${formatPencilSvgNumber(x + topLeft!)} ${formatPencilSvgNumber(y)}`,
    `H ${formatPencilSvgNumber(x + width - topRight!)}`,
    `A ${formatPencilSvgNumber(topRight!)} ${formatPencilSvgNumber(topRight!)} 0 0 1 ${formatPencilSvgNumber(x + width)} ${formatPencilSvgNumber(y + topRight!)}`,
    `V ${formatPencilSvgNumber(y + height - bottomRight!)}`,
    `A ${formatPencilSvgNumber(bottomRight!)} ${formatPencilSvgNumber(bottomRight!)} 0 0 1 ${formatPencilSvgNumber(x + width - bottomRight!)} ${formatPencilSvgNumber(y + height)}`,
    `H ${formatPencilSvgNumber(x + bottomLeft!)}`,
    `A ${formatPencilSvgNumber(bottomLeft!)} ${formatPencilSvgNumber(bottomLeft!)} 0 0 1 ${formatPencilSvgNumber(x)} ${formatPencilSvgNumber(y + height - bottomLeft!)}`,
    `V ${formatPencilSvgNumber(y + topLeft!)}`,
    `A ${formatPencilSvgNumber(topLeft!)} ${formatPencilSvgNumber(topLeft!)} 0 0 1 ${formatPencilSvgNumber(x + topLeft!)} ${formatPencilSvgNumber(y)} Z`,
  ].join(' ');
}

function ratioToFit(side: number, radiusSum: number): number {
  return radiusSum === 0 ? 1 : Math.min(1, side / radiusSum);
}

function paintAttributes(node: PencilNode): string {
  const fill =
    node.type === 'text' && node.fill === undefined ? '#000000' : readPaint(node.fill, 'none');
  const stroke = readPaint(node.stroke, 'none');
  const attributes = [`fill="${escapePencilXml(fill)}"`, `stroke="${escapePencilXml(stroke)}"`];
  if (node.strokeWidth !== undefined) {
    attributes.push(
      `stroke-width="${formatPencilSvgNumber(numberProperty(node, 'strokeWidth', 0))}"`,
    );
  }
  if (typeof node.strokeLinecap === 'string') {
    attributes.push(`stroke-linecap="${escapePencilXml(node.strokeLinecap)}"`);
  }
  if (typeof node.strokeLinejoin === 'string') {
    attributes.push(`stroke-linejoin="${escapePencilXml(node.strokeLinejoin)}"`);
  }
  return attributes.join(' ');
}

function readPaint(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const paint = value as Record<string, unknown>;
    if (paint.enabled === false) {
      return fallback;
    }
    return typeof paint.color === 'string' ? paint.color : fallback;
  }
  return fallback;
}

function numberProperty(node: PencilNode, key: string, fallback: number): number {
  const value = node[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
