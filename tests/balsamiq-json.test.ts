import { describe, expect, it } from 'vitest';

import {
  MAX_BALSAMIQ_CONTROLS,
  MAX_BALSAMIQ_DEPTH,
  MAX_BALSAMIQ_JSON_BYTES,
  parseBalsamiqJson,
} from '../src/renderers/balsamiq-json.js';
import { BalsamiqJsonError } from '../src/renderers/balsamiq-json-error.js';

describe('parseBalsamiqJson', () => {
  it('normalizes string geometry, measured dimensions, properties, and layer order', () => {
    const mockup = parseBalsamiqJson(
      JSON.stringify({
        mockup: {
          version: '1.0',
          mockupW: '360',
          mockupH: '640',
          controls: {
            control: [
              {
                ID: 'later',
                typeID: 'Label',
                x: '12.5',
                y: '42',
                measuredW: '120',
                measuredH: '28',
                zOrder: '4',
                properties: {
                  text: 'Profile',
                  size: '18',
                  bold: 'true',
                  align: 'center',
                  ignored: '<script>ignored()</script>',
                },
              },
              {
                ID: 'canvas',
                typeID: 'Canvas',
                x: '0',
                y: '0',
                w: '360',
                h: '640',
                zOrder: '0',
                properties: { color: '16777215' },
              },
              {
                ID: 'button',
                typeID: 'Button',
                x: 24,
                y: 80,
                w: 312,
                h: 48,
                zOrder: '2',
                properties: { text: 'Continue', color: '#345678' },
              },
            ],
          },
        },
      }),
    );

    expect(mockup.width).toBe(360);
    expect(mockup.height).toBe(640);
    expect(mockup.canvas).toMatchObject({ id: 'canvas', properties: { color: '#ffffff' } });
    expect(mockup.controls.map(({ id }) => id)).toEqual(['button', 'later']);
    expect(mockup.controls[1]).toMatchObject({
      x: 12.5,
      y: 42,
      width: 120,
      height: 28,
      properties: { text: 'Profile', fontSize: 18, bold: true, align: 'center' },
    });
    expect(JSON.stringify(mockup)).not.toContain('ignored');
  });

  it('uses Canvas dimensions when root dimensions are absent', () => {
    const mockup = parseBalsamiqJson(
      JSON.stringify({
        mockup: {
          controls: {
            control: [
              { ID: 'canvas', typeID: 'Canvas', x: '0', y: '0', w: '300', h: '500', zOrder: '0' },
            ],
          },
        },
      }),
    );

    expect(mockup).toMatchObject({ width: 300, height: 500, controls: [] });
  });

  it('reads the documented measuredW and measuredH root dimensions without a Canvas control', () => {
    const mockup = parseBalsamiqJson(
      JSON.stringify({
        mockup: {
          measuredW: '800',
          measuredH: '600',
          version: '1.0',
          controls: {
            control: [
              {
                ID: 'title',
                typeID: 'Title',
                x: '24',
                y: '24',
                measuredW: '752',
                measuredH: '36',
                zOrder: '0',
                properties: { text: 'Documented wireframe' },
              },
            ],
          },
        },
      }),
    );

    expect(mockup).toMatchObject({ width: 800, height: 600, controls: [{ id: 'title' }] });
  });

  it('accepts all planned control types and supports zero-sized line axes', () => {
    const types = [
      'Label',
      'Title',
      'SubTitle',
      'Paragraph',
      'TextInput',
      'TextArea',
      'Button',
      'CheckBox',
      'RadioButton',
      'ComboBox',
      'List',
      'Rectangle',
      'Line',
    ];
    const controls = types.map((typeID, index) => ({
      ID: String(index + 1),
      typeID,
      x: '0',
      y: '0',
      w: typeID === 'Line' ? '24' : '100',
      h: typeID === 'Line' ? '0' : '32',
      zOrder: String(index + 1),
    }));

    expect(
      parseBalsamiqJson(
        JSON.stringify({
          mockup: { mockupW: '200', mockupH: '100', controls: { control: controls } },
        }),
      ).controls.map(({ type }) => type),
    ).toEqual(types);
  });

  it.each([
    ['invalid JSON', '{"mockup": }', 'invalid Balsamiq JSON'],
    ['non-object root', '[]', 'Balsamiq JSON must be an object'],
    ['missing mockup', '{}', 'must contain a mockup object'],
    ['invalid controls object', '{"mockup":{"controls":[]}}', 'mockup.controls must be an object'],
    ['missing controls array', '{"mockup":{"controls":{}}}', 'controls.control must be an array'],
    [
      'empty controls array',
      '{"mockup":{"controls":{"control":[]}}}',
      'controls.control must not be empty',
    ],
    [
      'invalid control',
      JSON.stringify({ mockup: { mockupW: '10', mockupH: '10', controls: { control: [null] } } }),
      'control at index 1 must be an object',
    ],
    [
      'empty control ID',
      controlSource({ ID: ' ', typeID: 'Button' }),
      'ID must be a non-empty string',
    ],
    ['duplicate control IDs', controlSource({ duplicate: true }), 'duplicate control ID "button"'],
    [
      'unknown type with ID context',
      controlSource({ typeID: 'WebView' }),
      'control "button" has an unsupported typeID "WebView"',
    ],
    ['invalid x coordinate', controlSource({ x: 'left' }), 'x must be a finite number'],
    ['missing width', controlSource({ omitWidth: true }), 'width must be a finite number'],
    ['invalid height', controlSource({ h: 'Infinity' }), 'height must be a finite number'],
    ['invalid zOrder', controlSource({ zOrder: 'front' }), 'zOrder must be a finite number'],
    ['invalid root width', controlSource({ mockupW: 'auto' }), 'mockupW must be a finite number'],
    ['invalid text value', controlSource({ text: 12 }), 'text must be a string'],
    ['invalid boolean value', controlSource({ bold: 'yes' }), 'bold must be true or false'],
    [
      'invalid alignment',
      controlSource({ align: 'justify' }),
      'align must be left, center, or right',
    ],
    [
      'invalid color',
      controlSource({ color: 'url(https://example.com)' }),
      '24-bit Balsamiq color',
    ],
    ['duplicate JSON keys', '{"mockup":{},"mockup":{}}', 'duplicate JSON property "mockup"'],
  ])('rejects %s', (_name, source, message) => {
    expect(() => parseBalsamiqJson(source)).toThrow(message);
  });

  it('falls back from a missing control size to measuredW and measuredH', () => {
    const mockup = parseBalsamiqJson(
      controlSource({
        omitWidth: true,
        omitHeight: true,
        measuredW: '80',
        measuredH: '24',
      }),
    );
    expect(mockup.controls[0]).toMatchObject({ width: 80, height: 24 });
  });

  it('rejects a mockup without dimensions in its root or Canvas', () => {
    const source = JSON.stringify({
      mockup: {
        controls: {
          control: [
            { ID: 'button', typeID: 'Button', x: '0', y: '0', w: '10', h: '10', zOrder: '0' },
          ],
        },
      },
    });
    expect(() => parseBalsamiqJson(source)).toThrow('mockup must include measuredW/mockupW');
  });

  it('reports a JSON syntax position inside the source', () => {
    try {
      parseBalsamiqJson('{\n  "mockup": }');
      expect.fail('Expected JSON syntax error');
    } catch (error) {
      expect(error).toBeInstanceOf(BalsamiqJsonError);
      expect(error).toMatchObject({ line: 2, column: 13 });
    }
  });

  it('rejects duplicate Canvas controls and malformed dimensions', () => {
    const canvas = {
      ID: 'canvas',
      typeID: 'Canvas',
      x: '0',
      y: '0',
      w: '100',
      h: '100',
      zOrder: '0',
    };
    const source = JSON.stringify({
      mockup: { controls: { control: [canvas, { ...canvas, ID: 'canvas-2', zOrder: '1' }] } },
    });
    expect(() => parseBalsamiqJson(source)).toThrow('at most one Canvas control');
    expect(() => parseBalsamiqJson(controlSource({ w: '-1' }))).toThrow(
      'width must be greater than zero',
    );
  });

  it('enforces source, nesting, and control-count limits', () => {
    expect(() => parseBalsamiqJson(' '.repeat(MAX_BALSAMIQ_JSON_BYTES + 1))).toThrow(
      'Balsamiq JSON is too large',
    );
    const tooDeep = `${'['.repeat(MAX_BALSAMIQ_DEPTH + 1)}0${']'.repeat(MAX_BALSAMIQ_DEPTH + 1)}`;
    expect(() => parseBalsamiqJson(tooDeep)).toThrow('nesting exceeds the limit');

    const controls = Array.from({ length: MAX_BALSAMIQ_CONTROLS + 1 }, (_, index) => ({
      ID: String(index),
      typeID: 'Line',
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      zOrder: index,
    }));
    const source = JSON.stringify({
      mockup: { mockupW: '10', mockupH: '10', controls: { control: controls } },
    });
    expect(Buffer.byteLength(source)).toBeLessThan(MAX_BALSAMIQ_JSON_BYTES);
    expect(() => parseBalsamiqJson(source)).toThrow('too many controls');
  });
});

