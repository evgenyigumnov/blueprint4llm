import { describe, expect, it } from 'vitest';

import { layoutPencilDocument } from '../src/renderers/pencil-layout.js';
import { parsePencilJson } from '../src/renderers/pencil-json.js';

describe('layoutPencilDocument', () => {
  it('uses absolute root coordinates and positions nested children relative to parents', () => {
    const layout = layoutPencilDocument(
      parsePencilJson(
        JSON.stringify({
          version: '2.21',
          children: [
            {
              id: 'outer',
              type: 'frame',
              x: -10,
              y: 5,
              width: 100,
              height: 100,
              layout: 'none',
              children: [{ id: 'inner', type: 'rectangle', x: 12, y: 9, width: 20, height: 10 }],
            },
            { id: 'outside', type: 'rectangle', x: 130, y: -4, width: 40, height: 20 },
          ],
        }),
      ),
    );

    expect(layout.children[0]).toMatchObject({ x: -10, y: 5, width: 100, height: 100 });
    expect(layout.children[0]?.children[0]).toMatchObject({ x: 2, y: 14, width: 20, height: 10 });
    expect(layout.children[1]).toMatchObject({ x: 130, y: -4 });
    expect(layout.bounds).toEqual({ x: -10, y: -4, width: 180, height: 109 });
  });

  it('positions horizontal children with padding, gap, justification, and cross-axis alignment', () => {
    const layout = layoutPencilDocument(
      parsePencilJson(
        JSON.stringify({
          version: '2.21',
          children: [
            {
              id: 'row',
              type: 'frame',
              x: 10,
              y: 20,
              width: 200,
              height: 100,
              layout: 'horizontal',
              gap: 10,
              padding: [5, 10, 5, 20],
              justifyContent: 'center',
              alignItems: 'center',
              children: [
                { id: 'first', type: 'rectangle', x: 500, y: 500, width: 40, height: 20 },
                { id: 'second', type: 'rectangle', width: 30, height: 10 },
              ],
            },
          ],
        }),
      ),
    );

    expect(layout.children[0]?.children).toMatchObject([
      { x: 75, y: 60, width: 40, height: 20 },
      { x: 125, y: 65, width: 30, height: 10 },
    ]);
  });

  it('positions vertical children and supports end alignment', () => {
    const layout = layoutPencilDocument(
      parsePencilJson(
        JSON.stringify({
          version: '2.21',
          children: [
            {
              id: 'column',
              type: 'frame',
              x: 3,
              y: 7,
              width: 100,
              height: 100,
              layout: 'vertical',
              gap: 4,
              padding: [10, 4, 6, 8],
              justifyContent: 'end',
              alignItems: 'end',
              children: [
                { id: 'first', type: 'rectangle', width: 20, height: 10 },
                { id: 'second', type: 'rectangle', width: 30, height: 15 },
              ],
            },
          ],
        }),
      ),
    );

    expect(layout.children[0]?.children).toMatchObject([
      { x: 79, y: 72, width: 20, height: 10 },
      { x: 69, y: 86, width: 30, height: 15 },
    ]);
  });

  it('computes fit-content frame size from vertical children and asymmetric padding', () => {
    const layout = layoutPencilDocument(
      parsePencilJson(
        JSON.stringify({
          version: '2.21',
          children: [
            {
              id: 'column',
              type: 'frame',
              x: 7,
              y: 8,
              layout: 'vertical',
              gap: 5,
              padding: [2, 3, 4, 5],
              children: [
                { id: 'first', type: 'rectangle', width: 20, height: 10 },
                { id: 'second', type: 'rectangle', width: 15, height: 20 },
              ],
            },
          ],
        }),
      ),
    );

    expect(layout.children[0]).toMatchObject({ x: 7, y: 8, width: 28, height: 41 });
    expect(layout.children[0]?.children).toMatchObject([
      { x: 12, y: 10 },
      { x: 12, y: 25 },
    ]);
    expect(layout.bounds).toEqual({ x: 7, y: 8, width: 28, height: 41 });
  });

  it.each([
    ['space_between', 0, 90],
    ['space_around', 20, 70],
  ] as const)('distributes remaining space with %s', (justifyContent, firstX, secondX) => {
    const layout = layoutPencilDocument(
      parsePencilJson(
        JSON.stringify({
          version: '2.21',
          children: [
            {
              id: 'row',
              type: 'frame',
              width: 100,
              height: 10,
              layout: 'horizontal',
              justifyContent,
              children: [
                { id: 'first', type: 'rectangle', width: 10, height: 10 },
                { id: 'second', type: 'rectangle', width: 10, height: 10 },
              ],
            },
          ],
        }),
      ),
    );

    expect(layout.children[0]?.children.map(({ x }) => x)).toEqual([firstX, secondX]);
  });

  it('uses horizontal layout by default for frames and absolute layout for groups', () => {
    const layout = layoutPencilDocument(
      parsePencilJson(
        JSON.stringify({
          version: '2.21',
          children: [
            {
              id: 'frame',
              type: 'frame',
              width: 50,
              height: 10,
              children: [
                { id: 'one', type: 'rectangle', x: 8, width: 10, height: 10 },
                { id: 'two', type: 'rectangle', x: 30, width: 10, height: 10 },
              ],
            },
            {
              id: 'group',
              type: 'group',
              x: 50,
              y: 20,
              children: [{ id: 'nested', type: 'rectangle', x: -2, y: 5, width: 4, height: 4 }],
            },
          ],
        }),
      ),
    );

    expect(layout.children[0]?.children.map(({ x }) => x)).toEqual([0, 10]);
    expect(layout.children[1]?.children[0]).toMatchObject({ x: 48, y: 25 });
  });

  it('omits disabled nodes and their descendants from the layout and bounds', () => {
    const layout = layoutPencilDocument(
      parsePencilJson(
        JSON.stringify({
          version: '2.21',
          children: [
            { id: 'hidden', type: 'rectangle', x: 1000, width: 100, height: 100, enabled: false },
            {
              id: 'frame',
              type: 'frame',
              x: 1,
              y: 1,
              width: 50,
              height: 50,
              layout: 'none',
              children: [
                { id: 'shown', type: 'rectangle', width: 2, height: 2 },
                {
                  id: 'child-hidden',
                  type: 'rectangle',
                  x: 300,
                  width: 20,
                  height: 20,
                  enabled: false,
                },
              ],
            },
            { id: 'hidden-frame', type: 'frame', width: 200, height: 200, enabled: false },
          ],
        }),
      ),
    );

    expect(layout.children.map(({ node }) => node.id)).toEqual(['frame']);
    expect(layout.children[0]?.children.map(({ node }) => node.id)).toEqual(['shown']);
    expect(layout.bounds).toEqual({ x: 1, y: 1, width: 50, height: 50 });
  });

  it('returns empty bounds for an empty document and rejects oversized drawings', () => {
    expect(
      layoutPencilDocument(parsePencilJson('{"version":"2.21","children":[]}')).bounds,
    ).toEqual({ x: 0, y: 0, width: 0, height: 0 });

    const tooLarge = parsePencilJson(
      JSON.stringify({
        version: '2.21',
        children: [{ id: 'large', type: 'rectangle', width: 16_385, height: 10 }],
      }),
    );
    expect(() => layoutPencilDocument(tooLarge)).toThrow('layout is too large');
  });

  it('requires explicit dimensions for non-container nodes', () => {
    const document = parsePencilJson(
      JSON.stringify({
        version: '2.21',
        children: [{ id: 'box', type: 'rectangle', width: 20 }],
      }),
    );

    expect(() => layoutPencilDocument(document)).toThrow(
      'Pencil rectangle node "box" must specify width and height',
    );
  });
});
