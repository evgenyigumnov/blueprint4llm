import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  MAX_EXCALIDRAW_ELEMENTS,
  MAX_EXCALIDRAW_GROUP_IDS,
  MAX_EXCALIDRAW_JSON_BYTES,
  MAX_EXCALIDRAW_POINTS_PER_ELEMENT,
  MAX_EXCALIDRAW_POINTS_PER_SCENE,
} from '../src/renderers/excalidraw-schema.js';
import { ExcalidrawJsonError } from '../src/renderers/excalidraw-json-error.js';
import { parseExcalidrawJson } from '../src/renderers/excalidraw-json.js';

const fixture = (name: string) =>
  readFile(new URL(`./fixtures/excalidraw/${name}`, import.meta.url), 'utf8');
const root = (elements: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ type: 'excalidraw', version: 2, elements, ...extra });
const rectangle = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'rectangle',
  x: 0,
  y: 0,
  width: 20,
  height: 10,
  ...extra,
});

describe('parseExcalidrawJson', () => {
  it('accepts an official Excalidraw v2 scene element and applies only documented fallbacks', async () => {
    const scene = parseExcalidrawJson(await fixture('real-export-v2.excalidraw'));

    expect(scene.elements).toHaveLength(1);
    expect(scene.elements[0]).toMatchObject({
      id: 'vWrqOAfkind2qcm7LDAGZ',
      type: 'ellipse',
      x: 414,
      width: 214,
      angle: 0,
      groupIds: [],
      strokeColor: '#000000',
      roundness: null,
      jsonPointer: '/elements/0',
    });
    expect(scene.warnings.map((warning) => warning.message)).toEqual([
      expect.stringContaining('roughness is rendered as a smooth outline'),
      expect.stringContaining('fill style "hachure" is rendered as a solid fill'),
    ]);
  });

  it('applies defaults without replacing invalid supplied values', () => {
    const scene = parseExcalidrawJson(root([rectangle('box')]));
    expect(scene.elements[0]).toMatchObject({
      angle: 0,
      isDeleted: false,
      groupIds: [],
      strokeWidth: 1,
      strokeStyle: 'solid',
      strokeColor: '#1e1e1e',
      backgroundColor: 'transparent',
      fillStyle: 'solid',
      opacity: 100,
      roughness: 0,
      roundness: null,
      elbowed: false,
    });
    expect(scene.backgroundColor).toBe('#ffffff');
    expect(() => parseExcalidrawJson(root([rectangle('box', { opacity: 120 })]))).toThrow(
      /opacity must be a finite number/,
    );
  });

  it('rejects comments, trailing commas, duplicate keys, and duplicate IDs', () => {
    expect(() =>
      parseExcalidrawJson('{/*comment*/"type":"excalidraw","version":2,"elements":[]}'),
    ).toThrow('invalid Excalidraw JSON');
    expect(() => parseExcalidrawJson('{"type":"excalidraw","version":2,"elements":[],}')).toThrow(
      'invalid Excalidraw JSON',
    );
    expect(() =>
      parseExcalidrawJson('{"type":"excalidraw","version":2,"elements":[],"version":2}'),
    ).toThrow('duplicate JSON property "version" at version');
    expect(() => parseExcalidrawJson(root([rectangle('same'), rectangle('same')]))).toThrow(
      'duplicate element ID "same" at elements[1].id',
    );
  });

  it.each([
    ['clipboard data', { type: 'excalidraw/clipboard', elements: [] }, '/type'],
    ['unsupported document version', { type: 'excalidraw', version: 1, elements: [] }, '/version'],
    ['array root', [], ''],
    ['missing elements', { type: 'excalidraw', version: 2 }, '/elements'],
  ])('rejects %s at a useful JSON Pointer', (_name, value, pointer) => {
    let caught: unknown;
    try {
      parseExcalidrawJson(JSON.stringify(value));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ExcalidrawJsonError);
    expect(caught).toHaveProperty('jsonPointer', pointer);
  });

  it('reports exact field locations with CRLF input', () => {
    const source =
      '{\r\n  "type": "excalidraw",\r\n  "version": 2,\r\n  "elements": [{"id":"box","type":"rectangle","x":0,"y":0,"width":"bad","height":10}]\r\n}';
    let caught: unknown;
    try {
      parseExcalidrawJson(source);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ExcalidrawJsonError);
    expect(caught).toMatchObject({ jsonPointer: '/elements/0/width', line: 4 });
    expect((caught as ExcalidrawJsonError).column).toBe(
      source.split('\r\n')[3]!.indexOf('"bad"') + 1,
    );
    expect((caught as Error).message).toContain('elements[0].width');
  });

  it('rejects invalid colors, unsupported stroke styles, and unsafe SVG text', () => {
    expect(() =>
      parseExcalidrawJson(root([rectangle('box', { strokeColor: 'url(#evil)' })])),
    ).toThrow('strokeColor must be a hex color or "transparent"');
    expect(() => parseExcalidrawJson(root([rectangle('box', { strokeStyle: 'wavy' })]))).toThrow(
      'strokeStyle must be solid, dashed, or dotted',
    );
    expect(() =>
      parseExcalidrawJson(root([{ ...rectangle('text'), type: 'text', text: 'bad\u0000text' }])),
    ).toThrow('cannot be represented in SVG');
  });

  it.each(['\uFFFE', '\uFFFF', '\uD800'])('rejects XML-forbidden code point %s', (value) => {
    const text = { ...rectangle('text'), type: 'text', text: `safe${value}value` };
    expect(() => parseExcalidrawJson(root([text]))).toThrow(
      'string contains a character that cannot be represented in SVG',
    );
  });

  it('validates points, group IDs, dimensions, and element counts before allocating scene geometry', () => {
    const tooManyElements = Array.from({ length: MAX_EXCALIDRAW_ELEMENTS + 1 }, (_, index) =>
      rectangle(String(index)),
    );
    expect(() => parseExcalidrawJson(root(tooManyElements))).toThrow('too many elements');

    const tooManyGroups = rectangle('groups', {
      groupIds: Array.from({ length: MAX_EXCALIDRAW_GROUP_IDS + 1 }, (_, index) => `g-${index}`),
    });
    expect(() => parseExcalidrawJson(root([tooManyGroups]))).toThrow('groupIds exceed the limit');

    const tooManyLinePoints = {
      id: 'line',
      type: 'line',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      points: Array.from({ length: MAX_EXCALIDRAW_POINTS_PER_ELEMENT + 1 }, () => [0, 0]),
    };
    expect(() => parseExcalidrawJson(root([tooManyLinePoints]))).toThrow('per-element limit');

    const maximumLine = (id: string) => ({
      id,
      type: 'line',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      points: Array.from({ length: MAX_EXCALIDRAW_POINTS_PER_ELEMENT }, () => [0, 0]),
    });
    expect(() =>
      parseExcalidrawJson(
        root(Array.from({ length: 11 }, (_, index) => maximumLine(String(index)))),
      ),
    ).toThrow(`scene has too many points (limit ${MAX_EXCALIDRAW_POINTS_PER_SCENE})`);

    expect(() => parseExcalidrawJson(root([rectangle('wide', { width: 1_000_001 })]))).toThrow(
      'width must be a finite number',
    );
  });

  it('enforces the source and nesting limits before parsing the whole JSON tree', () => {
    const oversize = root([], { note: 'x'.repeat(MAX_EXCALIDRAW_JSON_BYTES) });
    expect(() => parseExcalidrawJson(oversize)).toThrow('Excalidraw JSON is too large');

    const nested = `${'{'.repeat(101)}"x":0${'}'.repeat(101)}`;
    const tooDeep = `{"type":"excalidraw","version":2,"elements":[],"extra":${nested}}`;
    expect(() => parseExcalidrawJson(tooDeep)).toThrow('nesting exceeds the limit of 100');
  });

  it('does not treat element version as the document version and warns on missing references', async () => {
    const scene = parseExcalidrawJson(
      root([
        {
          ...rectangle('arrow'),
          type: 'arrow',
          points: [
            [0, 0],
            [20, 0],
          ],
          version: 999,
          startBinding: { elementId: 'gone' },
        },
      ]),
    );
    expect(scene.warnings).toMatchObject([
      { message: expect.stringContaining('missing or deleted element "gone"'), line: 1 },
    ]);
    expect(scene.elements[0]?.jsonPointer).toBe('/elements/0');
    expect((await fixture('architectural-scene-v2.excalidraw')).length).toBeGreaterThan(0);
  });
});
