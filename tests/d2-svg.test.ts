import { describe, expect, it } from 'vitest';

import { parseAndValidateSvg } from '../src/svg/parse-and-validate.js';
import { D2Error } from '../src/renderers/d2-error.js';
import { adaptD2Svg, D2_MAX_SVG_BYTES, scopeD2SvgStyles } from '../src/renderers/d2-svg.js';

function svgFixture(
  css = '.d2-123 .text { font-family: "d2-123-font-regular"; }',
  body = '<text>bp-d2-scope</text>',
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480"><svg class="d2-123 d2-svg"><style type="text/css"><![CDATA[${css}]]></style>${body}</svg></svg>`;
}

describe('D2 SVG adapter', () => {
  it('removes only embedded D2 fonts, fixes dimensions, and scopes CSS after caching', () => {
    const source = svgFixture(
      '.d2-123 .text { font-family: "d2-123-font-regular"; }\n' +
        '.d2-123 .text-bold { font-family: "d2-123-font-bold"; }\n' +
        '.d2-123 .text-code { font-family: "d2-123-font-mono"; }\n' +
        '@font-face { font-family: d2-123-font-regular; src: url("data:application/font-woff;base64,Zm9v"); }',
    );
    const adapted = adaptD2Svg(source);

    expect(adapted).toContain('width="640" height="480"');
    expect(adapted).toContain('.bp-d2-scope .text');
    expect(adapted).toContain('font-family: "Noto Sans", Arial, sans-serif');
    expect(adapted).toContain('font-weight: 700');
    expect(adapted).toContain('ui-monospace');
    expect(adapted).not.toContain('@font-face');
    expect(adapted).not.toContain('data:application/font-woff');

    const parsed = parseAndValidateSvg(adapted);
    scopeD2SvgStyles(parsed, 'bp-diagram-002');
    expect(JSON.stringify(parsed)).toContain('"value":"bp-d2-scope"');
    expect(JSON.stringify(parsed)).toContain('.bp-d2-bp-diagram-002 .text');
    expect(JSON.stringify(parsed)).toContain('"bp-d2-bp-diagram-002","d2-svg"');
  });

  it('scopes global CSS and rejects external resources and malformed dimensions', () => {
    expect(adaptD2Svg(svgFixture('.unscoped { fill: red; }'))).toContain('.bp-d2-scope .unscoped');
    expect(() => adaptD2Svg(svgFixture('@keyframes d2 { to { opacity: 1; } }'))).toThrow(
      /unsupported CSS at-rule/,
    );
    expect(() =>
      adaptD2Svg(svgFixture('.d2-123 { background: url(https://example.com/a); }')),
    ).not.toThrow();

    const external = adaptD2Svg(svgFixture('.d2-123 { background: url(https://example.com/a); }'));
    expect(() => parseAndValidateSvg(external)).toThrow(/non-fragment CSS url/);
    expect(() =>
      adaptD2Svg(svgFixture().replace('viewBox="0 0 640 480"', 'viewBox="0 0 9000 480"')),
    ).toThrow(/dimensions exceed/);
    expect(() =>
      adaptD2Svg(svgFixture().replace('viewBox="0 0 640 480"', 'viewBox="0 0 -1 480"')),
    ).toThrow(/invalid viewBox/);
  });

  it('enforces the output byte limit and expected D2 wrapper', () => {
    expect(() => adaptD2Svg(`${svgFixture()}${' '.repeat(D2_MAX_SVG_BYTES)}`)).toThrow(
      /D2 SVG is too large/,
    );
    expect(() =>
      adaptD2Svg('<svg viewBox="0 0 10 10"><text>missing engine wrapper</text></svg>'),
    ).toThrow(D2Error);
  });
});
