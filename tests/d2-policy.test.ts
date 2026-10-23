import { D2 } from '@d2lang/d2';
import type { CompileResponse } from '@d2lang/d2';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { D2Error } from '../src/renderers/d2-error.js';
import { validateD2Profile } from '../src/renderers/d2-policy.js';

let engine: D2;

async function compile(source: string): Promise<CompileResponse> {
  return engine.compile(
    { fs: { 'index.d2': source }, inputPath: 'index.d2' },
    { layout: 'dagre', themeID: 0 },
  );
}

beforeAll(() => {
  engine = new D2();
});

afterAll(async () => {
  await engine.dispose();
});

describe('D2 language profile', () => {
  it('accepts the supported layout and static theme settings', async () => {
    const source = [
      'vars: { d2-config: { layout-engine: elk; theme-id: 0 } }',
      'classes: { primary: { style.fill: "#dbeafe" } }',
      'orders: { shape: sql_table; id: int { constraint: primary_key } }',
      'Order: { shape: class; +id: string; load(): Order }',
      'flow: { shape: sequence_diagram; client -> server: запрос }',
      'orders.id -> Order.id',
    ].join('\n');

    const result = await compile(source);
    expect(validateD2Profile(result)).toBe('elk');
  });

  it.each([
    ['TALA layout', 'vars: { d2-config: { layout-engine: tala } }\na -> b'],
    ['unknown layout', 'vars: { d2-config: { layout-engine: unknown } }\na -> b'],
    ['nondefault theme', 'vars: { d2-config: { theme-id: 1 } }\na -> b'],
    ['other variable', 'vars: { custom: value }\na -> b'],
    ['unknown D2 setting', 'vars: { d2-config: { dark-theme-id: 200 } }\na -> b'],
  ])('rejects %s', async (_name, source) => {
    const result = await compile(source);
    expect(() => validateD2Profile(result)).toThrow(D2Error);
  });

  it.each([
    ['icons', 'a: { icon: "https://example.com/icon.svg" }'],
    ['links', 'a.link: "https://example.com"\na'],
    ['tooltips', 'a.tooltip: details\na'],
    ['animation', 'a: { style.animated: true }'],
    ['Markdown', 'a: |md **rich text**|'],
    ['LaTeX', 'a: |tex \\frac{a}{b}|'],
  ])('rejects %s before SVG rendering', async (_name, source) => {
    const result = await compile(source);
    expect(() => validateD2Profile(result)).toThrow(D2Error);
  });

  it.each([
    ['layers', 'a -> b\nlayers: { first: { a -> b } }'],
    ['scenarios', 'a -> b\nscenarios: { first: { a -> b } }'],
    ['steps', 'a -> b\nsteps: { first: { a -> b } }'],
  ])('rejects %s instead of silently rendering a root board', async (boardName, source) => {
    const result = await compile(source);
    expect(() => validateD2Profile(result)).toThrow(`${boardName} are not supported`);
  });

  it('rejects unsafe final render options even when the AST omits their configuration', async () => {
    const result = await compile('a -> b');
    const unsafe = {
      ...result,
      renderOptions: { ...result.renderOptions, darkThemeID: 200 },
    } as CompileResponse;
    expect(() => validateD2Profile(unsafe)).toThrow(/darkThemeID/);
  });

  it('fails closed when the engine does not return its AST', async () => {
    const result = await compile('a -> b');
    const withoutAst = {
      ...result,
      graph: { ...result.graph, ast: undefined },
    } as CompileResponse;
    expect(() => validateD2Profile(withoutAst)).toThrow(/syntax tree/);
  });
});
