import { lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { EXIT_FAILURE, EXIT_OK, EXIT_USAGE, main } from '../src/cli.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'blueprint4llm-cli-'));
  temporaryDirectories.push(directory);
  return directory;
}

function captureIo() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    io: { out: (text: string) => stdout.push(text), err: (text: string) => stderr.push(text) },
  };
}

describe('CLI main', () => {
  it('prints help and package version', async () => {
    const help = captureIo();
    expect(await main(['--help'], help.io)).toBe(EXIT_OK);
    expect(help.stdout.join('')).toContain('blueprint4llm <input.md> --out=<file>');
    expect(help.stdout.join('')).toContain('blueprint4llm <input.md> --check');

    const version = captureIo();
    expect(await main(['--version'], version.io)).toBe(EXIT_OK);
    const packageJson = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version: string };
    expect(version.stdout.join('')).toBe(`${packageJson.version}\n`);
  });

  it('returns usage code and prints usage for invalid arguments', async () => {
    const captured = captureIo();
    expect(await main(['input.md'], captured.io)).toBe(EXIT_USAGE);
    expect(captured.stderr.join('')).toContain('one of --out, --serve, or --check is required');
    expect(captured.stderr.join('')).toContain('Usage:');
  });

  it('checks Markdown, diagrams, and local images without creating output files', async () => {
    const root = await createTemporaryDirectory();
    const input = path.join(root, 'plan.md');
    await writeFile(path.join(root, 'diagram.png'), Buffer.from([137, 80, 78, 71]));
    await writeFile(
      input,
      '# Plan\n\n![diagram](diagram.png)\n\n```wireframe\n' +
        'Wireframe #login mobile\n  Stack column gap=2 padding=2\n' +
        '    Typography h4 "Sign in"\n    Anchor\n```',
    );
    const captured = captureIo();

    expect(await main([input, '--check'], captured.io)).toBe(EXIT_OK);
    expect(captured.stdout.join('')).toBe(`${input}: OK\n`);
    expect(captured.stderr.join('')).toContain(
      'wiremark warning: Anchor without #id can never be targeted',
    );
    expect((await readdir(root)).sort()).toEqual(['diagram.png', 'plan.md']);
  });

  it('checks Pencil blocks through the CLI without creating output files', async () => {
    const root = await createTemporaryDirectory();
    const input = path.join(root, 'pencil.md');
    const pencilJson = JSON.stringify({
      version: '2.21',
      children: [
        {
          id: 'screen',
          type: 'frame',
          width: 200,
          height: 80,
          layout: 'none',
          children: [
            {
              id: 'label',
              type: 'text',
              x: 8,
              y: 8,
              width: 184,
              height: 32,
              content: 'Checked Pencil document',
              fill: '#202124',
            },
          ],
        },
      ],
    });
    await writeFile(input, ['```pen', pencilJson, '```'].join('\n'));
    const captured = captureIo();

    expect(await main([input, '--check'], captured.io)).toBe(EXIT_OK);
    expect(captured.stdout.join('')).toBe(`${input}: OK\n`);
    expect(captured.stderr.join('')).toBe('');
    expect((await readdir(root)).sort()).toEqual(['pencil.md']);
  });

  it('checks documented Balsamiq JSON through the CLI without creating output files', async () => {
    const root = await createTemporaryDirectory();
    const input = path.join(root, 'balsamiq.md');
    const balsamiqJson = JSON.stringify({
      mockup: {
        measuredW: '320',
        measuredH: '180',
        version: '1.0',
        controls: {
          control: [
            {
              ID: 'title',
              typeID: 'Title',
              x: '16',
              y: '16',
              measuredW: '288',
              measuredH: '32',
              zOrder: '0',
              properties: { text: 'Balsamiq CLI check' },
            },
          ],
        },
      },
    });
    await writeFile(input, ['# Balsamiq', '', '```balsamiq', balsamiqJson, '```'].join('\n'));
    const captured = captureIo();

    expect(await main([input, '--check'], captured.io)).toBe(EXIT_OK);
    expect(captured.stdout.join('')).toBe(`${input}: OK\n`);
    expect(captured.stderr.join('')).toBe('');
    expect((await readdir(root)).sort()).toEqual(['balsamiq.md']);
  });

  it('prints Balsamiq JSON positions in --check diagnostics', async () => {
    const root = await createTemporaryDirectory();
    const input = path.join(root, 'broken-balsamiq.md');
    await writeFile(input, '# Broken\n\n```balsamiq\n{\n  "mockup": }\n```');
    const captured = captureIo();

    expect(await main([input, '--check'], captured.io)).toBe(EXIT_FAILURE);
    expect(captured.stdout.join('')).toBe('');
    expect(captured.stderr.join('')).toContain(`${input}:5:13: balsamiq render failed:`);
    expect(captured.stderr.join('')).toContain('invalid Balsamiq JSON');
    expect((await readdir(root)).sort()).toEqual(['broken-balsamiq.md']);
  });

  it('returns failure for diagram errors in check mode and writes no output', async () => {
    const root = await createTemporaryDirectory();
    const input = path.join(root, 'broken.md');
    await writeFile(input, '# Broken\n\n```wiremark\nWireframe mobile\n  UnknownComponent\n```');
    const captured = captureIo();

    expect(await main([input, '--check'], captured.io)).toBe(EXIT_FAILURE);
    expect(captured.stdout.join('')).toBe('');
    expect(captured.stderr.join('')).toContain('wiremark render failed: unknown component');
    expect((await readdir(root)).sort()).toEqual(['broken.md']);
  });

  it('prints a source-aware Figma diagnostic in --check without logging JSON source', async () => {
    const root = await createTemporaryDirectory();
    const input = path.join(root, 'broken-figma.md');
    const figmaJson = JSON.stringify({
      document: {
        id: '0:0',
        name: 'Document',
        type: 'DOCUMENT',
        children: [],
      },
      privateValue: 'FIGMA_JSON_SOURCE_MUST_NOT_APPEAR',
    });
    await writeFile(input, ['# Broken Figma', '', '```figma', figmaJson, '```'].join('\n'));
    const captured = captureIo();

    expect(await main([input, '--check'], captured.io)).toBe(EXIT_FAILURE);
    expect(captured.stdout.join('')).toBe('');
    expect(captured.stderr.join('')).toContain(`${input}:3:1: figma render failed:`);
    expect(captured.stderr.join('')).toContain('no top-level frame');
    expect(captured.stderr.join('')).not.toContain('FIGMA_JSON_SOURCE_MUST_NOT_APPEAR');
    expect((await readdir(root)).sort()).toEqual(['broken-figma.md']);
  });

  it('returns failure for non-fatal diagram diagnostics in check mode', async () => {
    const root = await createTemporaryDirectory();
    const input = path.join(root, 'invalid-plantuml.md');
    await writeFile(input, '# Broken\n\n```plantuml\n@startuml\nclass User {\n@enduml\n```');
    const captured = captureIo();

    expect(await main([input, '--check'], captured.io)).toBe(EXIT_FAILURE);
    expect(captured.stdout.join('')).toBe('');
    expect(captured.stderr.join('')).toContain('plantuml error: Syntax Error?');
    expect((await readdir(root)).sort()).toEqual(['invalid-plantuml.md']);
  }, 60_000);

  it('reports missing local images in check mode', async () => {
    const root = await createTemporaryDirectory();
    const input = path.join(root, 'missing-image.md');
    await writeFile(input, '![missing](./missing.png)');
    const captured = captureIo();

    expect(await main([input, '--check'], captured.io)).toBe(EXIT_FAILURE);
    expect(captured.stdout.join('')).toBe('');
    expect(captured.stderr.join('')).toContain('cannot read local image "./missing.png"');
    expect((await readdir(root)).sort()).toEqual(['missing-image.md']);
  });

  it('builds Markdown to an absolute HTML output path', async () => {
    const root = await createTemporaryDirectory();
    const input = path.join(root, 'blue print.md');
    const output = path.join(root, 'output folder', 'blue print.html');
    await writeFile(input, '# Demo\n\nHello **world**.', 'utf8');
    const captured = captureIo();

    expect(await main([input, `--out=${output}`], captured.io)).toBe(EXIT_OK);
    expect(captured.stdout.join('')).toBe(`${output}\n`);
    expect(await readFile(output, 'utf8')).toContain('<strong>world</strong>');
  });

  it.each([
    { markdown: '# No diagram', count: 0 },
    {
      markdown: '```wireframe\nWireframe mobile\n```\n\n```wireframe\nWireframe desktop\n```',
      count: 2,
    },
  ])('rejects image export when the Markdown has $count diagrams', async ({ markdown, count }) => {
    const root = await createTemporaryDirectory();
    const input = path.join(root, 'diagram.md');
    const output = path.join(root, 'diagram.svg');
    await writeFile(input, markdown);
    const captured = captureIo();

    expect(await main([input, '--out', output, '--format', 'svg'], captured.io)).toBe(EXIT_FAILURE);
    expect(captured.stdout.join('')).toBe('');
    expect(captured.stderr.join('')).toContain(
      `exactly one supported diagram block; found ${count}`,
    );
    expect((await readdir(root)).sort()).toEqual(['diagram.md']);
  });

  it('copies local Markdown images and emits an HTML page without runtime dependencies', async () => {
    const root = await createTemporaryDirectory();
    const imagesDirectory = path.join(root, 'images');
    await mkdir(imagesDirectory);
    const imageBytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    await writeFile(path.join(imagesDirectory, 'logo.png'), imageBytes);
    const input = path.join(root, 'blueprint.md');
    const output = path.join(root, 'output', 'blueprint.html');
    await writeFile(input, '# Blueprint\n\n![Logo](./images/logo.png)');
    const captured = captureIo();

    expect(await main([input, '--out', output], captured.io)).toBe(EXIT_OK);
    const html = await readFile(output, 'utf8');
    const assetName = html.match(/src="assets\/([a-f\d]{64}\.png)"/)?.[1];
    expect(assetName).toBeDefined();
    expect(await readFile(path.join(path.dirname(output), 'assets', assetName ?? ''))).toEqual(
      imageBytes,
    );
    expect(html).toContain('<img src="assets/');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<link');
    expect(html).not.toContain('cdn.');
  });

  it('reports read and write failures with failure code', async () => {
    const root = await createTemporaryDirectory();
    const missing = captureIo();
    expect(
      await main([path.join(root, 'missing.md'), '--out', path.join(root, 'out')], missing.io),
    ).toBe(EXIT_FAILURE);
    expect(missing.stderr.join('')).toContain('cannot read');

    const input = path.join(root, 'input.md');
    const outputFile = path.join(root, 'not-a-file');
    await writeFile(input, '# Demo');
    await mkdir(outputFile);
    const writeFailure = captureIo();
    expect(await main([input, '--out', outputFile], writeFailure.io)).toBe(EXIT_FAILURE);
    expect(writeFailure.stderr.join('')).toContain('cannot write output');
    expect((await lstat(outputFile)).isDirectory()).toBe(true);
  });

  it('keeps --serve running and closes it cleanly on SIGTERM', async () => {
    const root = await createTemporaryDirectory();
    const input = path.join(root, 'serve.md');
    const port = await getAvailablePort();
    await writeFile(input, '# Signal shutdown');
    const captured = captureIo();
    const existingHandlers = new Set(process.listeners('SIGTERM'));
    const running = main([input, '--serve', `--port=${port}`], captured.io);

    try {
      await waitForCondition(() => captured.stdout.join('').includes(`127.0.0.1:${port}`));
      const handler = process
        .listeners('SIGTERM')
        .find((candidate) => !existingHandlers.has(candidate));
      expect(handler).toBeDefined();
      (handler as (() => void) | undefined)?.();
      expect(await running).toBe(EXIT_OK);
      expect(captured.stderr.join('')).toBe('');
    } finally {
      const handler = process
        .listeners('SIGTERM')
        .find((candidate) => !existingHandlers.has(candidate));
      (handler as (() => void) | undefined)?.();
      await running;
    }
  }, 10_000);

  it('creates PDF-only exports with an absolute path', async () => {
    const root = await createTemporaryDirectory();
    const input = path.join(root, 'input.md');
    const pdfPath = path.join(root, 'pdf output', 'document.pdf');
    await writeFile(input, '# Кириллический PDF\n\nSelectable text.');

    const pdf = captureIo();
    expect(await main([input, '--out', pdfPath, '--format', 'pdf'], pdf.io)).toBe(EXIT_OK);
    expect(pdf.stdout.join('')).toBe(`${pdfPath}\n`);
    expect((await readFile(pdfPath)).subarray(0, 5).toString()).toBe('%PDF-');
    await expect(readFile(path.join(path.dirname(pdfPath), 'document.html'))).rejects.toMatchObject(
      {
        code: 'ENOENT',
      },
    );
  });

  it('preserves previous outputs when PDF preparation fails', async () => {
    const root = await createTemporaryDirectory();
    const input = path.join(root, 'remote-image.md');
    const htmlOutput = path.join(root, 'output', 'blueprint.html');
    const pdfOutput = path.join(root, 'output', 'blueprint.pdf');
    await mkdir(path.dirname(htmlOutput));
    await writeFile(input, '![Remote](https://images.example/image.png)');
    await writeFile(htmlOutput, 'previous HTML');
    await writeFile(pdfOutput, 'previous PDF');
    const captured = captureIo();

    expect(await main([input, '--out', pdfOutput, '--format', 'pdf'], captured.io)).toBe(
      EXIT_FAILURE,
    );
    expect(captured.stderr.join('')).toContain(
      'save the image next to the Markdown file and use a relative path',
    );
    expect(await readFile(htmlOutput, 'utf8')).toBe('previous HTML');
    expect(await readFile(pdfOutput, 'utf8')).toBe('previous PDF');
  });

  it('reports a compiler diagnostic and does not publish an oversized document', async () => {
    const root = await createTemporaryDirectory();
    const input = path.join(root, 'too large.md');
    const output = path.join(root, 'output', 'blueprint.html');
    await writeFile(input, 'x'.repeat(5 * 1024 * 1024 + 1));
    const captured = captureIo();

    expect(await main([input, '--out', output], captured.io)).toBe(EXIT_FAILURE);
    expect(captured.stderr.join('')).toContain(`${input}: source Markdown is too large`);
    await expect(readFile(output)).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});

async function getAvailablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('could not reserve a TCP port');
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
  return address.port;
}

async function waitForCondition(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (!condition()) {
    if (Date.now() >= deadline) {
      throw new Error('timed out waiting for the CLI preview server');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
