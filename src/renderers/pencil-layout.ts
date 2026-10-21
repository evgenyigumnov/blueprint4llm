import type { PencilDocument, PencilNode } from './pencil-schema.js';

const MAX_PENCIL_LAYOUT_SIDE = 16_384;

export interface PencilLayoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PencilLayoutNode extends PencilLayoutBox {
  node: PencilNode;
  children: PencilLayoutNode[];
}

export interface PencilLayout {
  children: PencilLayoutNode[];
  bounds: PencilLayoutBox;
}

interface MeasuredNode {
  node: PencilNode;
  x: number;
  y: number;
  width: number;
  height: number;
  children: MeasuredNode[];
}

interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface Extents {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  hasItems: boolean;
}

/** Computes absolute node coordinates, simple flex layouts, and the artwork bounds. */
export function layoutPencilDocument(document: PencilDocument): PencilLayout {
  const measured = document.children.filter(isEnabled).map((node) => measureNode(node));
  const children = measured.map((node) => placeNode(node, 0, 0));
  const extents = createExtents();
  children.forEach((node) => collectExtents(node, extents));

  const bounds = extents.hasItems
    ? {
        x: extents.minX,
        y: extents.minY,
        width: extents.maxX - extents.minX,
        height: extents.maxY - extents.minY,
      }
    : { x: 0, y: 0, width: 0, height: 0 };
  assertBoundsWithinLimit(bounds);
  return { children, bounds };
}

function measureNode(node: PencilNode): MeasuredNode {
  const children = (Array.isArray(node.children) ? node.children : [])
    .filter(isEnabled)
    .map((child) => measureNode(child));
  const isContainer = node.type === 'frame' || node.type === 'group';
  if (!isContainer && (node.width === undefined || node.height === undefined)) {
    throw new Error(`Pencil ${node.type} node "${node.id}" must specify width and height`);
  }
  const padding = readPadding(node.padding);
  const layout = isContainer ? readLayout(node) : 'none';
  const gap = numberProperty(node, 'gap', 0);

  let width = numberProperty(node, 'width', 0);
  let height = numberProperty(node, 'height', 0);
  if (isContainer && layout !== 'none') {
    const naturalSize = getFlexNaturalSize(children, layout, padding, gap);
    width = numberProperty(node, 'width', naturalSize.width);
    height = numberProperty(node, 'height', naturalSize.height);
    positionFlexChildren(children, layout, width, height, padding, gap, node);
  } else if (isContainer) {
    const naturalSize = getAbsoluteNaturalSize(children, padding);
    width = numberProperty(node, 'width', naturalSize.width);
    height = numberProperty(node, 'height', naturalSize.height);
  }

  return {
    node,
    x: numberProperty(node, 'x', 0),
    y: numberProperty(node, 'y', 0),
    width,
    height,
    children,
  };
}

function readLayout(node: PencilNode): 'none' | 'horizontal' | 'vertical' {
  if (node.layout === 'none' || node.layout === 'vertical' || node.layout === 'horizontal') {
    return node.layout;
  }
  return node.type === 'frame' ? 'horizontal' : 'none';
}

function getFlexNaturalSize(
  children: MeasuredNode[],
  layout: 'horizontal' | 'vertical',
  padding: Padding,
  gap: number,
): { width: number; height: number } {
  const horizontal = layout === 'horizontal';
  const mainSize = children.reduce(
    (total, child) => total + (horizontal ? child.width : child.height),
    0,
  );
  const crossSize = children.reduce(
    (maximum, child) => Math.max(maximum, horizontal ? child.height : child.width),
    0,
  );
  const gaps = Math.max(0, children.length - 1) * gap;
  return horizontal
    ? {
        width: padding.left + mainSize + gaps + padding.right,
        height: padding.top + crossSize + padding.bottom,
      }
    : {
        width: padding.left + crossSize + padding.right,
        height: padding.top + mainSize + gaps + padding.bottom,
      };
}

function positionFlexChildren(
  children: MeasuredNode[],
  layout: 'horizontal' | 'vertical',
  width: number,
  height: number,
  padding: Padding,
  gap: number,
  container: PencilNode,
): void {
  if (children.length === 0) {
    return;
  }

  const horizontal = layout === 'horizontal';
  const innerMainSize = Math.max(
    0,
    horizontal ? width - padding.left - padding.right : height - padding.top - padding.bottom,
  );
  const innerCrossSize = Math.max(
    0,
    horizontal ? height - padding.top - padding.bottom : width - padding.left - padding.right,
  );
  const usedMainSize = children.reduce(
    (total, child) => total + (horizontal ? child.width : child.height),
    0,
  );
  const configuredGaps = Math.max(0, children.length - 1) * gap;
  const freeSpace = Math.max(0, innerMainSize - usedMainSize - configuredGaps);
  const justifyContent = readEnum(
    container.justifyContent,
    ['start', 'center', 'end', 'space_between', 'space_around'] as const,
    'start',
  );
  const alignItems = readEnum(container.alignItems, ['start', 'center', 'end'] as const, 'start');
  const mainOffset = getMainOffset(justifyContent, freeSpace, children.length);
  const extraGap = getExtraGap(justifyContent, freeSpace, children.length);
  let cursor = horizontal ? padding.left : padding.top;
  cursor += mainOffset;

  for (const child of children) {
    const childMainSize = horizontal ? child.width : child.height;
    const childCrossSize = horizontal ? child.height : child.width;
    const crossOffset = getCrossOffset(alignItems, innerCrossSize - childCrossSize);
    if (horizontal) {
      child.x = cursor;
      child.y = padding.top + crossOffset;
    } else {
      child.x = padding.left + crossOffset;
      child.y = cursor;
    }
    cursor += childMainSize + gap + extraGap;
  }
}

