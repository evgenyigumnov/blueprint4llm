export const MAX_DRAWIO_JSON_BYTES = 1024 * 1024;
export const MAX_DRAWIO_JSON_CELLS = 10_000;
export const MAX_DRAWIO_JSON_PAGES = 100;

export type DrawioDirection = 'TB' | 'LR';

interface DrawioCellBase {
  id: string;
  label: string;
  parent?: string;
}

export type DrawioCell =
  | (DrawioCellBase & { type: 'layer' })
  | (DrawioCellBase & { type: 'group' | 'node'; parent: string })
  | (DrawioCellBase & {
      type: 'edge';
      parent: string;
      source: string;
      target: string;
    });

export interface DrawioGraph {
  version: string;
  pageId: string;
  pageName: string;
  direction: DrawioDirection;
  cells: DrawioCell[];
}

interface DrawioPage {
  id: string;
  name: string;
  cells: DrawioCell[];
}

/** Parses, validates, selects, and normalizes a draw.io structural JSON export. */
export function parseDrawioJson(source: string, metadata?: string): DrawioGraph {
  const byteLength = Buffer.byteLength(source, 'utf8');
  if (byteLength > MAX_DRAWIO_JSON_BYTES) {
    throw new Error(
      `draw.io JSON is too large: ${byteLength} bytes (limit ${MAX_DRAWIO_JSON_BYTES} bytes)`,
    );
  }

  let value: unknown;
  try {
    value = JSON.parse(source) as unknown;
  } catch {
    throw new Error('invalid draw.io JSON');
  }

  if (!isRecord(value)) {
    throw new Error('draw.io JSON must be an object');
  }
  if (typeof value.version !== 'string' || value.version.trim() === '') {
    throw new Error('draw.io JSON must contain a non-empty string version');
  }
  if (!Array.isArray(value.pages) || value.pages.length === 0) {
    throw new Error('draw.io JSON must contain a non-empty pages array');
  }
  if (value.pages.length > MAX_DRAWIO_JSON_PAGES) {
    throw new Error(`draw.io JSON has too many pages (limit ${MAX_DRAWIO_JSON_PAGES})`);
  }

  const pages = validatePages(value.pages);
  const options = readDrawioOptions(metadata);
  const selectedPage = selectPage(pages, options.pageId);
  return {
    version: value.version,
    pageId: selectedPage.id,
    pageName: selectedPage.name,
    direction: options.direction,
    cells: selectedPage.cells,
  };
}

function validatePages(values: unknown[]): DrawioPage[] {
  const ids = new Set<string>();
  const pages: DrawioPage[] = [];

  for (const [index, value] of values.entries()) {
    if (!isRecord(value)) {
      throw new Error(`draw.io page at index ${index + 1} must be an object`);
    }
    const id = requireNonEmptyString(value.id, `draw.io page at index ${index + 1} id`);
    if (ids.has(id)) {
      throw new Error(`draw.io JSON contains duplicate page id "${id}"`);
    }
    ids.add(id);
    if (value.name !== undefined && typeof value.name !== 'string') {
      throw new Error(`draw.io page "${id}" name must be a string`);
    }
    if (!Array.isArray(value.cells)) {
      throw new Error(`draw.io page "${id}" cells must be an array`);
    }
    if (value.cells.length > MAX_DRAWIO_JSON_CELLS) {
      throw new Error(`draw.io page "${id}" has too many cells (limit ${MAX_DRAWIO_JSON_CELLS})`);
    }

    const cells = validateCells(value.cells, id);
    pages.push({ id, name: typeof value.name === 'string' ? value.name : id, cells });
  }

  return pages;
}

function validateCells(values: unknown[], pageId: string): DrawioCell[] {
  const ids = new Set<string>();
  const cells: DrawioCell[] = [];

  for (const [index, value] of values.entries()) {
    if (!isRecord(value)) {
      throw new Error(`draw.io page "${pageId}" cell at index ${index + 1} must be an object`);
    }
    const id = requireNonEmptyString(value.id, `draw.io page "${pageId}" cell id`);
    if (ids.has(id)) {
      throw new Error(`draw.io page "${pageId}" contains duplicate cell id "${id}"`);
    }
    ids.add(id);

    if (typeof value.type !== 'string' || !isDrawioCellType(value.type)) {
      throw new Error(`draw.io cell "${id}" has an unsupported type`);
    }
    if (value.label !== undefined && typeof value.label !== 'string') {
      throw new Error(`draw.io cell "${id}" label must be a string`);
    }

    const parent =
      value.parent === undefined
        ? undefined
        : requireNonEmptyString(value.parent, `draw.io cell "${id}" parent`);
    if (value.type !== 'layer' && parent === undefined) {
      throw new Error(`draw.io ${value.type} cell "${id}" must have a parent id`);
    }

    if (value.type === 'edge') {
      const source = requireNonEmptyString(value.source, `draw.io edge "${id}" source`);
      const target = requireNonEmptyString(value.target, `draw.io edge "${id}" target`);
      cells.push({
        id,
        type: 'edge',
        parent: parent!,
        source,
        target,
        label: typeof value.label === 'string' ? value.label : '',
      });
    } else if (value.type === 'group' || value.type === 'node') {
      cells.push({
        id,
        type: value.type,
        parent: parent!,
        label: typeof value.label === 'string' ? value.label : id,
      });
    } else {
      cells.push({
        id,
        type: 'layer',
        ...(parent === undefined ? {} : { parent }),
        label: typeof value.label === 'string' ? value.label : '',
      });
    }
  }

  validateCellReferences(cells, pageId);
  return cells;
}

