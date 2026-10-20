import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { compileMarkdown } from '../src/compiler.js';
import { MAX_DIAGRAM_BLOCKS, MAX_DIAGRAM_SOURCE_BYTES } from '../src/plugins/remark-diagrams.js';

describe('diagram input limits', () => {
  it('reports the first diagram beyond the document limit with its source line', async () => {
    const markdown = Array.from(
      { length: MAX_DIAGRAM_BLOCKS + 1 },
      (_, index) => '```wireframe\nWireframe #diagram-' + index + '\n```',
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

  it('rejects an oversized Wiremark block before calling its renderer', async () => {
    const source = 'x'.repeat(MAX_DIAGRAM_SOURCE_BYTES + 1);

    await expect(
      compileMarkdown('```wiremark\n' + source + '\n```', {
        sourceFile: 'large-diagram.md',
      }),
    ).rejects.toMatchObject({
      name: 'DiagnosticError',
      sourceFile: 'large-diagram.md',
      line: 1,
      message: expect.stringContaining(
        `diagram block is too large: ${MAX_DIAGRAM_SOURCE_BYTES + 1} bytes`,
      ),
    });
  });
});
