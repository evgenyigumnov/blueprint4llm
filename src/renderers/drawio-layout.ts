import type { DrawioCell, DrawioGraph } from './drawio-json.js';
import { arrangeDrawioItems } from './drawio-rank.js';

const NODE_MIN_WIDTH = 120;
const NODE_MAX_WIDTH = 280;
const NODE_LINE_HEIGHT = 20;
const NODE_HORIZONTAL_PADDING = 24;
const NODE_VERTICAL_PADDING = 18;
const GROUP_PADDING = 20;
const GROUP_MIN_WIDTH = 168;
const GROUP_MIN_HEIGHT = 78;
const PAGE_MARGIN = 32;
const MAX_LAYOUT_SIDE = 16_384;
const MAX_GROUP_DEPTH = 100;
const MAX_LABEL_LINES = 256;
export const MAX_DRAWIO_LAYOUT_TIME_MS = 5_000;

export interface DrawioBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DrawioLayoutCell extends DrawioBox {
  cell: Exclude<DrawioCell, { type: 'edge' | 'layer' }>;
  labelLines: string[];
  children: DrawioLayoutCell[];
}

export interface DrawioLayoutEdge {
  cell: Extract<DrawioCell, { type: 'edge' }>;
  source: DrawioBox;
  target: DrawioBox;
  labelLines: string[];
}

export interface DrawioLayout {
  width: number;
  height: number;
  cells: DrawioLayoutCell[];
  edges: DrawioLayoutEdge[];
}

interface GraphItem {
  id: string;
  width: number;
  height: number;
  labelLines: string[];
  cell: Exclude<DrawioCell, { type: 'edge' | 'layer' }>;
  children: DrawioLayoutCell[];
  childOffsetX: number;
  childOffsetY: number;
}

interface ScopedEdge {
  cell: Extract<DrawioCell, { type: 'edge' }>;
  scope: string;
  sourceItem: string | undefined;
  targetItem: string | undefined;
}

interface ScopeLayout {
  width: number;
  height: number;
  cells: DrawioLayoutCell[];
}

const ROOT_SCOPE = '';

