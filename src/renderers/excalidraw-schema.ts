import type { DiagramWarning } from './types.js';

export const MAX_EXCALIDRAW_JSON_BYTES = 1024 * 1024;
export const MAX_EXCALIDRAW_ELEMENTS = 3_000;
export const MAX_EXCALIDRAW_DEPTH = 100;
export const MAX_EXCALIDRAW_POINTS_PER_ELEMENT = 10_000;
export const MAX_EXCALIDRAW_POINTS_PER_SCENE = 100_000;
export const MAX_EXCALIDRAW_GROUP_IDS = 100;
export const MAX_EXCALIDRAW_NUMBER = 1_000_000;
export const MAX_EXCALIDRAW_SVG_BYTES = 4 * 1024 * 1024;

export type ExcalidrawShapeType = 'rectangle' | 'ellipse' | 'diamond' | 'text' | 'line' | 'arrow';
export type ExcalidrawTextAlign = 'left' | 'center' | 'right';
export type ExcalidrawStrokeStyle = 'solid' | 'dashed' | 'dotted';
export type ExcalidrawArrowhead = string | null;

export interface ExcalidrawPoint {
  x: number;
  y: number;
}

export interface ExcalidrawElement {
  id: string;
  type: string;
  jsonPointer: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  isDeleted: boolean;
  groupIds: string[];
  strokeWidth: number;
  strokeStyle: ExcalidrawStrokeStyle;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: string;
  opacity: number;
  roughness: number;
  roundness: unknown;
  points?: ExcalidrawPoint[];
  startArrowhead?: ExcalidrawArrowhead;
  endArrowhead?: ExcalidrawArrowhead;
  elbowed: boolean;
  text?: string;
  fontSize: number;
  lineHeight: number;
  textAlign: ExcalidrawTextAlign;
  fontFamily: number;
  startBindingId?: string;
  endBindingId?: string;
  containerId?: string;
  frameId?: string;
  boundElementIds: string[];
  references: Array<{ id: string; offset: number }>;
  link?: string;
}

export interface ExcalidrawScene {
  elements: ExcalidrawElement[];
  elementsById: Map<string, ExcalidrawElement>;
  backgroundColor: string;
  warnings: DiagramWarning[];
}

export interface ExcalidrawBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function isSupportedShapeType(type: string): type is ExcalidrawShapeType {
  return (
    type === 'rectangle' ||
    type === 'ellipse' ||
    type === 'diamond' ||
    type === 'text' ||
    type === 'line' ||
    type === 'arrow'
  );
}
