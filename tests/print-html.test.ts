import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { compileMarkdown } from '../src/compiler.js';
import { createPrintHtml } from '../src/print-html.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'blueprint4llm-print-html-'));
  temporaryDirectories.push(directory);
  return directory;
}

describe('print HTML preparation', () => {
  it('embeds local images, the licensed Cyrillic font, and print layout styles', async () => {
    const root = await createTemporaryDirectory();
    const imageDirectory = path.join(root, 'images');
    await mkdir(imageDirectory);
    const imageBytes = Buffer.from('local image bytes');
    await writeFile(path.join(imageDirectory, 'logo.png'), imageBytes);
    const compiled = await compileMarkdown('# Проверка\n\n![Logo](./images/logo.png)', {
      sourceFile: path.join(root, 'blueprint.md'),
    });

    const html = await createPrintHtml(compiled);

    expect(html).toContain(`data:image/png;base64,${imageBytes.toString('base64')}`);
    expect(html).not.toContain('assets/');
    expect(html).toContain("font-family: 'Noto Sans'");
    expect(html).toContain('data:font/ttf;base64,');
    expect(html).toContain('max-height: 220mm');
    expect(html).toContain('table-layout: fixed');
    expect(html).toContain('<!doctype html>');
  });

  it('rejects external images before Chromium can load them', async () => {
    const compiled = await compileMarkdown('![Remote](https://images.example/logo.png)', {
      sourceFile: 'remote.md',
    });

    await expect(createPrintHtml(compiled)).rejects.toThrow(
      'cannot include external image "https://images.example/logo.png" in a PDF',
    );
  });
});