function validateCellReferences(cells: DrawioCell[], pageId: string): void {
  const byId = new Map(cells.map((cell) => [cell.id, cell]));
  for (const cell of cells) {
    if (cell.parent !== undefined && !byId.has(cell.parent)) {
      throw new Error(
        `draw.io page "${pageId}" cell "${cell.id}" references missing parent "${cell.parent}"`,
      );
    }
    if (cell.type !== 'edge') {
      continue;
    }
    for (const [role, id] of [
      ['source', cell.source],
      ['target', cell.target],
    ] as const) {
      const endpoint = byId.get(id);
      if (endpoint === undefined) {
        throw new Error(`draw.io edge "${cell.id}" references missing ${role} "${id}"`);
      }
      if (endpoint.type !== 'node' && endpoint.type !== 'group') {
        throw new Error(`draw.io edge "${cell.id}" ${role} "${id}" must be a node or group`);
      }
    }
  }

  validateParentAcyclicity(cells, byId, pageId);
}

function validateParentAcyclicity(
  cells: DrawioCell[],
  byId: Map<string, DrawioCell>,
  pageId: string,
): void {
  const complete = new Set<string>();
  for (const cell of cells) {
    const path = new Set<string>();
    let current: DrawioCell | undefined = cell;
    while (current !== undefined && !complete.has(current.id)) {
      if (path.has(current.id)) {
        throw new Error(`draw.io page "${pageId}" contains a parent cycle at cell "${current.id}"`);
      }
      path.add(current.id);
      current = current.parent === undefined ? undefined : byId.get(current.parent);
    }
    for (const id of path) {
      complete.add(id);
    }
  }
}

function readDrawioOptions(metadata: string | undefined): {
  pageId: string | undefined;
  direction: DrawioDirection;
} {
  const tokens = metadata?.trim().split(/\s+/).filter(Boolean) ?? [];
  const pageTokens = tokens.filter((token) => token === 'page' || token.startsWith('page='));
  const directionTokens = tokens.filter(
    (token) => token === 'direction' || token.startsWith('direction='),
  );
  if (pageTokens.length > 1) {
    throw new Error('draw.io metadata must contain only one page=<id> option');
  }
  if (directionTokens.length > 1) {
    throw new Error('draw.io metadata must contain only one direction=<TB|LR> option');
  }

  let pageId: string | undefined;
  if (pageTokens.length === 1) {
    const token = pageTokens[0]!;
    pageId = token.startsWith('page=') ? token.slice('page='.length) : '';
    if (pageId.trim() === '') {
      throw new Error('draw.io metadata page option must use the form page=<id>');
    }
  }

  let direction: DrawioDirection = 'TB';
  if (directionTokens.length === 1) {
    const token = directionTokens[0]!;
    const value = token.startsWith('direction=') ? token.slice('direction='.length) : '';
    if (value !== 'TB' && value !== 'LR') {
      throw new Error('draw.io metadata direction must be TB or LR');
    }
    direction = value;
  }

  return { pageId, direction };
}

function selectPage(pages: DrawioPage[], requestedId: string | undefined): DrawioPage {
  if (requestedId !== undefined) {
    const page = pages.find(({ id }) => id === requestedId);
    if (page === undefined) {
      throw new Error(`draw.io page "${requestedId}" was not found`);
    }
    return page;
  }
  if (pages.length !== 1) {
    throw new Error(`draw.io JSON has ${pages.length} pages; set page=<id> to select one`);
  }
  return pages[0]!;
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function isDrawioCellType(value: string): value is DrawioCell['type'] {
  return value === 'layer' || value === 'group' || value === 'node' || value === 'edge';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
