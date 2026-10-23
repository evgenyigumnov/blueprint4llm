import { describe, expect, it } from 'vitest';

import {
  getArrowheadGeometry,
  getExcalidrawElementBounds,
  placeholderBox,
  scenePoints,
} from '../src/renderers/excalidraw-geometry.js';
import { parseExcalidrawJson } from '../src/renderers/excalidraw-json.js';

function element(value: Record<string, unknown>) {
  const scene = parseExcalidrawJson(
    JSON.stringify({ type: 'excalidraw', version: 2, elements: [value] }),
  );
  return scene.elements[0]!;
}

describe('Excalidraw geometry', () => {
  it('rotates a rectangle around its center using radians', () => {
    const bounds = getExcalidrawElementBounds(
      element({
        id: 'rotated',
        type: 'rectangle',
        x: 0,
        y: 0,
        width: 10,
        height: 20,
        angle: Math.PI / 2,
        strokeWidth: 0,
      }),
    );

    expect(bounds.minX).toBeCloseTo(-5);
    expect(bounds.maxX).toBeCloseTo(15);
    expect(bounds.minY).toBeCloseTo(5);
    expect(bounds.maxY).toBeCloseTo(15);
  });

  it('uses the nearest non-zero segments to orient both arrowheads', () => {
    const arrow = element({
      id: 'route',
      type: 'arrow',
      x: 10,
      y: 20,
      width: 10,
      height: 0,
      points: [
        [0, 0],
        [0, 0],
        [10, 0],
      ],
      startArrowhead: 'arrow',
      endArrowhead: 'triangle',
      strokeWidth: 2,
    });

    expect(scenePoints(arrow)).toEqual([
      { x: 10, y: 20 },
      { x: 10, y: 20 },
      { x: 20, y: 20 },
    ]);
    expect(getArrowheadGeometry(arrow, true)).toMatchObject({
      kind: 'arrow',
      points: [
        { x: 10, y: 20 },
        { x: 18, y: 16.32 },
        { x: 18, y: 23.68 },
      ],
    });
    expect(getArrowheadGeometry(arrow, false)).toMatchObject({ kind: 'triangle' });
  });

  it('does not create an arrowhead for an all-identical path', () => {
    const arrow = element({
      id: 'point',
      type: 'arrow',
      x: 5,
      y: 8,
      width: 0,
      height: 0,
      points: [
        [0, 0],
        [0, 0],
      ],
      startArrowhead: 'arrow',
      endArrowhead: 'triangle',
    });
    expect(getArrowheadGeometry(arrow, true)).toBeUndefined();
    expect(getArrowheadGeometry(arrow, false)).toBeUndefined();
    expect(getExcalidrawElementBounds(arrow)).toMatchObject({ minX: 4, minY: 7, maxX: 6, maxY: 9 });
  });

  it('includes long multi-line text beyond its saved height in visual bounds', () => {
    const text = element({
      id: 'copy',
      type: 'text',
      x: -10,
      y: 20,
      width: 24,
      height: 10,
      text: 'a long first line\nand another line',
      fontSize: 16,
      lineHeight: 1.5,
      textAlign: 'left',
      fontFamily: 2,
    });
    const bounds = getExcalidrawElementBounds(text);
    expect(bounds.maxX).toBeGreaterThan(150);
    expect(bounds.minY).toBeLessThan(20);
    expect(bounds.maxY).toBeGreaterThan(50);
  });

  it('keeps placeholder bounds anchored to the element position', () => {
    const image = element({ id: 'picture', type: 'image', x: -4, y: 15, width: 40, height: 16 });
    expect(placeholderBox(image)).toEqual({ x: -4, y: 15, width: 120, height: 32 });
  });
});
