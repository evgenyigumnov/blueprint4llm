import { describe, expect, it } from 'vitest';

import { checkMarkdown, compileMarkdown } from '../src/compiler.js';
import { DiagramRenderCache } from '../src/renderers/cache.js';
import { openapiRenderer } from '../src/renderers/openapi.js';

const OPENAPI = `openapi: 3.1.1
info: { title: Orders, version: '1' }
paths:
  /orders/{id}:
    get:
      parameters: [{ name: id, in: path, required: true, schema: { type: string } }]
      responses: { '200': { description: found } }
`;

function fence(source: string): string {
  return ['```openapi', source, '```'].join('\n');
}

describe('OpenAPI renderer integration', () => {
  it('versions the cache key with the parser and layout rules', () => {
    expect(openapiRenderer.cacheKey).toContain('yaml@2.9.1');
    expect(openapiRenderer.cacheKey).toContain('layout=vertical-v1');
  });

  it('renders OpenAPI fences through compileMarkdown and checkMarkdown', async () => {
    const markdown = `# API\n\n${fence(OPENAPI)}\n`;
    const compiled = await compileMarkdown(markdown, { sourceFile: 'orders.md' });
    expect(compiled.html).toContain('class="bp-diagram bp-diagram--openapi"');
    expect(compiled.html).toContain('Orders');
    expect(compiled.html).toContain('GET /orders/{id}');
    expect(compiled.errors).toEqual([]);
    expect(await checkMarkdown(markdown, { sourceFile: 'orders.md' })).toEqual({
      warnings: [],
      errors: [],
    });
  });

  it('keeps ordinary YAML and JSON fences as code in mixed documents', async () => {
    const markdown = [
      '```yaml',
      'openapi: 3.1.1',
      '```',
      '',
      '```json',
      '{"openapi":"3.1.1"}',
      '```',
      '',
      '```openapi',
      OPENAPI,
      '```',
    ].join('\n');
    const compiled = await compileMarkdown(markdown, { sourceFile: 'mixed.md' });
    expect(compiled.html).toContain('class="language-yaml"');
    expect(compiled.html).toContain('class="language-json"');
    expect(compiled.html).toContain('bp-diagram--openapi');
    expect(compiled.html.match(/bp-diagram--openapi/g)).toHaveLength(1);
  });

  it('gives separate OpenAPI blocks unique IDs and maps cached warnings to current lines', async () => {
    const cache = new DiagramRenderCache();
    const warnedSource = OPENAPI.replace(
      'paths:',
      'servers: [{ url: https://example.test }]\npaths:',
    );
    const first = await compileMarkdown(`${fence(warnedSource)}\n\n${fence(warnedSource)}`, {
      sourceFile: 'first.md',
      diagramCache: cache,
    });
    const second = await compileMarkdown(`# Moved\n\n\n${fence(warnedSource)}`, {
      sourceFile: 'second.md',
      diagramCache: cache,
    });
    expect(first.html).toContain('data-diagram-id="bp-diagram-001"');
    expect(first.html).toContain('data-diagram-id="bp-diagram-002"');
    expect(second.html).toContain('data-diagram-id="bp-diagram-001"');
    expect(first.warnings[0]).toMatch(/first\.md:\d+:\d+: openapi warning: field "servers"/);
    expect(second.warnings[0]).toMatch(/second\.md:\d+:\d+: openapi warning: field "servers"/);
  });

  it('reports source-local OpenAPI errors with Markdown file, line, column, and pointer', async () => {
    const markdown = [
      '# Broken',
      '',
      '```openapi',
      'openapi: 3.1.1',
      'info: { title: Broken, version: "1" }',
      'paths:',
      '  /x:',
      '    get:',
      '      responses: { default: { description: ok, content: { application/json: { schema: { $ref: "#/missing" } } } } }',
      '```',
    ].join('\n');
    await expect(compileMarkdown(markdown, { sourceFile: 'broken.md' })).rejects.toMatchObject({
      name: 'DiagnosticError',
      sourceFile: 'broken.md',
      line: 9,
      column: expect.any(Number),
    });
    await expect(compileMarkdown(markdown, { sourceFile: 'broken.md' })).rejects.toThrow(
      'unresolved $ref: #/missing (#/paths/~1x/get/responses/default/content/application~1json/schema/$ref)',
    );
  });

  it('checks AbortSignal before parsing source', async () => {
    const controller = new AbortController();
    controller.abort(new Error('preview cancelled'));
    await expect(
      openapiRenderer.render(OPENAPI, {
        diagramId: 'test',
        sourceFile: 'orders.md',
        line: 1,
        signal: controller.signal,
      }),
    ).rejects.toThrow('preview cancelled');
  });
});
