import type { FigmaNode, FigmaRectangle } from './figma-json.js';
import {
  createNodeGeometry,
  escapeXml,
  formatNumber,
  formatNodeReference,
  isRecord,
  nodeError,
  type FigmaSvgMatrix,
} from './figma-svg-geometry.js';
import {
  addAttributes,
  readNodeOpacity,
  readNodePaints,
  renderFillElement,
  renderStrokeElement,
  renderTextNode,
  wrapNodeContent,
} from './figma-svg-style.js';

const CONTAINER_TYPES = new Set(['FRAME', 'GROUP', 'COMPONENT', 'INSTANCE']);
const NODE_TYPES = new Set([...CONTAINER_TYPES, 'RECTANGLE', 'ELLIPSE', 'LINE', 'TEXT', 'VECTOR']);
const IDENTITY_MATRIX: FigmaSvgMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

interface RenderState {
  frame: FigmaRectangle;
  definitions: string[];
  nextClipId: number;
}

/** Converts a validated Figma frame and its supported children to inline SVG. */
export function renderFigmaFrame(frame: FigmaNode): string {
  const bounds = frame.absoluteBoundingBox;
  if (bounds === undefined) {
    throw nodeError(frame, 'has no absoluteBoundingBox');
  }
  const state: RenderState = { frame: bounds, definitions: [], nextClipId: 1 };
  const body = renderNode(frame, state, IDENTITY_MATRIX, true);
  const definitions =
    state.definitions.length === 0 ? '' : `<defs>${state.definitions.join('')}</defs>`;
  return [
    '<svg xmlns="http://www.w3.org/2000/svg"',
    ` width="${formatNumber(bounds.width)}" height="${formatNumber(bounds.height)}"`,
    ` viewBox="0 0 ${formatNumber(bounds.width)} ${formatNumber(bounds.height)}">`,
    `<title>${escapeXml(frame.name)}</title>`,
    definitions,
    body,
    '</svg>',
  ].join('');
}

function renderNode(
  node: FigmaNode,
  state: RenderState,
  parentMatrix: FigmaSvgMatrix,
  root = false,
): string {
  if (node.source.visible !== undefined && typeof node.source.visible !== 'boolean') {
    throw nodeError(node, 'has invalid visible setting');
  }
  if (node.source.visible === false) {
    return '';
  }
  if (!NODE_TYPES.has(node.type)) {
    throw new Error(
      `unsupported Figma node type "${node.type}" at node ${formatNodeReference(node)}`,
    );
  }

  validateNodeFeatures(node);
  const opacity = readNodeOpacity(node);
  if (opacity === 0) {
    return '';
  }

  const geometry = createNodeGeometry(node, state.frame, parentMatrix, root);
  const fills = readNodePaints(node, 'fills');
  const strokes = readNodePaints(node, 'strokes');
  const content: string[] = [];

  if (node.type === 'TEXT') {
    const text = renderTextNode(node, geometry.box, geometry.transform, fills, strokes);
    if (text.length > 0) {
      content.push(text);
    }
  } else {
    if (fills.length > 0 && geometry.fillShapes.length === 0) {
      throw missingVectorGeometry(node, 'fillGeometry');
    }
    if (strokes.length > 0 && geometry.strokeShapes.length === 0) {
      const fallback = node.type === 'VECTOR' ? geometry.fillShapes : [];
      if (fallback.length === 0) {
        throw missingVectorGeometry(node, 'strokeGeometry');
      }
      for (const shape of fallback) {
        content.push(...renderStrokes(node, shape, strokes, geometry.transform));
      }
    }
    for (const shape of geometry.fillShapes) {
      for (const paint of fills) {
        content.push(addTransform(renderFillElement(shape, paint), geometry.transform));
      }
    }
    for (const shape of geometry.strokeShapes) {
      content.push(...renderStrokes(node, shape, strokes, geometry.transform));
    }
  }

  const children = renderChildren(node, state, geometry.childMatrix);
  if (children.length > 0) {
    const clippedChildren = readClipsContent(node)
      ? createClippedChildren(node, geometry.box, geometry.transform, children, state)
      : children;
    content.push(clippedChildren);
  }
  if (node.children.length > 0 && !CONTAINER_TYPES.has(node.type)) {
    throw nodeError(node, 'contains children but is not a supported container');
  }

  return wrapNodeContent(content.join(''), opacity);
}

