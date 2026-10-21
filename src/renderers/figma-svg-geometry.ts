import type { FigmaNode, FigmaRectangle } from './figma-json.js';

export interface FigmaSvgMatrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export interface FigmaSvgBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FigmaSvgPath {
  data: string;
  fillRule: 'nonzero' | 'evenodd';
}

export interface FigmaNodeGeometry {
  box: FigmaSvgBox;
  transform?: string;
  childMatrix: FigmaSvgMatrix;
  fillShapes: string[];
  strokeShapes: string[];
}

const IDENTITY_MATRIX: FigmaSvgMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const PATH_TOKEN = /[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/gy;
const PATH_COMMANDS: Readonly<Record<string, number>> = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  A: 7,
};

/** Builds safe geometric SVG elements from the supported Figma node shapes. */
export function createNodeGeometry(
  node: FigmaNode,
  frame: FigmaRectangle,
  parentMatrix: FigmaSvgMatrix,
  root = false,
): FigmaNodeGeometry {
  const raw = node.source;
  const bounds = node.absoluteBoundingBox;
  if (bounds === undefined) {
    throw nodeError(node, 'has no absoluteBoundingBox');
  }

  const relativeTransform = root ? undefined : readRelativeTransform(raw, node);
  const size = root ? undefined : readSize(raw, node);
  const composedTransform =
    relativeTransform === undefined ? undefined : multiplyMatrices(parentMatrix, relativeTransform);
  const box =
    composedTransform === undefined
      ? {
          x: root ? 0 : bounds.x - frame.x,
          y: root ? 0 : bounds.y - frame.y,
          width: bounds.width,
          height: bounds.height,
        }
      : {
          x: 0,
          y: 0,
          width: size?.width ?? bounds.width,
          height: size?.height ?? bounds.height,
        };
  const rotation = readRotation(raw, node);
  const transform =
    composedTransform === undefined
      ? rotation === 0 || root
        ? undefined
        : `rotate(${formatNumber(rotation)} ${formatNumber(box.x + box.width / 2)} ${formatNumber(box.y + box.height / 2)})`
      : formatMatrix(composedTransform);

  const childMatrix =
    composedTransform ??
    (root
      ? IDENTITY_MATRIX
      : { a: 1, b: 0, c: 0, d: 1, e: bounds.x - frame.x, f: bounds.y - frame.y });

  const fillShapes = createShapeElements(node, box, 'fillGeometry');
  const strokeShapes = createShapeElements(node, box, 'strokeGeometry');
  return {
    box,
    ...(transform === undefined ? {} : { transform }),
    childMatrix,
    fillShapes,
    strokeShapes,
  };
}

export function roundedRectanglePath(box: FigmaSvgBox, radii: readonly number[]): string {
  const [topLeft, topRight, bottomRight, bottomLeft] = radii.map((radius) =>
    Math.min(radius, box.width / 2, box.height / 2),
  );
  return [
    `M ${formatNumber(box.x + topLeft!)} ${formatNumber(box.y)}`,
    `H ${formatNumber(box.x + box.width - topRight!)}`,
    `Q ${formatNumber(box.x + box.width)} ${formatNumber(box.y)} ${formatNumber(box.x + box.width)} ${formatNumber(box.y + topRight!)}`,
    `V ${formatNumber(box.y + box.height - bottomRight!)}`,
    `Q ${formatNumber(box.x + box.width)} ${formatNumber(box.y + box.height)} ${formatNumber(box.x + box.width - bottomRight!)} ${formatNumber(box.y + box.height)}`,
    `H ${formatNumber(box.x + bottomLeft!)}`,
    `Q ${formatNumber(box.x)} ${formatNumber(box.y + box.height)} ${formatNumber(box.x)} ${formatNumber(box.y + box.height - bottomLeft!)}`,
    `V ${formatNumber(box.y + topLeft!)}`,
    `Q ${formatNumber(box.x)} ${formatNumber(box.y)} ${formatNumber(box.x + topLeft!)} ${formatNumber(box.y)}`,
    'Z',
  ].join(' ');
}

