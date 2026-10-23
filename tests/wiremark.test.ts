import { describe, expect, it } from 'vitest';

import { compileMarkdown } from '../src/compiler.js';
import { wiremarkRenderer } from '../src/renderers/wiremark.js';

const wireframe = `Wireframe #login mobile
  Stack column gap=2 padding=2
    Typography h4 "Sign in"
    TextField "Email"
    TextField "Password"
    Button "Sign in" contained to=#dashboard`;

describe('Wiremark renderer', () => {
  it('adapts the official core renderer and returns inline SVG', async () => {
    const result = await wiremarkRenderer.render(wireframe, {
      diagramId: 'bp-diagram-001',
      sourceFile: 'blueprint.md',
      line: 1,
    });

    expect(result.svg).toMatch(/^<svg\b/);
    expect(result.svg).toContain('<text');
    expect(result.warnings).toEqual([]);
  });

  it('compiles both supported language aliases as inline SVG in document order', async () => {
    const markdown = `# Blueprint

\`\`\`wireframe
${wireframe}
\`\`\`

\`\`\`wiremark
${wireframe}
\`\`\`

\`\`\`wireframes
${wireframe}
\`\`\``;
    const compiled = await compileMarkdown(markdown, { sourceFile: 'blueprint.md' });

    expect(compiled.html.match(/<svg\b/g)).toHaveLength(2);
    expect(compiled.html.match(/class="bp-diagram bp-diagram--wiremark"/g)).toHaveLength(2);
    expect(
      compiled.html.match(
        /<pre class="bp-diagram-container"><figure class="bp-diagram bp-diagram--wiremark"/g,
      ),
    ).toHaveLength(2);
    expect(compiled.html).toContain('class="language-wireframes"');
    expect(compiled.html.indexOf('data-diagram-id="bp-diagram-001"')).toBeLessThan(
      compiled.html.indexOf('data-diagram-id="bp-diagram-002"'),
    );

    const ids = [...compiled.html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(compiled.html).toContain('clip-path="url(#bp-diagram-001-wm-clip-0)"');
    expect(compiled.html).toContain('clip-path="url(#bp-diagram-002-wm-clip-0)"');
  });

  it('returns Wiremark warnings with the corresponding Markdown line', async () => {
    const compiled = await compileMarkdown(
      '# Heading\n\n```wireframe\nWireframe mobile\n  Anchor\n```',
      { sourceFile: 'warning.md' },
    );

    expect(compiled.warnings).toEqual([
      'warning.md:5:1: wiremark warning: Anchor without #id can never be targeted',
    ]);
  });

  it('reports renderer errors at the failing line inside the Markdown fence', async () => {
    const markdown =
      '# Heading\n\n```wiremark\nWireframe mobile\n  UnknownComponent\n```\n\nText after the error.';
    const compiled = await compileMarkdown(markdown, {
      sourceFile: 'broken.md',
      includeDiagnosticsSummary: true,
    });

    expect(compiled.diagnostics).toMatchObject([
      {
        sourceFile: 'broken.md',
        line: 5,
        column: 1,
        message: 'wiremark render failed: unknown component "UnknownComponent"',
      },
    ]);
    expect(compiled.html).toContain('Text after the error.');
    expect(compiled.html).toContain('Document check: 1 errors · 0 warnings');
  });
});