/** Computes a bounded, deterministic layout for the normalized draw.io graph. */
export function layoutDrawioGraph(graph: DrawioGraph): DrawioLayout {
  const deadline = performance.now() + MAX_DRAWIO_LAYOUT_TIME_MS;
  const checkTime = (): void => {
    if (performance.now() > deadline) {
      throw new Error(`draw.io layout exceeded its ${MAX_DRAWIO_LAYOUT_TIME_MS} ms time limit`);
    }
  };
  checkTime();
  const cellsById = new Map(graph.cells.map((cell) => [cell.id, cell]));
  const logicalParents = readLogicalParents(graph.cells, cellsById, checkTime);
  const childrenByScope = new Map<string, GraphItem['cell'][]>([[ROOT_SCOPE, []]]);
  for (const cell of graph.cells) {
    checkTime();
    if (cell.type !== 'node' && cell.type !== 'group') {
      continue;
    }
    const scope = logicalParents.get(cell.id) ?? ROOT_SCOPE;
    const children = childrenByScope.get(scope) ?? [];
    children.push(cell);
    childrenByScope.set(scope, children);
  }
  const groupAncestors = readGroupAncestors(graph.cells, logicalParents, cellsById, checkTime);
  const scopedEdges = readScopedEdges(graph.cells, groupAncestors, logicalParents, checkTime);
  const edgesByScope = new Map<string, ScopedEdge[]>();
  for (const edge of scopedEdges) {
    checkTime();
    const edges = edgesByScope.get(edge.scope) ?? [];
    edges.push(edge);
    edgesByScope.set(edge.scope, edges);
  }

  const layoutScope = (scope: string): ScopeLayout => {
    checkTime();
    const childCells = childrenByScope.get(scope) ?? [];
    const items = childCells.map((cell) => {
      checkTime();
      return createItem(cell);
    });
    const edges = edgesByScope.get(scope) ?? [];
    const rankEdges = edges.flatMap((edge) =>
      edge.sourceItem !== undefined &&
      edge.targetItem !== undefined &&
      edge.sourceItem !== edge.targetItem
        ? [[edge.sourceItem, edge.targetItem] as const]
        : [],
    );
    const positions = arrangeDrawioItems(items, rankEdges, graph.direction, checkTime);
    return {
      width: positions.width,
      height: positions.height,
      cells: items.map((item) => {
        checkTime();
        const position = positions.byId.get(item.id)!;
        return {
          cell: item.cell,
          x: position.x,
          y: position.y,
          width: item.width,
          height: item.height,
          labelLines: item.labelLines,
          children: item.children.map((child) =>
            translateCell(
              child,
              position.x + item.childOffsetX,
              position.y + item.childOffsetY,
              checkTime,
            ),
          ),
        };
      }),
    };

    function createItem(cell: GraphItem['cell']): GraphItem {
      if (cell.type === 'node') {
        const labelLines = wrapLabel(cell.label, 32);
        const textWidth = Math.max(...labelLines.map(estimatedTextWidth), 0);
        return {
          id: cell.id,
          width: clamp(textWidth + NODE_HORIZONTAL_PADDING * 2, NODE_MIN_WIDTH, NODE_MAX_WIDTH),
          height: labelLines.length * NODE_LINE_HEIGHT + NODE_VERTICAL_PADDING * 2,
          labelLines,
          cell,
          children: [],
          childOffsetX: 0,
          childOffsetY: 0,
        };
      }

      const childrenLayout = layoutScope(cell.id);
      const labelLines = wrapLabel(cell.label, 30);
      const headerHeight = Math.max(30, labelLines.length * NODE_LINE_HEIGHT + 10);
      const labelWidth = Math.max(...labelLines.map(estimatedTextWidth), 0);
      const width = Math.max(
        GROUP_MIN_WIDTH,
        childrenLayout.width + GROUP_PADDING * 2,
        labelWidth + GROUP_PADDING * 2,
      );
      const height = Math.max(
        GROUP_MIN_HEIGHT,
        childrenLayout.height + headerHeight + GROUP_PADDING * 2,
      );
      return {
        id: cell.id,
        width,
        height,
        labelLines,
        cell,
        children: childrenLayout.cells,
        childOffsetX: GROUP_PADDING,
        childOffsetY: headerHeight + GROUP_PADDING,
      };
    }
  };

  const rootLayout = layoutScope(ROOT_SCOPE);
  if (rootLayout.cells.length === 0) {
    return { width: PAGE_MARGIN * 2, height: PAGE_MARGIN * 2, cells: [], edges: [] };
  }

  const cells = rootLayout.cells.map((cell) =>
    translateCell(cell, PAGE_MARGIN, PAGE_MARGIN, checkTime),
  );
  const flatCells = new Map<string, DrawioLayoutCell>();
  for (const cell of cells) {
    checkTime();
    collectCells(cell, flatCells, checkTime);
  }
  const edges: DrawioLayoutEdge[] = [];
  for (const cell of graph.cells) {
    checkTime();
    if (cell.type !== 'edge') {
      continue;
    }
    const source = flatCells.get(cell.source);
    const target = flatCells.get(cell.target);
    if (source === undefined || target === undefined) {
      throw new Error(`draw.io edge "${cell.id}" has an endpoint outside the drawable graph`);
    }
    edges.push({
      cell,
      source: pickBox(source),
      target: pickBox(target),
      labelLines: wrapLabel(cell.label, 28),
    });
  }

  const width = rootLayout.width + PAGE_MARGIN * 2;
  const height = rootLayout.height + PAGE_MARGIN * 2;
  if (width > MAX_LAYOUT_SIDE || height > MAX_LAYOUT_SIDE) {
    throw new Error(
      `draw.io layout is too large: ${width} × ${height} px (limit ${MAX_LAYOUT_SIDE} px per side)`,
    );
  }
  return { width, height, cells, edges };
}

function readLogicalParents(
  cells: DrawioCell[],
  cellsById: Map<string, DrawioCell>,
  checkTime: () => void,
): Map<string, string> {
  const result = new Map<string, string>();
  for (const cell of cells) {
    checkTime();
    if (cell.type === 'layer') {
      continue;
    }
    if (cell.type === 'edge') {
      const parent = cellsById.get(cell.parent);
      if (parent?.type !== 'group' && parent?.type !== 'layer') {
        throw new Error(`draw.io edge "${cell.id}" parent must be a group or layer`);
      }
      continue;
    }
    let parent: string | undefined = cell.parent;
    let depth = 0;
    while (parent !== undefined) {
      checkTime();
      const container = cellsById.get(parent);
      if (container === undefined) {
        throw new Error(`draw.io cell "${cell.id}" references missing parent "${parent}"`);
      }
      if (container.type === 'group') {
        result.set(cell.id, container.id);
        break;
      }
      if (container.type !== 'layer') {
        throw new Error(
          `draw.io cell "${cell.id}" parent "${container.id}" must be a group or layer`,
        );
      }
      parent = container.parent;
      depth += 1;
      if (depth > MAX_GROUP_DEPTH) {
        throw new Error(`draw.io layer nesting exceeds the layout limit of ${MAX_GROUP_DEPTH}`);
      }
    }
  }

  for (const cell of cells) {
    checkTime();
    if (cell.type !== 'group') {
      continue;
    }
    let parent = result.get(cell.id);
    let depth = 1;
    while (parent !== undefined) {
      checkTime();
      if (cellsById.get(parent)?.type !== 'group') {
        throw new Error(`draw.io group "${cell.id}" has an invalid parent`);
      }
      parent = result.get(parent);
      depth += 1;
      if (depth > MAX_GROUP_DEPTH) {
        throw new Error(`draw.io group nesting exceeds the layout limit of ${MAX_GROUP_DEPTH}`);
      }
    }
  }
  return result;
}

