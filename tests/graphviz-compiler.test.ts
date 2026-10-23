import { describe, expect, it } from 'vitest';

import { checkMarkdown, compileMarkdown } from '../src/compiler.js';
import { DiagramRenderCache } from '../src/renderers/cache.js';

describe('Graphviz compiler integration', () => {
  it('compiles both fence languages through the shared SVG container and check paths', async () => {
    const markdown = [
      '# Graphviz',
      '',
      '```graphviz',
      'digraph Order { client -> api }',
      '```',
      '',
      '```dot engine=neato',
      'graph Services { gateway -- orders }',
      '```',
    ].join('\n');
    const compiled = await compileMarkdown(markdown, { sourceFile: 'graphviz.md' });
    const checked = await checkMarkdown(markdown, { sourceFile: 'graphviz.md' });

    expect(compiled.html.match(/class="bp-diagram bp-diagram--graphviz"/g)).toHaveLength(2);
    expect(compiled.html).toContain('data-diagram-id="bp-diagram-001"');
    expect(compiled.html).toContain('data-diagram-id="bp-diagram-002"');
    expect(compiled.html.match(/<svg\b/g)).toHaveLength(2);
    expect(compiled.errors).toEqual([]);
    expect(checked.errors).toEqual([]);
    expect(checked.diagnostics).toEqual([]);
    await expect(
      compileMarkdown(markdown, { sourceFile: 'graphviz.md', requireSingleDiagram: true }),
    ).rejects.toThrow(
      'single-diagram export requires exactly one supported diagram block; found 2',
    );
  });

  it('maps Graphviz syntax errors to the Markdown line in both check and compile results', async () => {
    const markdown = [
      '# Broken graph',
      '',
      'Text before the graph.',
      '',
      '```graphviz',
      'digraph {',
      '  client ->',
      '}',
      '```',
    ].join('\n');
    const checked = await checkMarkdown(markdown, { sourceFile: 'broken-graph.md' });
    const compiled = await compileMarkdown(markdown, { sourceFile: 'broken-graph.md' });

    expect(checked.diagnostics).toEqual([
      expect.objectContaining({
        severity: 'error',
        code: 'diagram.render',
        sourceFile: 'broken-graph.md',
        line: 8,
        column: 1,
        renderer: 'graphviz',
      }),
    ]);
    expect(compiled.errors).toEqual([
      expect.stringMatching(/^broken-graph\.md:8:1: graphviz error: Graphviz render failed:/),
    ]);
    expect(compiled.html).toContain('class="bp-diagnostic bp-diagnostic--error"');
  });

  it('uses the shared cache for both metadata and source identity', async () => {
    const cache = new DiagramRenderCache();
    const dotSource = '# Cached graph\n\n```graphviz\ngraph { a -- b }\n```';
    const neatoSource = '# Cached graph\n\n```graphviz engine=neato\ngraph { a -- b }\n```';
    await compileMarkdown(dotSource, { sourceFile: 'cache.md', diagramCache: cache });
    expect(cache.size).toBe(1);
    await compileMarkdown(dotSource, { sourceFile: 'cache.md', diagramCache: cache });
    expect(cache.size).toBe(1);
    await compileMarkdown(neatoSource, { sourceFile: 'cache.md', diagramCache: cache });
    expect(cache.size).toBe(2);
  });

  it('keeps Graphviz IDs unique next to Mermaid and PlantUML diagrams', async () => {
    const compiled = await compileMarkdown(
      [
        '# Mixed diagram formats',
        '',
        '```graphviz',
        'digraph First { graph [id="shared-graph"]; a [id="shared-node"]; a -> b }',
        '```',
        '',
        '```mermaid',
        'flowchart LR',
        '  A --> B',
        '```',
        '',
        '```plantuml',
        '@startuml',
        'Alice -> Bob',
        '@enduml',
        '```',
        '',
        '```dot',
        'digraph Second { graph [id="shared-graph"]; a [id="shared-node"]; a -> b }',
        '```',
      ].join('\n'),
      { sourceFile: 'mixed-graphviz.md' },
    );
    const ids = [...compiled.html.matchAll(/(?:^|\s)id="([^"]+)"/g)].map((match) => match[1]);

    expect(compiled.html).toContain('bp-diagram--graphviz');
    expect(compiled.html).toContain('bp-diagram--mermaid');
    expect(compiled.html).toContain('bp-diagram--plantuml');
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('bp-diagram-001-shared-graph');
    expect(ids).toContain('bp-diagram-004-shared-graph');
    expect(ids).toContain('bp-diagram-001-shared-node');
    expect(ids).toContain('bp-diagram-004-shared-node');
    expect(compiled.errors).toEqual([]);
  }, 60_000);
});
