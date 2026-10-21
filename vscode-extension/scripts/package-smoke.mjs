import assert from 'node:assert/strict';
import { log } from 'node:console';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import vscodeTest from '@vscode/test-electron';
import yauzl from 'yauzl';
import { createVSIX } from '@vscode/vsce';
import { createRequire } from 'node:module';

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'blueprint4llm-vsix-smoke-'));
const packagePath = path.join(temporaryDirectory, 'blueprint4llm.vsix');
const unpackedPath = path.join(temporaryDirectory, 'unpacked');
if (process.platform === 'linux') {
  process.env.BLUEPRINT4LLM_DISABLE_CHROME_SANDBOX ??= '1';
}

try {
  await createVSIX({ cwd: extensionRoot, packagePath });
  await mkdir(unpackedPath, { recursive: true });
  const archiveEntries = await extractVsix(packagePath, unpackedPath);

  const packagedExtensionPath = path.join(unpackedPath, 'extension');
  const corePackagePath = path.join(packagedExtensionPath, 'node_modules', 'blueprint4llm');
  const packagedHostSmokePath = path.join(packagedExtensionPath, 'out', 'package-host-smoke.js');
  const rendererPath = path.join(corePackagePath, 'dist', 'src', 'renderers', 'mermaid.js');
  const rendererRequire = createRequire(rendererPath);
  const cliPackageEntry = rendererRequire.resolve('@mermaid-js/mermaid-cli');
  const cliPath = path.join(path.dirname(cliPackageEntry), 'cli.js');
  const puppeteerEntry = rendererRequire.resolve('puppeteer');

  assert.equal(await pathExists(path.join(corePackagePath, 'dist', 'index.js')), true);
  assert.equal(await pathExists(cliPath), true);
  assert.equal(await pathExists(puppeteerEntry), true);
  assert.equal(await pathExists(path.join(packagedExtensionPath, 'node_modules', 'vscode')), false);
  assert.match(
    await readFile(path.join(packagedExtensionPath, 'readme.md'), 'utf8'),
    /npx puppeteer browsers install chrome/,
  );
  assert.equal(
    archiveEntries.some((entry) =>
      /\/(?:chrome-linux|chrome-linux64|chrome-win|chrome-mac)[^/]*\/chrome(?:\.exe)?$/i.test(
        entry,
      ),
    ),
    false,
    'Chrome browser binaries must not be embedded in the VSIX',
  );

  await writeFile(
    packagedHostSmokePath,
    `import assert from 'node:assert/strict';
import * as vscode from 'vscode';

export async function run() {
  const extension = vscode.extensions.getExtension('blueprint4llm.blueprint4llm-vscode');
  assert.ok(extension, 'packaged extension is registered in the Extension Development Host');
  const api = await extension.activate();
  assert.equal(api.hostNodeVersion, process.versions.node);
  const compiled = await api.compileMarkdown('# Packaged extension host smoke check', {
    sourceFile: '/tmp/blueprint4llm-packaged-extension.md',
  });
  assert.ok(compiled.html.includes('<h1>Packaged extension host smoke check</h1>'));
  assert.equal(api.getPreviewCount(), 0);
  console.log('Packaged extension loaded the runtime and compiled Markdown');
}
`,
  );

  await vscodeTest.runTests({
    version: process.env.BLUEPRINT4LLM_VSCODE_TEST_VERSION ?? '1.101.0',
    extensionDevelopmentPath: packagedExtensionPath,
    extensionTestsPath: packagedHostSmokePath,
    launchArgs: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
  });

  const { compileMarkdown } = await import(
    pathToFileURL(path.join(corePackagePath, 'dist', 'index.js')).href
  );
  const compiled = await compileMarkdown(
    '# Packaged Mermaid smoke check\n\n```mermaid\nflowchart LR\n  A --> B\n```',
    { sourceFile: path.join(temporaryDirectory, 'smoke.md') },
  );

  assert.match(compiled.html, /<svg\b/);
  assert.deepEqual(compiled.errors, []);

  const previousPuppeteerCache = process.env.PUPPETEER_CACHE_DIR;
  process.env.PUPPETEER_CACHE_DIR = path.join(temporaryDirectory, 'empty-chrome-cache');
  try {
    await assert.rejects(
      compileMarkdown('# Missing Chrome check\n\n```mermaid\nflowchart LR\n  A --> B\n```', {
        sourceFile: path.join(temporaryDirectory, 'missing-chrome.md'),
      }),
      /npx puppeteer browsers install chrome/,
    );
  } finally {
    if (previousPuppeteerCache === undefined) {
      delete process.env.PUPPETEER_CACHE_DIR;
    } else {
      process.env.PUPPETEER_CACHE_DIR = previousPuppeteerCache;
    }
  }

  log(`VSIX smoke check passed (${Math.round((await stat(packagePath)).size / 1024 / 1024)} MiB)`);
} catch (error) {
  if (
    error instanceof Error &&
    /could not find (?:chrome|chromium)|browser .*was not found/i.test(error.message)
  ) {
    log('Mermaid could not find Chrome. Install it with: npx puppeteer browsers install chrome');
  }
  throw error;
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

function pathExists(targetPath) {
  return stat(targetPath).then(
    () => true,
    () => false,
  );
}

function extractVsix(archivePath, destinationPath) {
  return new Promise((resolve, reject) => {
    const entries = [];
    yauzl.open(archivePath, { lazyEntries: true }, (openError, zipFile) => {
      if (openError !== null) {
        reject(openError);
        return;
      }
      if (zipFile === null) {
        reject(new Error('Could not read generated VSIX'));
        return;
      }

      let extractionFailed = false;
      zipFile.on('error', reject);
      zipFile.on('end', () => {
        if (!extractionFailed) {
          resolve(entries);
        }
      });
      zipFile.on('entry', (entry) => {
        entries.push(entry.fileName);
        void extractEntry(zipFile, entry, destinationPath).then(
          () => zipFile.readEntry(),
          (error) => {
            extractionFailed = true;
            zipFile.close();
            reject(error);
          },
        );
      });
      zipFile.readEntry();
    });
  });
}

async function extractEntry(zipFile, entry, destinationPath) {
  const outputPath = path.resolve(destinationPath, entry.fileName);
  if (outputPath !== destinationPath && !outputPath.startsWith(`${destinationPath}${path.sep}`)) {
    throw new Error(`Unsafe path in VSIX: ${entry.fileName}`);
  }
  if (entry.fileName.endsWith('/')) {
    await mkdir(outputPath, { recursive: true });
    return;
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  const stream = await new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, readStream) => {
      if (error !== null) {
        reject(error);
      } else if (readStream === null) {
        reject(new Error(`Could not read VSIX entry: ${entry.fileName}`));
      } else {
        resolve(readStream);
      }
    });
  });
  await new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    stream.on('error', reject);
    output.on('error', reject);
    output.on('finish', resolve);
    stream.pipe(output);
  });
}
