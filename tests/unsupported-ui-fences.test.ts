import { describe, expect, it } from 'vitest';

import { checkMarkdown, compileMarkdown } from '../src/compiler.js';

describe('removed UI fence languages', () => {
  it.each(['wireframe', 'wiremark'])('keeps %s as ordinary escaped code', async (language) => {
    const markdown = `# Source\n\n\`\`\`${language}\n<screen>\n\`\`\``;
    const options = { sourceFile: 'unsupported-ui.md' };
    const compiled = await compileMarkdown(markdown, options);
    const checked = await checkMarkdown(markdown, options);

    expect(compiled.html).toContain(`class="language-${language}"`);
    expect(compiled.html).toContain('&#x3C;screen>');
    expect(compiled.html).not.toContain('<svg');
    expect(compiled.html).not.toContain('data-diagram-id=');
    expect(compiled.diagnostics).toEqual([]);
    expect(checked).toMatchObject({ errors: [], warnings: [], diagnostics: [] });

    for (const compile of [compileMarkdown, checkMarkdown]) {
      await expect(compile(markdown, { ...options, requireSingleDiagram: true })).rejects.toThrow(
        'exactly one supported diagram block; found 0',
      );
    }
  });
});
