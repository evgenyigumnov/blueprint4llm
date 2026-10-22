import { describe, expect, it } from 'vitest';

import { MAX_BALSAMIQ_CANVAS_SIDE, parseBalsamiqJson } from '../src/renderers/balsamiq-json.js';
import { renderBalsamiqSvg } from '../src/renderers/balsamiq-svg.js';

describe('renderBalsamiqSvg', () => {
  it('renders each planned control type with the right SVG element', () => {
    const svg = renderBalsamiqSvg(
      parseBalsamiqJson(
        JSON.stringify({
          mockup: {
            mockupW: '360',
            mockupH: '640',
            controls: {
              control: [
                control('label', 'Label', { text: 'Profile' }),
                control('title', 'Title', { text: 'Welcome' }),
                control('subtitle', 'SubTitle', { text: 'Account' }),
                control('paragraph', 'Paragraph', { text: 'A short note' }),
                control('input', 'TextInput', { text: 'email@example.com' }),
                control('textarea', 'TextArea', { text: 'First line\nSecond line' }, { h: '64' }),
                control('button', 'Button', { text: 'Continue' }),
                control('check', 'CheckBox', { text: 'Remember me', checked: 'true' }),
                control('radio', 'RadioButton', { text: 'Option A', selected: 'true' }),
                control('combo', 'ComboBox', { text: 'Choose one' }),
                control('list', 'List', { text: 'One\nTwo' }),
                control('rect', 'Rectangle', { text: 'Panel' }),
                control('line', 'Line', {}, { w: '40', h: '0' }),
              ],
            },
          },
        }),
      ),
    );

    expect(svg).toContain('class="balsamiq-canvas"');
    expect(svg).toContain('class="balsamiq-control balsamiq-control--label"');
    expect(svg).toContain('class="balsamiq-control balsamiq-control--button"');
    expect(svg).toContain('<rect');
    expect(svg).toContain('<circle');
    expect(svg).toContain('<line');
    expect(svg).toContain('email@example.com');
    expect(svg).toContain('Remember me');
    expect(svg).toContain('Second line');
    expect(svg).toContain('Choose one');
    expect(svg).toContain('Panel');
  });

  it('sorts controls by zOrder while preserving source order for equal layers', () => {
    const svg = renderBalsamiqSvg(
      parseBalsamiqJson(
        JSON.stringify({
          mockup: {
            mockupW: '200',
            mockupH: '100',
            controls: {
              control: [
                control('second', 'Label', { text: 'Second' }, { zOrder: '2' }),
                control('first', 'Label', { text: 'First' }, { zOrder: '1' }),
                control('same-layer', 'Label', { text: 'Same' }, { zOrder: '1' }),
              ],
            },
          },
        }),
      ),
    );

    const first = svg.indexOf('data-control-id="first"');
    const sameLayer = svg.indexOf('data-control-id="same-layer"');
    const second = svg.indexOf('data-control-id="second"');
    expect(first).toBeLessThan(sameLayer);
    expect(sameLayer).toBeLessThan(second);
  });

  it('escapes text and control IDs and ignores unknown input fields', () => {
    const svg = renderBalsamiqSvg(
      parseBalsamiqJson(
        JSON.stringify({
          mockup: {
            mockupW: '200',
            mockupH: '100',
            controls: {
              control: [
                {
                  ...control(
                    'name" onload="alert(1)',
                    'Label',
                    { text: 'A & <B>\nNext' },
                    { h: '48' },
                  ),
                  onclick: 'alert(1)',
                  properties: { text: 'A & <B>\nNext', link: 'https://example.com' },
                },
              ],
            },
          },
        }),
      ),
    );

    expect(svg).toContain('A &amp; &lt;B&gt;');
    expect(svg).toContain('Next</tspan>');
    expect(svg).toContain('data-control-id="name&quot; onload=&quot;alert(1)"');
    expect(svg).not.toContain('onclick');
    expect(svg).not.toContain('https://example.com');
    expect(svg).not.toContain('<script');
  });

  it('converts the Canvas color to a safe background and bounds the SVG dimensions', () => {
    const model = parseBalsamiqJson(
      JSON.stringify({
        mockup: {
          controls: {
            control: [
              {
                ID: 'canvas',
                typeID: 'Canvas',
                x: '0',
                y: '0',
                w: '320',
                h: '480',
                zOrder: '0',
                properties: { color: '255' },
              },
            ],
          },
        },
      }),
    );
    expect(renderBalsamiqSvg(model)).toContain('fill="#0000ff"');
    expect(() => renderBalsamiqSvg({ ...model, width: MAX_BALSAMIQ_CANVAS_SIDE + 1 })).toThrow(
      'Balsamiq SVG is too large',
    );
  });
});

function control(
  id: string,
  typeID: string,
  properties: Record<string, unknown>,
  overrides: { zOrder?: string; w?: string; h?: string } = {},
) {
  return {
    ID: id,
    typeID,
    x: '12',
    y: '12',
    w: overrides.w ?? '120',
    h: overrides.h ?? '32',
    zOrder: overrides.zOrder ?? '1',
    properties,
  };
}