export function readCornerRadii(node: FigmaNode, box: FigmaSvgBox): number[] {
  const individual = node.source.rectangleCornerRadii;
  if (individual !== undefined) {
    if (
      !Array.isArray(individual) ||
      individual.length !== 4 ||
      individual.some((radius) => !isFiniteNumber(radius) || radius < 0)
    ) {
      throw nodeError(node, 'has invalid rectangleCornerRadii');
    }
    return individual as number[];
  }

  const radius = node.source.cornerRadius ?? 0;
  if (!isFiniteNumber(radius) || radius < 0) {
    throw nodeError(node, 'has invalid cornerRadius');
  }
  return [radius, radius, radius, radius].map((value) =>
    Math.min(value, box.width / 2, box.height / 2),
  );
}

export function parseFigmaPaths(
  node: FigmaNode,
  property: 'fillGeometry' | 'strokeGeometry',
): FigmaSvgPath[] {
  const value = node.source[property];
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw nodeError(node, `has invalid ${property}`);
  }
  return value.map((entry, index) => {
    if (!isRecord(entry) || typeof entry.path !== 'string' || !isValidPathData(entry.path)) {
      throw nodeError(node, `has invalid path ${index + 1} in ${property}`);
    }
    const windingRule = entry.windingRule ?? 'NONZERO';
    if (windingRule !== 'NONZERO' && windingRule !== 'EVENODD') {
      throw nodeError(node, `has invalid winding rule in ${property}`);
    }
    return {
      data: entry.path,
      fillRule: windingRule === 'EVENODD' ? 'evenodd' : 'nonzero',
    };
  });
}

export function escapeXml(value: string): string {
  return sanitizeXmlText(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error('Figma geometry produced a non-finite SVG number');
  }
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

export function nodeError(node: FigmaNode, message: string): Error {
  return new Error(`Figma node ${formatNodeReference(node)} ${message}`);
}

export function formatNodeReference(node: FigmaNode): string {
  const id = compactDiagnosticValue(node.id);
  const name = compactDiagnosticValue(node.name);
  return `"${id}" ("${name}")`;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function multiplyMatrices(left: FigmaSvgMatrix, right: FigmaSvgMatrix): FigmaSvgMatrix {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  };
}

export function formatMatrix(matrix: FigmaSvgMatrix): string {
  return `matrix(${[matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f]
    .map(formatNumber)
    .join(' ')})`;
}

function createShapeElements(
  node: FigmaNode,
  box: FigmaSvgBox,
  pathProperty: 'fillGeometry' | 'strokeGeometry',
): string[] {
  switch (node.type) {
    case 'FRAME':
    case 'GROUP':
    case 'COMPONENT':
    case 'INSTANCE':
    case 'RECTANGLE':
      return [rectangleElement(node, box)];
    case 'ELLIPSE':
      return [
        `<ellipse cx="${formatNumber(box.x + box.width / 2)}" cy="${formatNumber(box.y + box.height / 2)}" rx="${formatNumber(box.width / 2)}" ry="${formatNumber(box.height / 2)}"/>`,
      ];
    case 'LINE':
      return [
        `<line x1="${formatNumber(box.x)}" y1="${formatNumber(box.y)}" x2="${formatNumber(box.x + box.width)}" y2="${formatNumber(box.y + box.height)}"/>`,
      ];
    case 'VECTOR':
      return parseFigmaPaths(node, pathProperty).map(
        ({ data, fillRule }) => `<path d="${escapeXml(data)}" fill-rule="${fillRule}"/>`,
      );
    default:
      return [];
  }
}

function rectangleElement(node: FigmaNode, box: FigmaSvgBox): string {
  if (box.width === 0 || box.height === 0) {
    return `<rect x="${formatNumber(box.x)}" y="${formatNumber(box.y)}" width="0" height="0"/>`;
  }
  const radii = readCornerRadii(node, box);
  if (radii.every((radius) => radius === 0)) {
    return `<rect x="${formatNumber(box.x)}" y="${formatNumber(box.y)}" width="${formatNumber(box.width)}" height="${formatNumber(box.height)}"/>`;
  }
  if (radii.every((radius) => radius === radii[0])) {
    return `<rect x="${formatNumber(box.x)}" y="${formatNumber(box.y)}" width="${formatNumber(box.width)}" height="${formatNumber(box.height)}" rx="${formatNumber(radii[0]!)}"/>`;
  }
  return `<path d="${roundedRectanglePath(box, radii)}"/>`;
}

function readRelativeTransform(
  raw: Record<string, unknown>,
  node: FigmaNode,
): FigmaSvgMatrix | undefined {
  const value = raw.relativeTransform;
  if (value === undefined || value === null) {
    return undefined;
  }
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !Array.isArray(value[0]) ||
    !Array.isArray(value[1]) ||
    value[0].length !== 3 ||
    value[1].length !== 3 ||
    [...value[0], ...value[1]].some((number) => !isFiniteNumber(number))
  ) {
    throw nodeError(node, 'has invalid relativeTransform');
  }
  return {
    a: value[0][0] as number,
    c: value[0][1] as number,
    e: value[0][2] as number,
    b: value[1][0] as number,
    d: value[1][1] as number,
    f: value[1][2] as number,
  };
}

