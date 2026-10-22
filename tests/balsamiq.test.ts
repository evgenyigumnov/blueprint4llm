import { describe, expect, it } from 'vitest';

import { checkMarkdown, compileMarkdown } from '../src/compiler.js';
import { DiagramRenderCache } from '../src/renderers/cache.js';
import { balsamiqRenderer } from '../src/renderers/balsamiq.js';
import type { DiagramRenderContext } from '../src/renderers/types.js';

const mockupJson = JSON.stringify({
  mockup: {
    version: '1.0',
    measuredW: '360',
    measuredH: '640',
    controls: {
      control: [
        {
          ID: 'heading',
          typeID: 'Title',
          x: '24',
          y: '24',
          measuredW: '312',
          measuredH: '36',
          zOrder: '1',
          properties: { text: 'Профиль & настройки' },
        },
        {
          ID: 'save',
          typeID: 'Button',
          x: '24',
          y: '80',
          w: '312',
          h: '48',
          zOrder: '2',
          properties: { text: 'Сохранить' },
        },
      ],
    },
  },
});

describe('Balsamiq renderer integration', () => {
  it('compiles the balsamiq fence to inline SVG in the shared Markdown pipeline', async () => {
    const compiled = await compileMarkdown(
      `# Макет профиля\n\n\`\`\`balsamiq\n${mockupJson}\n\`\`\``,
      { sourceFile: 'balsamiq.md' },
    );

    expect(compiled.html).toContain('class="bp-diagram bp-diagram--balsamiq"');
    expect(compiled.html).toContain('data-diagram-id="bp-diagram-001"');
    expect(compiled.html).toContain('Профиль');
    expect(compiled.html).toContain('&#x26;');
    expect(compiled.html).toContain('Сохранить');
    expect(compiled.html).toContain('class="balsamiq-canvas"');
    expect(compiled.html).not.toContain('language-balsamiq');
    expect(compiled.errors).toEqual([]);
  });

  it('returns check-mode diagnostics at the block for an unknown typeID', async () => {
    const invalid = mockupJson.replace('"typeID":"Title"', '"typeID":"WebView"');
    await expect(
      checkMarkdown(`# Broken\n\n\`\`\`balsamiq\n${invalid}\n\`\`\``, {
        sourceFile: 'invalid-balsamiq.md',
      }),
    ).rejects.toMatchObject({
      name: 'DiagnosticError',
      sourceFile: 'invalid-balsamiq.md',
      line: 4,
      message: expect.stringContaining(
        'balsamiq render failed: Balsamiq control "heading" has an unsupported typeID "WebView"',
      ),
    });
  });

  it('maps JSON parser line and column to the Markdown source', async () => {
    const markdown = '# Broken\n\n```balsamiq\n{\n  "mockup": }\n```';

    await expect(
      checkMarkdown(markdown, { sourceFile: 'syntax-error-balsamiq.md' }),
    ).rejects.toMatchObject({
      name: 'DiagnosticError',
      sourceFile: 'syntax-error-balsamiq.md',
      line: 5,
      column: 13,
      message: expect.stringContaining('invalid Balsamiq JSON'),
    });
  });

  it('does not use the network and reuses the normal diagram cache', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error('Balsamiq rendering must stay offline');
    };
    const cache = new DiagramRenderCache();
    const context: DiagramRenderContext = {
      diagramId: 'bp-diagram-test',
      sourceFile: 'cache.md',
      line: 1,
    };

    try {
      const first = await cache.render(balsamiqRenderer, mockupJson, context);
      const reused = await cache.render(balsamiqRenderer, mockupJson, context);
      expect(reused.svg).toBe(first.svg);
      expect(cache.size).toBe(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
