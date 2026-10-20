import path from 'node:path';

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { describe, expect, it } from 'vitest';

import {
  compileMarkdown,
  detectLanguage,
  findFirstH1Text,
  MAX_MARKDOWN_BYTES,
} from '../src/compiler.js';
import { DiagnosticError } from '../src/errors.js';

describe('compileMarkdown', () => {
  it('renders GFM Markdown into a complete standalone HTML page', async () => {
    const markdown = `# Blueprint

Текст с **выделением**, [ссылкой](https://example.com) и \`inline code\`.

| Имя | Значение |
| --- | --- |
| A | B |

- [x] Готово
- [ ] В работе

> Цитата

\`\`\`rust
fn main() { println!("<ok>"); }
\`\`\`
`;
    const compiled = await compileMarkdown(markdown, { sourceFile: 'blueprint.md' });

    expect(compiled.title).toBe('Blueprint');
    expect(compiled.html).toContain('<!doctype html>');
    expect(compiled.html).toContain('<html lang="ru">');
    expect(compiled.html).toContain('<meta charset="utf-8">');
    expect(compiled.html).toContain('<title>Blueprint</title>');
    expect(compiled.html).toContain('<strong>выделением</strong>');
    expect(compiled.html).toContain('<div class="bp-table"><table>');
    expect(compiled.html).toContain('type="checkbox"');
    expect(compiled.html).toContain('<blockquote>');
    expect(compiled.html).toContain('class="language-rust"');
    expect(compiled.html).toContain('&#x3C;ok>');
    expect(compiled.html).not.toContain('<script');
    expect(compiled.assets).toEqual([]);
    expect(compiled.warnings).toEqual([]);
  });

  it('escapes raw HTML and keeps source code as escaped code', async () => {
    const compiled = await compileMarkdown(
      '<img src=x onerror="alert(1)">\n\n```html\n<script>alert(1)</script>\n```',
      { sourceFile: 'unsafe.md' },
    );

    expect(compiled.html).toContain('&#x3C;img src=x onerror="alert(1)">');
    expect(compiled.html).toContain('&#x3C;script>alert(1)&#x3C;/script>');
    expect(compiled.html).not.toContain('<img src=x');
    expect(compiled.html).not.toContain('<script>');
  });

  it('removes unsafe URL schemes from Markdown links', async () => {
    const compiled = await compileMarkdown(
      '[safe](https://example.com) [email](mailto:team@example.com) ' +
        '[script](javascript:alert%281%29) [encoded](java%73cript:alert%281%29) ' +
        '[data](data:text/html,hello)',
      { sourceFile: 'unsafe-links.md' },
    );

    expect(compiled.html).toContain('<a href="https://example.com">safe</a>');
    expect(compiled.html).toContain('<a href="mailto:team@example.com">email</a>');
    expect(compiled.html).toContain('>script</a>');
    expect(compiled.html).toContain('>encoded</a>');
    expect(compiled.html).toContain('>data</a>');
    expect(compiled.html).not.toMatch(/href="(?:javascript|data):/i);
  });

  it('uses the first H1 as title and escapes it in the page template', async () => {
    const compiled = await compileMarkdown('# A & " title\n\n# A later title', {
      sourceFile: 'fallback.md',
    });

    expect(compiled.title).toBe('A & " title');
    expect(compiled.html).toContain('<title>A &amp; &quot; title</title>');
  });

  it('falls back to the input basename when the document has no H1', async () => {
    const compiled = await compileMarkdown('## Section\n\nText.', {
      sourceFile: path.join('/tmp', 'blue print.md'),
    });
    expect(compiled.title).toBe('blue print');
    expect(compiled.html).toContain('<title>blue print</title>');
  });

  it('rejects source Markdown over the configured size limit with a diagnostic', async () => {
    await expect(
      compileMarkdown('x'.repeat(MAX_MARKDOWN_BYTES + 1), { sourceFile: 'large.md' }),
    ).rejects.toMatchObject({
      name: 'DiagnosticError',
      sourceFile: 'large.md',
      message: expect.stringContaining('too large'),
    });
  });
});

describe('Markdown helpers', () => {
  it('detects Russian and English text', () => {
    expect(detectLanguage('Hello, world')).toBe('en');
    expect(detectLanguage('Привет, мир')).toBe('ru');
  });

  it('finds only the first top-level H1 and extracts its visible text', () => {
    const tree = unified()
      .use(remarkParse)
      .parse('## ignored\n\n# **Hello** `world` [link](#x)\n\n# later');
    expect(findFirstH1Text(tree)).toBe('Hello world link');

    const noHeading = unified().use(remarkParse).parse('## only an H2');
    expect(findFirstH1Text(noHeading)).toBeUndefined();
  });

  it('wraps parser failures in a source-aware diagnostic', async () => {
    const markdown = '\u0000'.repeat(MAX_MARKDOWN_BYTES + 1);
    await expect(compileMarkdown(markdown, { sourceFile: 'bad.md' })).rejects.toBeInstanceOf(
      DiagnosticError,
    );
  });
});