function readGroupAncestors(
  cells: DrawioCell[],
  logicalParents: Map<string, string>,
  cellsById: Map<string, DrawioCell>,
  checkTime: () => void,
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const cell of cells) {
    checkTime();
    if (cell.type !== 'node' && cell.type !== 'group') {
      continue;
    }
    const ancestors: string[] = [];
    let current = logicalParents.get(cell.id);
    while (current !== undefined) {
      checkTime();
      ancestors.push(current);
      const parent = logicalParents.get(current);
      current = parent;
      if (cellsById.get(ancestors.at(-1)!)?.type !== 'group') {
        throw new Error(`draw.io group path for cell "${cell.id}" is invalid`);
      }
    }
    result.set(cell.id, ancestors);
  }
  return result;
}

function readScopedEdges(
  cells: DrawioCell[],
  groupAncestors: Map<string, string[]>,
  logicalParents: Map<string, string>,
  checkTime: () => void,
): ScopedEdge[] {
  const edges: ScopedEdge[] = [];
  for (const cell of cells) {
    checkTime();
    if (cell.type !== 'edge') {
      continue;
    }
    const sourcePath = groupAncestors.get(cell.source) ?? [];
    const targetAncestors = new Set(groupAncestors.get(cell.target) ?? []);
    const commonGroup = sourcePath.find((id) => targetAncestors.has(id));
    const scope = commonGroup ?? ROOT_SCOPE;
    edges.push({
      cell,
      scope,
      sourceItem: directChildInScope(cell.source, scope, logicalParents, checkTime),
      targetItem: directChildInScope(cell.target, scope, logicalParents, checkTime),
    });
  }
  return edges;
}

function directChildInScope(
  cellId: string,
  scope: string,
  logicalParents: Map<string, string>,
  checkTime: () => void,
): string | undefined {
  let current: string | undefined = cellId;
  while (current !== undefined) {
    checkTime();
    const parent: string = logicalParents.get(current) ?? ROOT_SCOPE;
    if (parent === scope) {
      return current;
    }
    current = parent === ROOT_SCOPE ? undefined : parent;
  }
  return undefined;
}

function wrapLabel(value: string, maxChars: number): string[] {
  const lines: string[] = [];
  const pushLine = (line: string) => {
    lines.push(line);
    if (lines.length > MAX_LABEL_LINES) {
      throw new Error(`draw.io label exceeds the safe limit of ${MAX_LABEL_LINES} lines`);
    }
  };
  const normalized = value.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
  for (const paragraph of normalized.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      pushLine('');
      continue;
    }
    let line = '';
    for (const word of words) {
      for (const { text: chunk, last } of splitLongWord(word, maxChars)) {
        if (line.length > 0 && [...line, ...chunk].length + 1 > maxChars) {
          pushLine(line);
          line = '';
        }
        line = line.length === 0 ? chunk : `${line} ${chunk}`;
        if (!last) {
          pushLine(line);
          line = '';
        }
      }
    }
    if (line.length > 0) {
      pushLine(line);
    }
  }
  return lines.length > 0 ? lines : [''];
}

function* splitLongWord(
  word: string,
  maxChars: number,
): Generator<{ text: string; last: boolean }> {
  let chunk = '';
  let length = 0;
  let pending: string | undefined;
  for (const character of word) {
    chunk += character;
    length += 1;
    if (length === maxChars) {
      if (pending !== undefined) {
        yield { text: pending, last: false };
      }
      pending = chunk;
      chunk = '';
      length = 0;
    }
  }
  if (pending === undefined) {
    yield { text: chunk, last: true };
  } else if (chunk.length === 0) {
    yield { text: pending, last: true };
  } else {
    yield { text: pending, last: false };
    yield { text: chunk, last: true };
  }
}

function estimatedTextWidth(value: string): number {
  return [...value].length * 7.6;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function translateCell(
  cell: DrawioLayoutCell,
  x: number,
  y: number,
  checkTime: () => void = () => undefined,
): DrawioLayoutCell {
  checkTime();
  return {
    ...cell,
    x: cell.x + x,
    y: cell.y + y,
    children: cell.children.map((child) => translateCell(child, x, y, checkTime)),
  };
}

function collectCells(
  cell: DrawioLayoutCell,
  result: Map<string, DrawioLayoutCell>,
  checkTime: () => void,
): void {
  checkTime();
  result.set(cell.cell.id, cell);
  for (const child of cell.children) {
    collectCells(child, result, checkTime);
  }
}

function pickBox(cell: DrawioLayoutCell): DrawioBox {
  return { x: cell.x, y: cell.y, width: cell.width, height: cell.height };
}
