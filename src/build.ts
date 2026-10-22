import { randomUUID } from 'node:crypto';
import { lstat, link, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { LocalAsset } from './assets.js';

const GENERATED_ASSET_NAME = /^[a-f\d]{64}(?:\.[a-z\d]{1,10})?$/;

export interface BlueprintOutputOptions {
  html?: string;
  pdf?: Uint8Array;
  assets?: readonly LocalAsset[];
}

export interface BlueprintOutputPaths {
  htmlPath?: string;
  pdfPath?: string;
}

/** Copies referenced assets and atomically writes the requested HTML file. */
export async function writeHtmlOutput(
  outputFile: string,
  html: string,
  assets: readonly LocalAsset[] = [],
): Promise<string> {
  const outputs = await writeBlueprintOutput(outputFile, { html, assets });
  return outputs.htmlPath!;
}

/** Atomically writes one SVG or raster output file and returns its absolute path. */
export async function writeSingleOutput(
  outputFile: string,
  content: string | Uint8Array,
): Promise<string> {
  const absoluteOutputFile = path.resolve(outputFile);
  await mkdir(path.dirname(absoluteOutputFile), { recursive: true });
  await ensureReplaceable(absoluteOutputFile);

  const tempPath = temporaryPath(absoluteOutputFile, 'tmp');
  try {
    if (typeof content === 'string') {
      await writeFile(tempPath, content, 'utf8');
    } else {
      await writeFile(tempPath, content);
    }
    await rename(tempPath, absoluteOutputFile);
    return absoluteOutputFile;
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
}

/**
 * Writes files to `outputFile`; when both formats are requested, it creates
 * the companion file with the corresponding `.html` or `.pdf` extension.
 */
export async function writeBlueprintOutput(
  outputFile: string,
  options: BlueprintOutputOptions,
): Promise<BlueprintOutputPaths> {
  if (options.html === undefined && options.pdf === undefined) {
    throw new Error('at least one output format must be requested');
  }

  const outputPaths = resolveOutputPaths(outputFile, options);
  const outputDirectory = path.dirname(outputPaths.htmlPath ?? outputPaths.pdfPath!);
  await mkdir(outputDirectory, { recursive: true });
  const outputEntries = [
    ...(options.html === undefined ? [] : [{ path: outputPaths.htmlPath!, content: options.html }]),
    ...(options.pdf === undefined ? [] : [{ path: outputPaths.pdfPath!, content: options.pdf }]),
  ];
  await Promise.all(outputEntries.map(({ path: finalPath }) => ensureReplaceable(finalPath)));
  if (options.html !== undefined && (options.assets?.length ?? 0) > 0) {
    await writeAssets(outputDirectory, options.assets ?? []);
  }

  const stagedPaths: string[] = [];
  const backups = new Map<string, string>();
  const publishedPaths: string[] = [];

  try {
    for (const { path: finalPath, content } of outputEntries) {
      await ensureReplaceable(finalPath);
      const tempPath = temporaryPath(finalPath, 'tmp');
      await writeFile(tempPath, content, typeof content === 'string' ? 'utf8' : undefined);
      stagedPaths.push(tempPath);
    }

    for (const { path: finalPath } of outputEntries) {
      const backupPath = temporaryPath(finalPath, 'bak');
      try {
        await rename(finalPath, backupPath);
        backups.set(finalPath, backupPath);
      } catch (error) {
        if (!isMissingFileError(error)) {
          throw error;
        }
      }
    }

    for (let index = 0; index < outputEntries.length; index += 1) {
      const finalPath = outputEntries[index]!.path;
      await rename(stagedPaths[index]!, finalPath);
      publishedPaths.push(finalPath);
    }

    await Promise.all(
      [...backups.values()].map((backupPath) => unlink(backupPath).catch(() => undefined)),
    );
  } catch (error) {
    await Promise.all(publishedPaths.map((filePath) => unlink(filePath).catch(() => undefined)));
    for (const [finalPath, backupPath] of [...backups.entries()].reverse()) {
      await rename(backupPath, finalPath).catch(() => undefined);
    }
    throw error;
  } finally {
    await Promise.all(stagedPaths.map((filePath) => unlink(filePath).catch(() => undefined)));
  }

  return outputPaths;
}

function resolveOutputPaths(
  outputFile: string,
  options: BlueprintOutputOptions,
): BlueprintOutputPaths {
  const absoluteOutputFile = path.resolve(outputFile);
  if (options.html !== undefined && options.pdf !== undefined) {
    const parsed = path.parse(absoluteOutputFile);
    if (parsed.ext.toLowerCase() === '.pdf') {
      return {
        htmlPath: path.join(parsed.dir, `${parsed.name}.html`),
        pdfPath: absoluteOutputFile,
      };
    }
    return {
      htmlPath: absoluteOutputFile,
      pdfPath: path.join(parsed.dir, `${parsed.name}.pdf`),
    };
  }

  return options.html === undefined
    ? { pdfPath: absoluteOutputFile }
    : { htmlPath: absoluteOutputFile };
}

function temporaryPath(filePath: string, suffix: 'tmp' | 'bak'): string {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `.${parsed.base}.${process.pid}.${randomUUID()}.${suffix}`);
}

async function writeAssets(outputDirectory: string, assets: readonly LocalAsset[]): Promise<void> {
  const assetsDirectory = path.join(outputDirectory, 'assets');
  await mkdir(assetsDirectory, { recursive: true });
  const assetsDirectoryStats = await lstat(assetsDirectory);
  if (!assetsDirectoryStats.isDirectory() || assetsDirectoryStats.isSymbolicLink()) {
    throw new Error(`output assets path is not a real directory: ${assetsDirectory}`);
  }
  const uniqueAssets = new Map(assets.map((asset) => [asset.outputName, asset]));
  for (const asset of uniqueAssets.values()) {
    await writeAsset(assetsDirectory, asset);
  }
}

async function ensureReplaceable(filePath: string): Promise<void> {
  try {
    const stats = await lstat(filePath);
    if (stats.isDirectory()) {
      throw new Error(`cannot replace output file with a directory: ${filePath}`);
    }
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }
  }
}

async function writeAsset(assetsDirectory: string, asset: LocalAsset): Promise<void> {
  if (
    path.basename(asset.outputName) !== asset.outputName ||
    !GENERATED_ASSET_NAME.test(asset.outputName)
  ) {
    throw new Error(`invalid generated asset name: ${asset.outputName}`);
  }

  const finalPath = path.join(assetsDirectory, asset.outputName);
  const tempPath = path.join(
    assetsDirectory,
    `.${asset.outputName}.${process.pid}.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(tempPath, asset.bytes, { flag: 'wx' });
    try {
      await link(tempPath, finalPath);
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        throw error;
      }
      const existingStats = await lstat(finalPath);
      if (!existingStats.isFile() || existingStats.isSymbolicLink()) {
        throw new Error(`generated asset path conflicts with an existing file: ${finalPath}`, {
          cause: error,
        });
      }
      const existingBytes = await readFile(finalPath);
      if (!existingBytes.equals(asset.bytes)) {
        throw new Error(`generated asset path conflicts with an existing file: ${finalPath}`, {
          cause: error,
        });
      }
    }
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
}

function isAlreadyExistsError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST';
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
