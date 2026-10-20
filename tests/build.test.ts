import { lstat, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { writeBlueprintOutput, writeHtmlOutput } from '../src/build.js';
import type { LocalAsset } from '../src/assets.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'blueprint4llm-'));
  temporaryDirectories.push(directory);
  return directory;
}

describe('writeHtmlOutput', () => {
  it('creates parent directories and writes the requested HTML file', async () => {
    const root = await createTemporaryDirectory();
    const outputFile = path.join(root, 'output with spaces', 'blue print.html');
    const resultPath = await writeHtmlOutput(outputFile, '<!doctype html>');

    expect(resultPath).toBe(outputFile);
    expect(await readFile(resultPath, 'utf8')).toBe('<!doctype html>');
  });

  it('replaces only the requested file and preserves unrelated files', async () => {
    const outputDirectory = await createTemporaryDirectory();
    const outputFile = path.join(outputDirectory, 'blueprint.html');
    await mkdir(path.join(outputDirectory, 'assets'));
    await writeFile(path.join(outputDirectory, 'notes.txt'), 'keep me');
    await writeFile(outputFile, 'old page');

    await writeHtmlOutput(outputFile, 'new page');

    expect(await readFile(outputFile, 'utf8')).toBe('new page');
    expect(await readFile(path.join(outputDirectory, 'notes.txt'), 'utf8')).toBe('keep me');
  });

  it('copies referenced assets before publishing HTML and preserves unrelated assets', async () => {
    const outputDirectory = await createTemporaryDirectory();
    const assetsDirectory = path.join(outputDirectory, 'assets');
    await mkdir(assetsDirectory);
    await writeFile(path.join(assetsDirectory, 'notes.txt'), 'keep me');
    const bytes = Buffer.from('image bytes');
    const asset: LocalAsset = {
      originalUrl: './image.png',
      outputUrl: 'assets/' + 'a'.repeat(64) + '.png',
      outputName: 'a'.repeat(64) + '.png',
      sourcePath: '/tmp/image.png',
      bytes,
      mimeType: 'image/png',
    };

    const htmlPath = path.join(outputDirectory, 'blueprint.html');
    await writeHtmlOutput(htmlPath, '<img src="assets/image.png">', [asset]);

    expect(await readFile(path.join(assetsDirectory, asset.outputName))).toEqual(bytes);
    expect(await readFile(path.join(assetsDirectory, 'notes.txt'), 'utf8')).toBe('keep me');
    expect(await readFile(htmlPath, 'utf8')).toContain('<img src="assets/image.png">');
  });

  it('does not overwrite an unrelated file at a generated asset path', async () => {
    const outputDirectory = await createTemporaryDirectory();
    const assetsDirectory = path.join(outputDirectory, 'assets');
    await mkdir(assetsDirectory);
    const outputName = 'b'.repeat(64) + '.png';
    await writeFile(path.join(assetsDirectory, outputName), 'user file');
    const asset: LocalAsset = {
      originalUrl: './image.png',
      outputUrl: `assets/${outputName}`,
      outputName,
      sourcePath: '/tmp/image.png',
      bytes: Buffer.from('generated image'),
      mimeType: 'image/png',
    };

    await expect(
      writeHtmlOutput(path.join(outputDirectory, 'blueprint.html'), 'new html', [asset]),
    ).rejects.toThrow('generated asset path conflicts with an existing file');
    expect(await readFile(path.join(assetsDirectory, outputName), 'utf8')).toBe('user file');
  });

  it('rejects a directory as the HTML file before copying assets', async () => {
    const outputDirectory = await createTemporaryDirectory();
    const asset: LocalAsset = {
      originalUrl: './image.png',
      outputUrl: `assets/${'c'.repeat(64)}.png`,
      outputName: `${'c'.repeat(64)}.png`,
      sourcePath: '/tmp/image.png',
      bytes: Buffer.from('image bytes'),
      mimeType: 'image/png',
    };

    await expect(writeHtmlOutput(outputDirectory, 'new html', [asset])).rejects.toThrow(
      'cannot replace output file with a directory',
    );
    await expect(lstat(path.join(outputDirectory, 'assets'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});

describe('writeBlueprintOutput', () => {
  it('publishes PDF only at the requested absolute path', async () => {
    const root = await createTemporaryDirectory();
    const outputFile = path.join(root, 'reports', 'blueprint.pdf');
    const pdf = Buffer.from('%PDF-1.7 test');

    const outputs = await writeBlueprintOutput(outputFile, { pdf });

    expect(outputs).toEqual({ pdfPath: outputFile });
    expect(await readFile(outputFile)).toEqual(pdf);
    await expect(
      readFile(path.join(path.dirname(outputFile), 'blueprint.html')),
    ).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('writes sibling HTML and PDF files for both formats', async () => {
    const root = await createTemporaryDirectory();
    const htmlPath = path.join(root, 'blueprint.html');
    const pdfPath = path.join(root, 'blueprint.pdf');

    const outputs = await writeBlueprintOutput(htmlPath, {
      html: '<main>page</main>',
      pdf: Buffer.from('%PDF-1.7 test'),
    });

    expect(outputs).toEqual({ htmlPath, pdfPath });
    expect(await readFile(htmlPath, 'utf8')).toBe('<main>page</main>');
    expect(await readFile(pdfPath)).toEqual(Buffer.from('%PDF-1.7 test'));
  });

  it('writes sibling HTML when the requested both-format path ends in .pdf', async () => {
    const root = await createTemporaryDirectory();
    const htmlPath = path.join(root, 'blueprint.html');
    const pdfPath = path.join(root, 'blueprint.pdf');

    const outputs = await writeBlueprintOutput(pdfPath, {
      html: '<main>page</main>',
      pdf: Buffer.from('%PDF-1.7 test'),
    });

    expect(outputs).toEqual({ htmlPath, pdfPath });
    expect(await readFile(htmlPath, 'utf8')).toBe('<main>page</main>');
    expect(await readFile(pdfPath)).toEqual(Buffer.from('%PDF-1.7 test'));
  });

  it('keeps existing outputs when a requested target is not replaceable', async () => {
    const outputDirectory = await createTemporaryDirectory();
    const htmlPath = path.join(outputDirectory, 'blueprint.html');
    const pdfPath = path.join(outputDirectory, 'blueprint.pdf');
    await writeFile(htmlPath, 'previous html');
    await mkdir(pdfPath);

    await expect(
      writeBlueprintOutput(htmlPath, { html: 'new html', pdf: Buffer.from('%PDF-') }),
    ).rejects.toThrow('cannot replace output file with a directory');

    expect(await readFile(htmlPath, 'utf8')).toBe('previous html');
    expect((await lstat(pdfPath)).isDirectory()).toBe(true);
  });
});
