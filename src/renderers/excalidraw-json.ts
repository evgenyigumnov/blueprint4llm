import type { Node as JsonNode } from 'jsonc-parser';

import { ExcalidrawJsonError } from './excalidraw-json-error.js';
import { parseExcalidrawTree } from './excalidraw-json-tree.js';
import {
  getProperty,
  parseBackgroundColor,
  readArrowhead,
  readBindingId,
  readBoolean,
  readBoundElementIds,
  readColor,
  readGroupIds,
  readNumber,
  readNullableId,
  readNullableString,
  readOpaqueJsonValue,
  readPoints,
  readRoughness,
  readStrokeStyle,
  readString,
  readTextAlign,
  requiredNumber,
  requiredProperty,
  requiredString,
  validateOptionalObjects,
} from './excalidraw-json-fields.js';
import { assertXmlSafeString, errorAt } from './excalidraw-json-values.js';
import { readElementReferences } from './excalidraw-json-references.js';
import { ExcalidrawWarningCollector } from './excalidraw-json-warnings.js';
import {
  MAX_EXCALIDRAW_ELEMENTS,
  MAX_EXCALIDRAW_JSON_BYTES,
  MAX_EXCALIDRAW_NUMBER,
  MAX_EXCALIDRAW_POINTS_PER_SCENE,
  type ExcalidrawElement,
  type ExcalidrawScene,
} from './excalidraw-schema.js';

/** Parses one Excalidraw file and returns only validated fields used by the renderer. */
export function parseExcalidrawJson(source: string, signal?: AbortSignal): ExcalidrawScene {
  const sourceBytes = Buffer.byteLength(source, 'utf8');
  if (sourceBytes > MAX_EXCALIDRAW_JSON_BYTES) {
    throw new ExcalidrawJsonError(
      `Excalidraw JSON is too large: ${sourceBytes} bytes (limit ${MAX_EXCALIDRAW_JSON_BYTES} bytes)`,
      source,
      0,
    );
  }

  const { root } = parseExcalidrawTree(source, signal);
  if (root.type !== 'object') {
    throw errorAt(source, root, '', 'Excalidraw JSON must be an object');
  }

  const rootType = requiredString(source, root, '', 'type');
  if (rootType !== 'excalidraw') {
    throw errorAt(
      source,
      getProperty(root, 'type')?.value ?? root,
      '/type',
      'type must be "excalidraw"; clipboard JSON is not supported',
    );
  }
  const version = requiredNumber(source, root, '', 'version');
  if (version !== 2) {
    throw errorAt(
      source,
      getProperty(root, 'version')?.value ?? root,
      '/version',
      'unsupported Excalidraw document version; supported version is 2',
    );
  }

  const elementsNode = requiredProperty(source, root, '', 'elements');
  if (elementsNode.type !== 'array') {
    throw errorAt(source, elementsNode, '/elements', 'elements must be an array');
  }
  const elementNodes = elementsNode.children ?? [];
  if (elementNodes.length > MAX_EXCALIDRAW_ELEMENTS) {
    throw errorAt(
      source,
      elementsNode,
      '/elements',
      `Excalidraw scene has too many elements (limit ${MAX_EXCALIDRAW_ELEMENTS})`,
    );
  }

  const backgroundColor = parseBackgroundColor(source, root);
  validateOptionalObjects(source, root);
  const warnings = new ExcalidrawWarningCollector();
  const elements: ExcalidrawElement[] = [];
  const elementsById = new Map<string, ExcalidrawElement>();
  let totalPoints = 0;

  for (const [index, node] of elementNodes.entries()) {
    if (index % 100 === 0) {
      throwIfAborted(signal);
    }
    const pointer = `/elements/${index}`;
    const element = normalizeElement(source, node, pointer, (count) => {
      totalPoints += count;
      if (totalPoints > MAX_EXCALIDRAW_POINTS_PER_SCENE) {
        throw errorAt(
          source,
          node,
          `${pointer}/points`,
          `Excalidraw scene has too many points (limit ${MAX_EXCALIDRAW_POINTS_PER_SCENE})`,
        );
      }
    });
    if (elementsById.has(element.id)) {
      throw errorAt(
        source,
        getProperty(node, 'id')?.value ?? node,
        `${pointer}/id`,
        `duplicate element ID "${element.id}"`,
      );
    }
    elementsById.set(element.id, element);
    elements.push(element);
    warnings.addElement(node, element);
  }

  warnings.addReferences(elements, elementsById);
  if (!elements.some((element) => !element.isDeleted)) {
    warnings.addEmptyScene(elementsNode.offset);
  }

  return {
    elements,
    elementsById,
    backgroundColor,
    warnings: warnings.toWarnings(source),
  };
}