function getMainOffset(
  justifyContent: 'start' | 'center' | 'end' | 'space_between' | 'space_around',
  freeSpace: number,
  count: number,
): number {
  if (justifyContent === 'center') {
    return freeSpace / 2;
  }
  if (justifyContent === 'end') {
    return freeSpace;
  }
  if (justifyContent === 'space_around' && count > 0) {
    return freeSpace / (count * 2);
  }
  return 0;
}

function getExtraGap(
  justifyContent: 'start' | 'center' | 'end' | 'space_between' | 'space_around',
  freeSpace: number,
  count: number,
): number {
  if (justifyContent === 'space_between' && count > 1) {
    return freeSpace / (count - 1);
  }
  if (justifyContent === 'space_around' && count > 0) {
    return freeSpace / count;
  }
  return 0;
}

function getCrossOffset(alignItems: 'start' | 'center' | 'end', freeSpace: number): number {
  const available = Math.max(0, freeSpace);
  if (alignItems === 'center') {
    return available / 2;
  }
  if (alignItems === 'end') {
    return available;
  }
  return 0;
}

function getAbsoluteNaturalSize(
  children: MeasuredNode[],
  padding: Padding,
): { width: number; height: number } {
  let maxRight = 0;
  let maxBottom = 0;
  for (const child of children) {
    maxRight = Math.max(maxRight, child.x + child.width);
    maxBottom = Math.max(maxBottom, child.y + child.height);
  }
  return {
    width: Math.max(0, maxRight) + padding.left + padding.right,
    height: Math.max(0, maxBottom) + padding.top + padding.bottom,
  };
}

function readPadding(value: unknown): Padding {
  if (typeof value === 'number') {
    return { top: value, right: value, bottom: value, left: value };
  }
  if (!Array.isArray(value)) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  if (value.length === 2) {
    const vertical = numeric(value[0]);
    const horizontal = numeric(value[1]);
    return { top: vertical, right: horizontal, bottom: vertical, left: horizontal };
  }
  if (value.length === 4) {
    return {
      top: numeric(value[0]),
      right: numeric(value[1]),
      bottom: numeric(value[2]),
      left: numeric(value[3]),
    };
  }
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

function numeric(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function numberProperty(node: PencilNode, key: string, fallback: number): number {
  const value = node[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number],
): T[number] {
  return allowed.find((candidate) => candidate === value) ?? fallback;
}

function isEnabled(node: PencilNode): boolean {
  return node.enabled !== false;
}

function placeNode(node: MeasuredNode, parentX: number, parentY: number): PencilLayoutNode {
  const x = parentX + node.x;
  const y = parentY + node.y;
  return {
    node: node.node,
    x,
    y,
    width: node.width,
    height: node.height,
    children: node.children.map((child) => placeNode(child, x, y)),
  };
}

function createExtents(): Extents {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, hasItems: false };
}

function collectExtents(node: PencilLayoutNode, extents: Extents): void {
  if (node.width > 0 || node.height > 0) {
    extents.minX = Math.min(extents.minX, node.x);
    extents.minY = Math.min(extents.minY, node.y);
    extents.maxX = Math.max(extents.maxX, node.x + node.width);
    extents.maxY = Math.max(extents.maxY, node.y + node.height);
    extents.hasItems = true;
  }
  node.children.forEach((child) => collectExtents(child, extents));
}

function assertBoundsWithinLimit(bounds: PencilLayoutBox): void {
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  const values = [bounds.x, bounds.y, right, bottom, bounds.width, bounds.height];
  if (
    values.some((value) => !Number.isFinite(value)) ||
    values.some((value) => Math.abs(value) > MAX_PENCIL_LAYOUT_SIDE) ||
    bounds.width > MAX_PENCIL_LAYOUT_SIDE ||
    bounds.height > MAX_PENCIL_LAYOUT_SIDE
  ) {
    throw new Error(
      `Pencil layout is too large: ${formatDimension(bounds.width)} × ${formatDimension(bounds.height)} px (limit ${MAX_PENCIL_LAYOUT_SIDE} px per side)`,
    );
  }
}

function formatDimension(value: number): string {
  return Number.isFinite(value) ? String(value) : 'infinite';
}
