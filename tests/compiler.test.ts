import path from 'node:path';

import { fromHtml } from 'hast-util-from-html';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { describe, expect, it } from 'vitest';
import type { Element, Root } from 'hast';

import {
  checkMarkdown,
  compileMarkdown,
  detectLanguage,
  findFirstH1Text,
  MAX_HIGHLIGHTED_CODE_BYTES,
  MAX_MARKDOWN_BYTES,
} from '../src/compiler.js';
import { DiagnosticError } from '../src/errors.js';

describe('compileMarkdown', () => {
  it('keeps the document order and reports every independent diagram failure', async () => {
    const drawio = JSON.stringify({
      version: '26.0',
      pages: [
        {
          id: 'page-1',
          name: 'Orders',
          cells: [
            { id: 'layer', type: 'layer' },
            { id: 'api', type: 'node', parent: 'layer', label: 'API' },
            { id: 'queue', type: 'node', parent: 'layer', label: 'Queue' },
            { id: 'send', type: 'edge', parent: 'layer', source: 'api', target: 'queue' },
          ],
        },
      ],
    });
    const markdown = [
      '# Orders',
      '',
      'Text before the first failure.',
      '',
      '```wiremark',
      'Wireframe mobile',
      '  UnknownFirst',
      '```',
      '',
      'Text between failures.',
      '',
      '```drawio',
      drawio,
      '```',
      '',
      'Text before the second failure.',
      '',
      '```wireframe',
      'Wireframe mobile',
      '  UnknownSecond',
      '```',
      '',
      'Text after the last failure.',
    ].join('\n');

    const compiled = await compileMarkdown(markdown, {
      sourceFile: 'orders.md',
      includeDiagnosticsSummary: true,
    });
    const checked = await checkMarkdown(markdown, { sourceFile: 'orders.md' });

    expect(compiled.diagnostics).toMatchObject([
      {
        severity: 'error',
        code: 'diagram.render',
        sourceFile: 'orders.md',
        line: 7,
        diagramId: 'bp-diagram-001',
        renderer: 'wiremark',
      },
      {
        severity: 'error',
        code: 'diagram.render',
        sourceFile: 'orders.md',
        line: 20,
        diagramId: 'bp-diagram-003',
        renderer: 'wiremark',
      },
    ]);
    expect(checked.diagnostics).toEqual(compiled.diagnostics);
    expect(checked).not.toHaveProperty('html');
    expect(compiled.html).toContain('Document check: 2 errors · 0 warnings');
    expect(compiled.html).toContain('Text before the first failure.');
    expect(compiled.html).toContain('Text between failures.');
    expect(compiled.html).toContain('Text before the second failure.');
    expect(compiled.html).toContain('Text after the last failure.');
    expect(compiled.html).toContain('UnknownFirst');
    expect(compiled.html).toContain('UnknownSecond');
    expect(compiled.html).toContain('bp-diagram--drawio');
    expect(compiled.html.match(/<svg\b/g)).toHaveLength(1);
    expect(compiled.html.match(/class="bp-diagnostic bp-diagnostic--error"/g)).toHaveLength(2);
  });

  it('compiles PlantUML through the shared validated SVG diagram pipeline', async () => {
    const compiled = await compileMarkdown(
      '# PlantUML\n\n```plantuml\n@startuml\nAlice -> Bob: Привет\n@enduml\n```',
      { sourceFile: 'plantuml.md' },
    );

    expect(compiled.html).toContain(
      '<pre class="bp-diagram-container"><figure class="bp-diagram bp-diagram--plantuml" data-diagram-id="bp-diagram-001">',
    );
    expect(compiled.html).toContain('<svg');
    expect(compiled.html).toContain('Привет');
    expect(compiled.html).not.toContain('<script');
    expect(compiled.errors).toEqual([]);
  }, 60_000);

  it('keeps PlantUML syntax errors visible and reports their Markdown source location', async () => {
    const compiled = await compileMarkdown(
      '# PlantUML\n\n```plantuml\n@startuml\nclass User {\n@enduml\n```',
      { sourceFile: 'invalid-plantuml.md' },
    );

    expect(compiled.html).toContain('class="bp-diagram bp-diagram--plantuml"');
    expect(compiled.html).toContain('Syntax Error?');
    expect(compiled.errors).toEqual([
      expect.stringMatching(/^invalid-plantuml\.md:5:1: plantuml error: Syntax Error\?/),
    ]);
    expect(compiled.diagnostics).toEqual([
      expect.objectContaining({
        severity: 'error',
        code: 'diagram.render',
        scope: 'diagram',
        sourceFile: 'invalid-plantuml.md',
        line: 5,
        column: 1,
        diagramId: 'bp-diagram-001',
        renderer: 'plantuml',
        message: expect.stringContaining('Syntax Error?'),
      }),
    ]);
  }, 60_000);

  it('renders PlantUML alongside Mermaid and Wiremark with document-unique SVG IDs', async () => {
    const drawioJson = JSON.stringify({
      version: '26.0',
      pages: [
        {
          id: 'page-1',
          name: 'Combined draw.io',
          cells: [
            { id: 'layer', type: 'layer' },
            { id: 'client', type: 'node', parent: 'layer', label: 'Client' },
            { id: 'api', type: 'node', parent: 'layer', label: 'API' },
            {
              id: 'request',
              type: 'edge',
              parent: 'layer',
              source: 'client',
              target: 'api',
              label: 'Submit',
            },
          ],
        },
      ],
    });
    const compiled = await compileMarkdown(
      `# Combined diagrams

\`\`\`typescript
const previewLabel = 'Rendered by Shiki';
\`\`\`

\`\`\`plantuml
@startuml
Client -> API: Submit
@enduml
\`\`\`

\`\`\`mermaid
flowchart TB
  Client --> API
\`\`\`

\`\`\`drawio
${drawioJson}
\`\`\`

\`\`\`wireframe
Wireframe #combined mobile
  Stack column gap=2
    Typography h4 "Combined diagram preview"
\`\`\``,
      { sourceFile: 'combined-diagrams.md' },
    );
    const ids = [...compiled.html.matchAll(/(?:^|\s)id="([^"]+)"/g)].map((match) => match[1]);

    expect(compiled.html).toContain('bp-diagram--plantuml');
    expect(compiled.html).toContain('bp-diagram--mermaid');
    expect(compiled.html).toContain('bp-diagram--drawio');
    expect(compiled.html).toContain('bp-diagram--wiremark');
    expect(compiled.html.match(/class="shiki/g)).toHaveLength(1);
    expect(compiled.html).not.toMatch(
      /class="language-(?:plantuml|mermaid|drawio|wireframe|wiremark)"/,
    );
    expect(compiled.html.match(/<svg\b/g)).toHaveLength(4);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id?.startsWith('bp-diagram-'))).toBe(true);
    expect(compiled.errors).toEqual([]);
  }, 60_000);

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

  it('omits the document summary by default and includes it when requested', async () => {
    const defaultResult = await compileMarkdown('# No summary by default', {
      sourceFile: 'summary.md',
    });
    const optedInResult = await compileMarkdown('# Include the summary', {
      sourceFile: 'summary.md',
      includeDiagnosticsSummary: true,
    });

    expect(defaultResult.html).not.toContain('Document check:');
    expect(optedInResult.html).toContain('Document check: 0 errors · 0 warnings');
  });

  it('highlights JSON and TypeScript fences while preserving their source text', async () => {
    const json = '{\n  "name": "blueprint4llm",\n  "enabled": true\n}';
    const typescript = 'const enabled: boolean = true;';
    const compiled = await compileMarkdown(
      `\`\`\`json\n${json}\n\`\`\`\n\n\`\`\`typescript\n${typescript}\n\`\`\``,
      { sourceFile: 'highlighted.md' },
    );
    const tree = fromHtml(compiled.html);
    const codeText = collectText(tree);

    expect(compiled.html.match(/class="shiki/g)).toHaveLength(2);
    expect(compiled.html).toContain('language-json');
    expect(compiled.html).toContain('language-typescript');
    expect(compiled.html).toContain('--shiki-light');
    expect(compiled.html).toContain('--shiki-dark');
    expect(compiled.html).toContain(":root[data-bp-theme='dark'] pre.shiki");
    expect(codeText).toContain(json);
    expect(codeText).toContain(typescript);
  });

  it('leaves inline and unlabelled code alone and safely falls back for unknown languages', async () => {
    const unknown = `const value = "<img src=x onerror=alert(1)>";`;
    const plain = '<plain & quoted "text">';
    const compiled = await compileMarkdown(
      `Inline \`code\`.\n\n\`\`\`language-that-does-not-exist\n${unknown}\n\`\`\`\n\n\`\`\`\n${plain}\n\`\`\``,
      { sourceFile: 'fallback.md' },
    );
    const tree = fromHtml(compiled.html);
    const codeText = collectText(tree);

    expect(compiled.html).not.toContain('class="shiki');
    expect(compiled.html).toContain('class="language-language-that-does-not-exist"');
    expect(compiled.html).toContain('<code>code</code>');
    expect(compiled.html).toContain('&#x3C;img');
    expect(compiled.html).not.toContain('<img src=x');
    expect(codeText).toContain(unknown);
    expect(codeText).toContain(plain);
  });

  it('keeps fenced code above 64 KiB escaped without syntax highlighting', async () => {
    const code = '<я'.repeat(Math.ceil((MAX_HIGHLIGHTED_CODE_BYTES + 1) / 3));
    expect(code.length).toBeLessThan(MAX_HIGHLIGHTED_CODE_BYTES);
    expect(Buffer.byteLength(code, 'utf8')).toBeGreaterThan(MAX_HIGHLIGHTED_CODE_BYTES);
    const compiled = await compileMarkdown(`\`\`\`typescript\n${code}\n\`\`\``, {
      sourceFile: 'large-code.md',
    });
    const codeText = collectText(fromHtml(compiled.html));

    expect(compiled.html).not.toContain('class="shiki');
    expect(compiled.html).toContain('class="language-typescript"');
    expect(compiled.html).toContain('&#x3C;я');
    expect(compiled.html).not.toContain(code);
    expect(codeText).toContain(code);
  });

  it('escapes raw HTML and keeps source code as escaped code', async () => {
    const compiled = await compileMarkdown(
      '<img src=x onerror="alert(1)">\n\n```html\n<script>alert(1)</script>\n```',
      { sourceFile: 'unsafe.md' },
    );

    expect(compiled.html).toContain('&#x3C;img src=x onerror="alert(1)">');
    expect(collectText(fromHtml(compiled.html))).toContain('<script>alert(1)</script>');
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

function collectText(node: Root | Element): string {
  return node.children
    .map((child) => {
      if (child.type === 'text') {
        return child.value;
      }
      return child.type === 'element' ? collectText(child) : '';
    })
    .join('');
}

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