function normalizeElement(
  source: string,
  node: JsonNode,
  pointer: string,
  addPointCount: (count: number) => void,
): ExcalidrawElement {
  if (node.type !== 'object') {
    throw errorAt(source, node, pointer, 'element must be an object');
  }
  const id = requiredString(source, node, pointer, 'id');
  if (id.trim() === '') {
    throw errorAt(
      source,
      getProperty(node, 'id')?.value ?? node,
      `${pointer}/id`,
      'id must not be empty',
    );
  }
  assertXmlSafeString(source, getProperty(node, 'id')?.value ?? node, `${pointer}/id`, id);
  const type = requiredString(source, node, pointer, 'type');
  if (type.trim() === '') {
    throw errorAt(
      source,
      getProperty(node, 'type')?.value ?? node,
      `${pointer}/type`,
      'type must not be empty',
    );
  }
  assertXmlSafeString(source, getProperty(node, 'type')?.value ?? node, `${pointer}/type`, type);

  const x = readNumber(
    source,
    node,
    pointer,
    'x',
    0,
    -MAX_EXCALIDRAW_NUMBER,
    MAX_EXCALIDRAW_NUMBER,
    true,
  );
  const y = readNumber(
    source,
    node,
    pointer,
    'y',
    0,
    -MAX_EXCALIDRAW_NUMBER,
    MAX_EXCALIDRAW_NUMBER,
    true,
  );
  const width = readNumber(source, node, pointer, 'width', 0, 0, MAX_EXCALIDRAW_NUMBER, true);
  const height = readNumber(source, node, pointer, 'height', 0, 0, MAX_EXCALIDRAW_NUMBER, true);
  const angle = readNumber(
    source,
    node,
    pointer,
    'angle',
    0,
    -MAX_EXCALIDRAW_NUMBER,
    MAX_EXCALIDRAW_NUMBER,
    false,
  );
  const isDeleted = readBoolean(source, node, pointer, 'isDeleted', false);
  const groupIds = readGroupIds(source, node, pointer);
  const strokeWidth = readNumber(source, node, pointer, 'strokeWidth', 1, 0, 100, false);
  const strokeStyle = readStrokeStyle(source, node, pointer);
  const strokeColor = readColor(source, node, pointer, 'strokeColor', '#1e1e1e');
  const backgroundColor = readColor(source, node, pointer, 'backgroundColor', 'transparent');
  const fillStyle = readString(source, node, pointer, 'fillStyle', 'solid');
  if (!['solid', 'hachure', 'cross-hatch', 'zigzag'].includes(fillStyle)) {
    throw errorAt(
      source,
      getProperty(node, 'fillStyle')?.value ?? node,
      `${pointer}/fillStyle`,
      'fillStyle must be solid, hachure, cross-hatch, or zigzag',
    );
  }
  const opacity = readNumber(source, node, pointer, 'opacity', 100, 0, 100, false);
  const roughness = readRoughness(source, node, pointer);
  const roundness = readOpaqueJsonValue(source, node, pointer, 'roundness', null);
  const elbowed = readBoolean(source, node, pointer, 'elbowed', false);
  const points = readPoints(source, node, pointer, addPointCount);
  if ((type === 'line' || type === 'arrow') && points === undefined) {
    throw errorAt(source, node, `${pointer}/points`, `${type} must contain a points array`);
  }

  const text = type === 'text' ? requiredString(source, node, pointer, 'text') : undefined;
  if (text !== undefined) {
    assertXmlSafeString(source, getProperty(node, 'text')?.value ?? node, `${pointer}/text`, text);
  }
  const fontSize =
    type === 'text' ? readNumber(source, node, pointer, 'fontSize', 20, 1, 512, false) : 20;
  const lineHeight =
    type === 'text' ? readNumber(source, node, pointer, 'lineHeight', 1.25, 0.5, 4, false) : 1.25;
  const textAlign = type === 'text' ? readTextAlign(source, node, pointer) : 'left';
  const fontFamily =
    type === 'text' ? readNumber(source, node, pointer, 'fontFamily', 1, 1, 4, false) : 1;
  if (!Number.isInteger(fontFamily)) {
    throw errorAt(
      source,
      getProperty(node, 'fontFamily')?.value ?? node,
      `${pointer}/fontFamily`,
      'fontFamily must be an integer from 1 to 4',
    );
  }

  const startArrowhead = readArrowhead(source, node, pointer, 'startArrowhead');
  const endArrowhead = readArrowhead(source, node, pointer, 'endArrowhead');
  const startBindingId = readBindingId(source, node, pointer, 'startBinding');
  const endBindingId = readBindingId(source, node, pointer, 'endBinding');
  const containerId = readNullableId(source, node, pointer, 'containerId');
  const frameId = readNullableId(source, node, pointer, 'frameId');
  const boundElementIds = readBoundElementIds(source, node, pointer);
  const references = readElementReferences(
    node,
    startBindingId,
    endBindingId,
    containerId,
    frameId,
    boundElementIds,
  );
  const link = readNullableString(source, node, pointer, 'link');

  return {
    id,
    type,
    jsonPointer: pointer,
    x,
    y,
    width,
    height,
    angle,
    isDeleted,
    groupIds,
    strokeWidth,
    strokeStyle,
    strokeColor,
    backgroundColor,
    fillStyle,
    opacity,
    roughness,
    roundness,
    ...(points === undefined ? {} : { points }),
    ...(startArrowhead === undefined ? {} : { startArrowhead }),
    ...(endArrowhead === undefined ? {} : { endArrowhead }),
    elbowed,
    ...(text === undefined ? {} : { text }),
    fontSize,
    lineHeight,
    textAlign,
    fontFamily,
    ...(startBindingId === undefined ? {} : { startBindingId }),
    ...(endBindingId === undefined ? {} : { endBindingId }),
    ...(containerId === undefined ? {} : { containerId }),
    ...(frameId === undefined ? {} : { frameId }),
    boundElementIds,
    references,
    ...(link === undefined ? {} : { link }),
  };
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new Error('diagram rendering was aborted');
  }
}