function readSize(
  raw: Record<string, unknown>,
  node: FigmaNode,
): { width: number; height: number } | undefined {
  const value = raw.size;
  if (value === undefined || value === null) {
    return undefined;
  }
  if (
    !isRecord(value) ||
    (value.x !== undefined && !isFiniteNumber(value.x)) ||
    (value.y !== undefined && !isFiniteNumber(value.y)) ||
    (value.width !== undefined && !isFiniteNumber(value.width)) ||
    (value.height !== undefined && !isFiniteNumber(value.height))
  ) {
    throw nodeError(node, 'has invalid size');
  }
  const sizeWidth = value.width ?? value.x;
  const sizeHeight = value.height ?? value.y;
  if (
    !isFiniteNumber(sizeWidth) ||
    !isFiniteNumber(sizeHeight) ||
    sizeWidth < 0 ||
    sizeHeight < 0
  ) {
    throw nodeError(node, 'has invalid size');
  }
  return { width: sizeWidth, height: sizeHeight };
}

function readRotation(raw: Record<string, unknown>, node: FigmaNode): number {
  const value = raw.rotation ?? 0;
  if (!isFiniteNumber(value)) {
    throw nodeError(node, 'has invalid rotation');
  }
  return ((value % 360) + 360) % 360;
}

function isValidPathData(value: string): boolean {
  if (value.trim().length === 0 || value.length > 1024 * 1024) {
    return false;
  }

  const tokens: Array<string | number> = [];
  let offset = 0;
  while (offset < value.length) {
    if (/^[\s,]$/.test(value[offset]!)) {
      offset += 1;
      continue;
    }
    PATH_TOKEN.lastIndex = offset;
    const match = PATH_TOKEN.exec(value);
    if (match === null || match.index !== offset) {
      return false;
    }
    const token = match[0]!;
    if (/^[a-z]$/i.test(token)) {
      if (token.toUpperCase() !== 'Z' && PATH_COMMANDS[token.toUpperCase()] === undefined) {
        return false;
      }
      tokens.push(token);
    } else {
      const number = Number(token);
      if (!Number.isFinite(number)) {
        return false;
      }
      tokens.push(number);
    }
    offset = PATH_TOKEN.lastIndex;
  }

  let index = 0;
  let command: string | undefined;
  let hasMove = false;
  while (index < tokens.length) {
    if (typeof tokens[index] === 'string') {
      command = tokens[index] as string;
      index += 1;
      if (command.toUpperCase() === 'Z') {
        if (!hasMove) {
          return false;
        }
        command = undefined;
        continue;
      }
    } else if (command === undefined) {
      return false;
    }

    const upper = command!.toUpperCase();
    const count = PATH_COMMANDS[upper]!;
    const start = index;
    while (index < tokens.length && typeof tokens[index] === 'number') {
      index += 1;
    }
    const parameterCount = index - start;
    if (parameterCount < count || parameterCount % count !== 0) {
      return false;
    }
    if (upper === 'A') {
      for (let flag = start + 3; flag < index; flag += count) {
        if (
          (tokens[flag] !== 0 && tokens[flag] !== 1) ||
          (tokens[flag + 1] !== 0 && tokens[flag + 1] !== 1)
        ) {
          return false;
        }
      }
    }
    if (upper === 'M') {
      hasMove = true;
      command = command === 'm' ? 'l' : 'L';
    }
  }
  return hasMove;
}

function sanitizeXmlText(value: string): string {
  let result = '';
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    const valid =
      codePoint === 0x9 ||
      codePoint === 0xa ||
      codePoint === 0xd ||
      (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
      (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
      (codePoint >= 0x10000 && codePoint <= 0x10ffff);
    result += valid ? character : '\uFFFD';
  }
  return result;
}

function compactDiagnosticValue(value: string): string {
  const safe = sanitizeXmlText(value).replaceAll(/[\r\n\t]/g, ' ');
  return safe.length > 100 ? `${safe.slice(0, 97)}...` : safe;
}