function renderChildren(node: FigmaNode, state: RenderState, parentMatrix: FigmaSvgMatrix): string {
  if (!CONTAINER_TYPES.has(node.type)) {
    return '';
  }
  return node.children.map((child) => renderNode(child, state, parentMatrix)).join('');
}

function renderStrokes(
  node: FigmaNode,
  shape: string,
  paints: ReturnType<typeof readNodePaints>,
  transform: string | undefined,
): string[] {
  return paints.map((paint) => addTransform(renderStrokeElement(node, shape, paint), transform));
}

function addTransform(shape: string, transform: string | undefined): string {
  return transform === undefined ? shape : addAttributes(shape, [['transform', transform]]);
}

function createClippedChildren(
  node: FigmaNode,
  box: { x: number; y: number; width: number; height: number },
  transform: string | undefined,
  children: string,
  state: RenderState,
): string {
  const id = `figma-clip-${state.nextClipId++}`;
  const clipRectangle = addAttributes(
    `<rect x="${formatNumber(box.x)}" y="${formatNumber(box.y)}" width="${formatNumber(box.width)}" height="${formatNumber(box.height)}"/>`,
    transform === undefined ? [] : [['transform', transform]],
  );
  state.definitions.push(
    `<clipPath id="${id}" clipPathUnits="userSpaceOnUse">${clipRectangle}</clipPath>`,
  );
  return `<g clip-path="url(#${id})">${children}</g>`;
}

function readClipsContent(node: FigmaNode): boolean {
  const value = node.source.clipsContent;
  if (value === undefined || value === null) {
    return false;
  }
  if (typeof value !== 'boolean') {
    throw nodeError(node, 'has invalid clipsContent setting');
  }
  return value;
}

function validateNodeFeatures(node: FigmaNode): void {
  if (node.source.isMask === true) {
    throw nodeError(node, 'uses an unsupported mask');
  }

  if (node.source.effects !== undefined && node.source.effects !== null) {
    if (!Array.isArray(node.source.effects)) {
      throw nodeError(node, 'has invalid effects');
    }
    if (node.source.effects.some((effect) => !isRecord(effect) || effect.visible !== false)) {
      throw nodeError(node, 'uses unsupported effects');
    }
  }

  const blendMode = node.source.blendMode;
  if (blendMode !== undefined && blendMode !== 'NORMAL' && blendMode !== 'PASS_THROUGH') {
    throw new Error(
      `unsupported Figma blend mode "${String(blendMode)}" at node ${formatNodeReference(node)}`,
    );
  }

  const cornerSmoothing = node.source.cornerSmoothing ?? 0;
  if (
    typeof cornerSmoothing !== 'number' ||
    !Number.isFinite(cornerSmoothing) ||
    cornerSmoothing !== 0
  ) {
    throw nodeError(node, 'uses unsupported corner smoothing');
  }

  const complexStroke = node.source.complexStrokeProperties;
  if (
    complexStroke !== undefined &&
    complexStroke !== null &&
    (!isRecord(complexStroke) ||
      (complexStroke.type !== undefined && complexStroke.type !== 'BASIC'))
  ) {
    throw nodeError(node, 'uses unsupported complex stroke properties');
  }
}

function missingVectorGeometry(node: FigmaNode, property: string): Error {
  return new Error(
    `Figma vector ${formatNodeReference(node)} has no ${property}; request geometry=paths`,
  );
}
