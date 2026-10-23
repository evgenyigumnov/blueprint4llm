import { describe, expect, it } from 'vitest';

import { getNotoSansFontCss } from '../src/noto-fonts.js';

describe('bundled Noto Sans CSS', () => {
  it('embeds the regular and bold local fonts without an external request', async () => {
    const css = await getNotoSansFontCss();

    expect(css.match(/@font-face/g)).toHaveLength(2);
    expect(css).toContain("font-family: 'Noto Sans'");
    expect(css).toContain('font-weight: 400');
    expect(css).toContain('font-weight: 700');
    expect(css).toMatch(/url\(data:font\/ttf;base64,[A-Za-z0-9+/=]+\)/);
    expect(css).not.toContain('https://');
  });
});
