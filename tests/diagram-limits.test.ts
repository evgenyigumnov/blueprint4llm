import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { compileMarkdown } from '../src/compiler.js';
import { MAX_DIAGRAM_BLOCKS, MAX_DIAGRAM_SOURCE_BYTES } from '../src/plugins/remark-diagrams.js';

describe('diagram input limits', () => {
  it('reports the first diagram beyond the document limit with its source line', async () => {
    const markdown = Array.from(
      { length: MAX_DIAGRAM_BLOCKS + 1 },
      (_, index) => '```dot\ndigraph { diagram' + index + ' }\n```',
    ).join('\n\n');

    await expect(
      compileMarkdown(markdown, { sourceFile: path.join('/tmp', 'many-diagrams.md') }),
    ).rejects.toMatchObject({
      name: 'DiagnosticError',
      sourceFile: path.join('/tmp', 'many-diagrams.md'),
      line: expect.any(Number),
      message: `too many diagram blocks: ${MAX_DIAGRAM_BLOCKS + 1} (limit ${MAX_DIAGRAM_BLOCKS})`,
    });
  });

  it('reports an oversized Balsamiq block and keeps the rest of the document', async () => {
    const source = 'x'.repeat(MAX_DIAGRAM_SOURCE_BYTES + 1);
    const compiled = await compileMarkdown(
      'Before.\n\n```balsamiq\n' + source + '\n```\n\nAfter.',
      { sourceFile: 'large-diagram.md' },
    );

    expect(compiled.diagnostics).toEqual([
      expect.objectContaining({
        severity: 'error',
        code: 'diagram.limit',
        sourceFile: 'large-diagram.md',
        line: 3,
        message: expect.stringContaining(
          `diagram block is too large: ${MAX_DIAGRAM_SOURCE_BYTES + 1} bytes`,
        ),
      }),
    ]);
    expect(compiled.html).toContain('Before.');
    expect(compiled.html).toContain('After.');
    expect(compiled.html).toContain('diagram block is too large');
  });
});
