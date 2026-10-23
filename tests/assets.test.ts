import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { fromHtml } from 'hast-util-from-html';
import { afterEach, describe, expect, it } from 'vitest';
import type { Element, Root } from 'hast';

import { compileMarkdown } from '../src/compiler.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'blueprint4llm-assets-'));
  temporaryDirectories.push(directory);
  return directory;
}

describe('Markdown image assets', () => {
  it('resolves local image paths, preserves URL suffixes, and records MIME types', async () => {
    const root = await createTemporaryDirectory();
    const images = path.join(root, 'images');
    await mkdir(images);
    const imagePath = path.join(images, 'café diagram.png');
    const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    await writeFile(imagePath, bytes);

    const compiled = await compileMarkdown(
      '![diagram](./images/caf%C3%A9%20diagram.png?variant=1#preview)',
      { sourceFile: path.join(root, 'blueprint.md') },
    );

    expect(compiled.html).toContain(
      `src="assets/${compiled.assets[0]?.outputName}?variant=1#preview"`,
    );
    expect(compiled.assets).toHaveLength(1);
    expect(compiled.assets[0]).toMatchObject({
      originalUrl: './images/caf%C3%A9%20diagram.png?variant=1#preview',
      bytes,
      mimeType: 'image/png',
    });
    expect(compiled.assets[0]?.outputName).toMatch(/^[a-f\d]{64}\.png$/);
  });

  it('keeps absolute HTTP(S) images external without downloading them', async () => {
    const root = await createTemporaryDirectory();
    const compiled = await compileMarkdown(
      '![one](https://images.example/one.png) ![two](http://images.example/two.jpg)',
      { sourceFile: path.join(root, 'blueprint.md') },
    );

    expect(compiled.html).toContain('src="https://images.example/one.png"');
    expect(compiled.html).toContain('src="http://images.example/two.jpg"');
    expect(compiled.assets).toEqual([]);
  });

  it.each([
    'javascript:alert(1)',
    'data:image/png;base64,AA==',
    'file:///tmp/image.png',
    '//cdn.example/image.png',
  ])('rejects unsafe image URL %s', async (url) => {
    const root = await createTemporaryDirectory();
    await expect(
      compileMarkdown(`![unsafe](${url})`, { sourceFile: path.join(root, 'blueprint.md') }),
    ).rejects.toMatchObject({ name: 'DiagnosticError', line: 1 });
  });

  it('reports a missing image at its Markdown source position', async () => {
    const root = await createTemporaryDirectory();
    const watchPaths = new Set<string>();
    await expect(
      compileMarkdown('## Heading\n\n![missing](./missing.png)', {
        sourceFile: path.join(root, 'blueprint.md'),
        watchPaths,
      }),
    ).rejects.toMatchObject({
      name: 'DiagnosticError',
      line: 3,
      message: expect.stringContaining('cannot read local image'),
    });
    expect([...watchPaths]).toEqual([path.join(root, 'missing.png')]);
  });

  it('rejects paths and symlinks that resolve outside the Markdown directory', async () => {
    const root = await createTemporaryDirectory();
    const outside = path.join(root, 'secret.png');
    const outsideDirectory = path.join(root, 'outside');
    const project = path.join(root, 'project');
    await mkdir(outsideDirectory);
    await mkdir(project);
    await writeFile(outside, 'secret');
    await writeFile(path.join(outsideDirectory, 'secret.png'), 'secret');
    await symlink(outsideDirectory, path.join(project, 'linked'), 'junction');

    const sourceFile = path.join(project, 'blueprint.md');
    await expect(compileMarkdown('![escape](../secret.png)', { sourceFile })).rejects.toMatchObject(
      { name: 'DiagnosticError', message: expect.stringContaining('outside') },
    );
    await expect(
      compileMarkdown('![encoded escape](%2e%2e/secret.png)', { sourceFile }),
    ).rejects.toMatchObject({
      name: 'DiagnosticError',
      message: expect.stringContaining('outside'),
    });
    await expect(
      compileMarkdown('![link](./linked/secret.png)', { sourceFile }),
    ).rejects.toMatchObject({
      name: 'DiagnosticError',
      message: expect.stringContaining('outside'),
    });
  });

  it('does not interpret ordinary fenced code as an image reference', async () => {
    const root = await createTemporaryDirectory();
    const compiled = await compileMarkdown('```markdown\n![missing](./missing.png)\n```', {
      sourceFile: path.join(root, 'blueprint.md'),
    });

    expect(collectText(fromHtml(compiled.html))).toContain('![missing](./missing.png)');
    expect(compiled.assets).toEqual([]);
  });

  it('resolves its Markdown project root before accessing local images', async () => {
    const root = await createTemporaryDirectory();
    await writeFile(path.join(root, 'image.gif'), 'GIF89a');
    const sourceDirectory = await realpath(root);
    const compiled = await compileMarkdown('![image](image.gif)', {
      sourceFile: path.join(sourceDirectory, 'blueprint.md'),
    });

    expect(compiled.assets[0]?.mimeType).toBe('image/gif');
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
