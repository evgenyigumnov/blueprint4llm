import { describe, expect, it } from 'vitest';

import {
  MAX_PENCIL_DEPTH,
  MAX_PENCIL_JSON_BYTES,
  MAX_PENCIL_NODES,
} from '../src/renderers/pencil-schema.js';
import { parsePencilJson } from '../src/renderers/pencil-json.js';
import { PencilJsonError } from '../src/renderers/pencil-json-error.js';

describe('parsePencilJson', () => {
  it('accepts JSONC comments and returns only validated document fields', () => {
    const document = parsePencilJson(`{
      // Pencil schema version
      "version": "2.21",
      "children": [{
        "id": "profile",
        "type": "frame",
        "x": -4,
        "y": 0,
        "width": 320,
        "height": 240,
        "layout": "vertical",
        "gap": 12,
        "padding": [20, 18],
        "justifyContent": "center",
        "alignItems": "center",
        "clip": true,
        "cornerRadius": [8, 8, 0, 0],
        "opacity": 0.9,
        "rotation": -2,
        "fill": "#FFFFFF",
        "stroke": "#202124",
        "strokeWidth": 1,
        "strokeLinecap": "round",
        "strokeLinejoin": "bevel",
        "children": [{
          "id": "title",
          "type": "text",
          "content": "Profile",
          "width": 280,
          "height": 36,
          "fontFamily": "Arial",
          "fontSize": 24,
          "fontWeight": "600",
          "fontStyle": "italic",
          "textAlign": "center",
          "textAlignVertical": "middle",
          "textGrowth": "fixed-width",
          "letterSpacing": 0,
          "lineHeight": 1.2,
          "underline": true,
          "strikethrough": false,
          "fill": "#202124"
        }]
      }]
    }`);

    expect(document.version).toBe('2.21');
    expect(document.children[0]).toMatchObject({
      id: 'profile',
      type: 'frame',
      layout: 'vertical',
      cornerRadius: [8, 8, 0, 0],
      padding: [20, 18],
    });
    expect(document.children[0]?.children).toEqual([
      expect.objectContaining({ id: 'title', type: 'text', content: 'Profile', fontSize: 24 }),
    ]);
  });

  it('accepts the supported shape types and their schema fields', () => {
    const document = parsePencilJson(
      JSON.stringify({
        version: '2.21',
        children: [
          { id: 'rect', type: 'rectangle', width: 10, height: 20, cornerRadius: 4 },
          { id: 'oval', type: 'ellipse', width: 12, height: 8, fill: '#abc' },
          { id: 'star', type: 'polygon', width: 24, height: 24, polygonCount: 5 },
          { id: 'shape', type: 'path', geometry: 'M0 0 L8 8', fillRule: 'evenodd' },
          {
            id: 'group',
            type: 'group',
            layout: 'horizontal',
            gap: 4,
            padding: [1, 2, 3, 4],
            justifyContent: 'space_between',
            alignItems: 'end',
            children: [{ id: 'child', type: 'rectangle' }],
          },
        ],
      }),
    );

    expect(document.children.map(({ type }) => type)).toEqual([
      'rectangle',
      'ellipse',
      'polygon',
      'path',
      'group',
    ]);
  });

  it('reports syntax errors with their JSONC line and column', () => {
    const source = '{\n  "version": "2.21",\n  "children": [\n';

    try {
      parsePencilJson(source);
      expect.fail('Expected invalid JSONC to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(PencilJsonError);
      expect(error).toMatchObject({ line: 4, column: 1 });
      expect(error).toHaveProperty('message', expect.stringContaining('invalid Pencil JSONC'));
    }
  });

  it('rejects trailing commas', () => {
    expect(() => parsePencilJson('{"version":"2.21","children":[],}')).toThrow(
      'invalid Pencil JSONC',
    );
  });

  it.each([
    ['non-object root', '[]', 'Pencil document must be an object'],
    ['missing version', '{"children":[]}', 'non-empty string version'],
    ['empty version', '{"version":" ","children":[]}', 'non-empty string version'],
    ['unknown version', '{"version":"9.0","children":[]}', 'unsupported Pencil schema version'],
    ['missing children', '{"version":"2.21"}', 'must contain a children array'],
    [
      'unknown document property',
      '{"version":"2.21","children":[],"variables":{}}',
      'unsupported property "variables"',
    ],
  ])('rejects %s', (_name, source, message) => {
    expect(() => parsePencilJson(source)).toThrow(message);
  });

  it.each([
    ['missing id', { type: 'rectangle' }, 'id must be a non-empty string'],
    ['empty id', { id: ' ', type: 'rectangle' }, 'id must be a non-empty string'],
    ['slash in id', { id: 'a/b', type: 'rectangle' }, 'must not contain "/"'],
    ['missing type', { id: 'node' }, 'unsupported type'],
    ['unknown type', { id: 'node', type: 'browser' }, 'unsupported type "browser"'],
    ['unsupported node', { id: 'node', type: 'script' }, 'unsupported type "script"'],
    [
      'unknown visible property',
      { id: 'node', type: 'rectangle', effect: [] },
      'unsupported property "effect"',
    ],
    ['invalid width', { id: 'node', type: 'rectangle', width: -1 }, 'width must be greater than 0'],
    [
      'invalid opacity',
      { id: 'node', type: 'rectangle', opacity: 2 },
      'opacity must be between 0 and 1',
    ],
    ['variable color', { id: 'node', type: 'rectangle', fill: '$color.brand' }, 'solid hex color'],
    [
      'invalid text style',
      { id: 'node', type: 'text', fontStyle: 'comic' },
      'fontStyle must be normal, italic, oblique',
    ],
  ])('rejects %s', (_name, node, message) => {
    expect(() => parsePencilJson(JSON.stringify({ version: '2.21', children: [node] }))).toThrow(
      message,
    );
  });

  it.each([
    [
      'a path without geometry',
      { id: 'path', type: 'path' },
      'Pencil path node "path" must specify geometry',
    ],
    [
      'active path data',
      { id: 'path', type: 'path', geometry: 'M0 0" onload="alert(1)' },
      'geometry must contain SVG path commands and numbers only',
    ],
    [
      'a path viewBox with zero width',
      { id: 'path', type: 'path', geometry: 'M0 0', viewBox: [0, 0, 0, 10] },
      'viewBox width and height must be greater than 0',
    ],
    [
      'a polygon with too many sides',
      { id: 'polygon', type: 'polygon', polygonCount: 257 },
      'polygonCount exceeds 256',
    ],
  ])('rejects %s', (_name, node, message) => {
    expect(() => parsePencilJson(JSON.stringify({ version: '2.21', children: [node] }))).toThrow(
      message,
    );
  });

  it('rejects duplicate IDs and duplicate JSON keys', () => {
    const duplicateIds = {
      version: '2.21',
      children: [
        { id: 'same', type: 'rectangle' },
        { id: 'same', type: 'ellipse' },
      ],
    };
    expect(() => parsePencilJson(JSON.stringify(duplicateIds))).toThrow('duplicate node id "same"');
    expect(() => parsePencilJson('{"version":"2.21","version":"2.21","children":[]}')).toThrow(
      'duplicate JSON property "version"',
    );
  });

  it('reports semantic errors at the property location', () => {
    const source =
      '{\n  "version": "2.21",\n  "children": [{"id":"box","type":"rectangle","opacity":2}]\n}';
    let error: unknown;
    try {
      parsePencilJson(source);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(PencilJsonError);
    expect(error).toMatchObject({ line: 3, column: source.split('\n')[2]!.indexOf('2') + 1 });
  });

  it('rejects documents above the node, depth, and source limits', () => {
    const manyNodes = Array.from({ length: MAX_PENCIL_NODES + 1 }, (_, index) => ({
      id: `n${index}`,
      type: 'rectangle',
    }));
    expect(() => parsePencilJson(JSON.stringify({ version: '2.21', children: manyNodes }))).toThrow(
      'too many nodes',
    );

    let nested: Record<string, unknown> = { id: 'leaf', type: 'rectangle' };
    for (let depth = 1; depth < MAX_PENCIL_DEPTH; depth += 1) {
      nested = { id: `frame-${depth}`, type: 'frame', children: [nested] };
    }
    const tooDeep = {
      version: '2.21',
      children: [{ id: 'outer', type: 'frame', children: [nested] }],
    };
    expect(() => parsePencilJson(JSON.stringify(tooDeep))).toThrow('nesting exceeds the limit');

    expect(() => parsePencilJson(`"${'x'.repeat(MAX_PENCIL_JSON_BYTES)}"`)).toThrow(
      'Pencil JSONC is too large',
    );
  });
});