function controlSource(
  options: {
    ID?: string;
    typeID?: string;
    x?: string;
    h?: string;
    w?: string;
    zOrder?: string;
    mockupW?: string;
    omitWidth?: boolean;
    omitHeight?: boolean;
    measuredW?: string;
    measuredH?: string;
    text?: unknown;
    bold?: unknown;
    align?: string;
    color?: string;
    duplicate?: boolean;
  } = {},
): string {
  const control: Record<string, unknown> = {
    ID: options.ID ?? 'button',
    typeID: options.typeID ?? 'Button',
    x: options.x ?? '24',
    y: '80',
    zOrder: options.zOrder ?? '1',
    properties: {
      text: options.text ?? 'Continue',
      ...(options.bold === undefined ? {} : { bold: options.bold }),
      ...(options.align === undefined ? {} : { align: options.align }),
      ...(options.color === undefined ? {} : { color: options.color }),
    },
  };
  if (!options.omitWidth) {
    control.w = options.w ?? '312';
  }
  if (!options.omitHeight) {
    control.h = options.h ?? '48';
  }
  if (options.measuredW !== undefined) {
    control.measuredW = options.measuredW;
  }
  if (options.measuredH !== undefined) {
    control.measuredH = options.measuredH;
  }
  const controls = [control];
  if (options.duplicate) {
    controls.push({ ...control, zOrder: '2' });
  }
  return JSON.stringify({
    mockup: {
      mockupW: options.mockupW ?? '360',
      mockupH: '640',
      controls: { control: controls },
    },
  });
}
