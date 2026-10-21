export const MAX_FIGMA_JSON_BYTES = 1024 * 1024;
export const MAX_FIGMA_JSON_NODES = 10_000;
export const MAX_FIGMA_JSON_DEPTH = 100;

const FRAME_TYPES = new Set(['FRAME', 'COMPONENT', 'INSTANCE']);

export interface FigmaRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  absoluteBoundingBox?: FigmaRectangle;
  /** Original Figma node properties used by the SVG renderer. */
  source: Record<string, unknown>;
  children: FigmaNode[];
}

export interface FigmaJsonDocument {
  name: string;
  document: FigmaNode;
}

/** Parses a Figma REST file response, validates its tree, and selects one frame. */
export function parseAndSelectFigmaFrame(source: string, metadata?: string): FigmaNode {
  const byteLength = Buffer.byteLength(source, 'utf8');
  if (byteLength > MAX_FIGMA_JSON_BYTES) {
    throw new Error(
      `Figma JSON is too large: ${byteLength} bytes (limit ${MAX_FIGMA_JSON_BYTES} bytes)`,
    );
  }

  let response: unknown;
  try {
    response = JSON.parse(source) as unknown;
  } catch {
    throw new Error('invalid Figma JSON');
  }

  if (!isRecord(response) || !isRecord(response.document)) {
    throw new Error('Figma JSON must contain a document object');
  }

  const document = validateNodeTree(response.document, 'document');
  if (document.type !== 'DOCUMENT') {
    throw new Error('Figma document root must have type DOCUMENT');
  }

  const requestedNodeId = readRequestedNodeId(metadata);
  if (requestedNodeId !== undefined) {
    const selected = findNode(document, requestedNodeId);
    if (selected === undefined) {
      throw new Error(`Figma node "${requestedNodeId}" was not found`);
    }
    if (!FRAME_TYPES.has(selected.type)) {
      throw new Error(`Figma node "${requestedNodeId}" is not a frame, component, or instance`);
    }
    return validateSelectedFrame(selected);
  }

  const topLevelFrames = collectTopLevelFrames(document);
  if (topLevelFrames.length !== 1) {
    throw new Error(
      topLevelFrames.length === 0
        ? 'Figma JSON has no top-level frame; set node=<id> to select a frame'
        : `Figma JSON has ${topLevelFrames.length} top-level frames; set node=<id> to select one`,
    );
  }
  return validateSelectedFrame(topLevelFrames[0]!);
}

function validateNodeTree(value: unknown, label: string): FigmaNode {
  const root = validateNode(value, label);
  const pending: Array<{ source: unknown; node: FigmaNode; depth: number }> = [
    { source: value, node: root, depth: 1 },
  ];
  const ids = new Set<string>();
  let count = 0;

  while (pending.length > 0) {
    const current = pending.pop()!;
    count += 1;
    if (count > MAX_FIGMA_JSON_NODES) {
      throw new Error(`Figma JSON has too many nodes (limit ${MAX_FIGMA_JSON_NODES})`);
    }
    if (current.depth > MAX_FIGMA_JSON_DEPTH) {
      throw new Error(`Figma JSON is nested too deeply (limit ${MAX_FIGMA_JSON_DEPTH} levels)`);
    }
    if (ids.has(current.node.id)) {
      throw new Error(`Figma JSON contains duplicate node id "${current.node.id}"`);
    }
    ids.add(current.node.id);

    if (!isRecord(current.source)) {
      throw new Error(`Figma node "${current.node.id}" must be an object`);
    }
    const rawChildren = current.source.children;
    if (rawChildren !== undefined && !Array.isArray(rawChildren)) {
      throw new Error(`Figma node "${current.node.id}" children must be an array`);
    }
    for (const rawChild of (rawChildren as unknown[] | undefined) ?? []) {
      const child = validateNode(rawChild, `child of node "${current.node.id}"`);
      current.node.children.push(child);
      pending.push({ source: rawChild, node: child, depth: current.depth + 1 });
    }
  }

  return root;
}

function validateNode(value: unknown, label: string): FigmaNode {
  if (!isRecord(value)) {
    throw new Error(`Figma ${label} must be an object`);
  }
  if (typeof value.id !== 'string' || value.id.trim().length === 0) {
    throw new Error(`Figma ${label} must have a non-empty string id`);
  }
  if (typeof value.type !== 'string' || value.type.trim().length === 0) {
    throw new Error(`Figma node "${value.id}" must have a non-empty string type`);
  }
  if (value.name !== undefined && typeof value.name !== 'string') {
    throw new Error(`Figma node "${value.id}" name must be a string`);
  }
  if (value.children !== undefined && !Array.isArray(value.children)) {
    throw new Error(`Figma node "${value.id}" children must be an array`);
  }

  let absoluteBoundingBox: FigmaRectangle | undefined;
  if (value.absoluteBoundingBox !== undefined && value.absoluteBoundingBox !== null) {
    absoluteBoundingBox = validateRectangle(value.absoluteBoundingBox, value.id);
  }

  return {
    id: value.id,
    name: typeof value.name === 'string' ? value.name : value.id,
    type: value.type,
    ...(absoluteBoundingBox === undefined ? {} : { absoluteBoundingBox }),
    source: value,
    children: [],
  };
}

function validateRectangle(value: unknown, nodeId: string): FigmaRectangle {
  if (!isRecord(value)) {
    throw new Error(`Figma node "${nodeId}" absoluteBoundingBox must be an object`);
  }
  const { x, y, width, height } = value;
  if (
    !isFiniteNumber(x) ||
    !isFiniteNumber(y) ||
    !isFiniteNumber(width) ||
    !isFiniteNumber(height) ||
    width < 0 ||
    height < 0
  ) {
    throw new Error(`Figma node "${nodeId}" has invalid absoluteBoundingBox coordinates`);
  }
  return { x, y, width, height };
}

function validateSelectedFrame(node: FigmaNode): FigmaNode {
  if (node.absoluteBoundingBox === undefined) {
    throw new Error(`Figma frame "${node.id}" has no absoluteBoundingBox`);
  }
  if (node.absoluteBoundingBox.width <= 0 || node.absoluteBoundingBox.height <= 0) {
    throw new Error(`Figma frame "${node.id}" has an empty absoluteBoundingBox`);
  }
  return node;
}

function collectTopLevelFrames(document: FigmaNode): FigmaNode[] {
  const frames: FigmaNode[] = [];
  for (const page of document.children) {
    if (page.type !== 'CANVAS') {
      continue;
    }
    for (const child of page.children) {
      if (FRAME_TYPES.has(child.type)) {
        frames.push(child);
      }
    }
  }
  return frames;
}

function findNode(root: FigmaNode, id: string): FigmaNode | undefined {
  const pending = [root];
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (node.id === id) {
      return node;
    }
    pending.push(...node.children);
  }
  return undefined;
}

function readRequestedNodeId(metadata: string | undefined): string | undefined {
  if (metadata === undefined) {
    return undefined;
  }
  const nodeOptions = metadata.split(/\s+/).filter((token) => token.startsWith('node='));
  if (nodeOptions.length === 0) {
    return undefined;
  }
  if (nodeOptions.length > 1) {
    throw new Error('Figma metadata must contain only one node=<id> option');
  }

  const nodeId = nodeOptions[0]!.slice('node='.length);
  if (!/^\d+:\d+$/.test(nodeId)) {
    throw new Error('Figma metadata node option must use the form node=<number>:<number>');
  }
  return nodeId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
