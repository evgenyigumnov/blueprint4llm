import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

import type { Nodes as MdastNode, Root as MdastRoot } from 'mdast';

import { DiagnosticError } from './errors.js';

/** A local image needed to make the generated HTML self-contained on disk. */
export interface LocalAsset {
  /** URL as written in the Markdown, retained for print rendering. */
  originalUrl: string;
  /** Relative URL used by the generated HTML. */
  outputUrl: string;
  /** Deterministic filename copied into the output HTML file's adjacent assets folder. */
  outputName: string;
  /** Canonical local path watched by live preview. */
  sourcePath: string;
  bytes: Uint8Array;
  mimeType: string;
}

export interface RemarkLocalAssetsOptions {
  sourceFile: string;
  assets: LocalAsset[];
  watchPaths?: Set<string>;
}

const MIME_TYPES: Readonly<Record<string, string>> = {
  '.apng': 'image/apng',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.ico': 'image/vnd.microsoft.icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.webp': 'image/webp',
};

/** Resolves Markdown image URLs and rewrites local images to output assets. */
export function remarkLocalAssetsPlugin(options: RemarkLocalAssetsOptions) {
  return async (tree: MdastRoot): Promise<void> => {
    const images: Extract<MdastNode, { type: 'image' }>[] = [];
    collectImages(tree, images);

    const localImages: Extract<MdastNode, { type: 'image' }>[] = [];
    for (const image of images) {
      if (isHttpUrl(image.url)) {
        try {
          new URL(image.url);
        } catch (error) {
          throw new DiagnosticError(`invalid external image URL "${image.url}"`, {
            sourceFile: options.sourceFile,
            ...(image.position === undefined
              ? {}
              : { line: image.position.start.line, column: image.position.start.column }),
            cause: error,
          });
        }
      } else {
        localImages.push(image);
      }
    }
    if (localImages.length === 0) {
      return;
    }

    const sourceDirectory = await getSourceDirectory(options.sourceFile);
    collectWatchPaths(localImages, sourceDirectory, options.watchPaths);
    const assetsByUrl = new Map<string, LocalAsset>();

    for (const image of localImages) {
      const existing = assetsByUrl.get(image.url);
      if (existing !== undefined) {
        image.url = existing.outputUrl;
        continue;
      }

      const asset = await loadLocalImage(image.url, sourceDirectory, options.sourceFile, image);
      assetsByUrl.set(image.url, asset);
      image.url = asset.outputUrl;
    }

    options.assets.push(...assetsByUrl.values());
  };
}

function collectImages(
  node: MdastRoot | MdastNode,
  images: Extract<MdastNode, { type: 'image' }>[],
): void {
  if (node.type === 'image') {
    images.push(node);
  }

  if ('children' in node) {
    for (const child of node.children as MdastNode[]) {
      collectImages(child, images);
    }
  }
}

async function getSourceDirectory(sourceFile: string): Promise<string> {
  try {
    return await realpath(path.resolve(path.dirname(sourceFile)));
  } catch (error) {
    throw new DiagnosticError(`cannot resolve Markdown project directory: ${errorMessage(error)}`, {
      sourceFile,
      cause: error,
    });
  }
}

async function loadLocalImage(
  originalUrl: string,
  sourceDirectory: string,
  sourceFile: string,
  image: Extract<MdastNode, { type: 'image' }>,
): Promise<LocalAsset> {
  const location = {
    sourceFile,
    ...(image.position === undefined
      ? {}
      : { line: image.position.start.line, column: image.position.start.column }),
  };

  let filePath: string;
  let suffix: string;
  try {
    ({ filePath, suffix } = parseLocalUrl(originalUrl));
  } catch (error) {
    throw new DiagnosticError(errorMessage(error), { ...location, cause: error });
  }

  const candidatePath = path.resolve(sourceDirectory, filePath);
  if (!isPathInside(sourceDirectory, candidatePath)) {
    throw new DiagnosticError(
      `local image "${originalUrl}" is outside the Markdown project`,
      location,
    );
  }

  let actualPath: string;
  try {
    actualPath = await realpath(candidatePath);
  } catch (error) {
    throw new DiagnosticError(`cannot read local image "${originalUrl}": ${errorMessage(error)}`, {
      ...location,
      cause: error,
    });
  }

  if (!isPathInside(sourceDirectory, actualPath)) {
    throw new DiagnosticError(
      `local image "${originalUrl}" resolves outside the Markdown project`,
      location,
    );
  }

  let imageStats;
  try {
    imageStats = await stat(actualPath);
  } catch (error) {
    throw new DiagnosticError(`cannot read local image "${originalUrl}": ${errorMessage(error)}`, {
      ...location,
      cause: error,
    });
  }
  if (!imageStats.isFile()) {
    throw new DiagnosticError(`local image "${originalUrl}" is not a regular file`, location);
  }

  let bytes: Buffer;
  try {
    bytes = await readFile(actualPath);
  } catch (error) {
    throw new DiagnosticError(`cannot read local image "${originalUrl}": ${errorMessage(error)}`, {
      ...location,
      cause: error,
    });
  }

  const extension = safeExtension(path.extname(actualPath));
  const digest = createHash('sha256').update(bytes).digest('hex');
  const outputName = `${digest}${extension}`;
  const outputUrl = `assets/${outputName}${suffix}`;

  return {
    originalUrl,
    outputUrl,
    outputName,
    sourcePath: actualPath,
    bytes,
    mimeType: MIME_TYPES[extension] ?? 'application/octet-stream',
  };
}

function collectWatchPaths(
  images: readonly Extract<MdastNode, { type: 'image' }>[],
  sourceDirectory: string,
  watchPaths: Set<string> | undefined,
): void {
  if (watchPaths === undefined) {
    return;
  }
  for (const image of images) {
    try {
      const { filePath } = parseLocalUrl(image.url);
      const candidatePath = path.resolve(sourceDirectory, filePath);
      if (isPathInside(sourceDirectory, candidatePath)) {
        watchPaths.add(candidatePath);
      }
    } catch {
      // The normal asset validation below reports the source-aware diagnostic.
    }
  }
}

function parseLocalUrl(url: string): { filePath: string; suffix: string } {
  if (url.length === 0) {
    throw new Error('local image URL must not be empty');
  }
  if (url.startsWith('//') || url.startsWith('/') || url.startsWith('\\')) {
    throw new Error(
      `unsupported absolute image URL "${url}"; use a path relative to the Markdown file`,
    );
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(url)) {
    throw new Error(`unsupported image URL scheme in "${url}"; only HTTP(S) URLs are external`);
  }
  if (url.includes('\\')) {
    throw new Error(`image URL "${url}" contains a backslash; use forward slashes`);
  }

  const suffixStart = [url.indexOf('?'), url.indexOf('#')]
    .filter((index) => index >= 0)
    .reduce((min, index) => Math.min(min, index), url.length);
  const encodedPath = url.slice(0, suffixStart);
  const suffix = url.slice(suffixStart);
  if (encodedPath.length === 0) {
    throw new Error(`image URL "${url}" does not include a file path`);
  }

  let filePath: string;
  try {
    filePath = decodeURIComponent(encodedPath);
  } catch (error) {
    throw new Error(`image URL "${url}" contains invalid percent encoding`, { cause: error });
  }
  if (filePath.includes('\0') || filePath.includes('\\')) {
    throw new Error(`image URL "${url}" contains an invalid path`);
  }
  if (path.isAbsolute(filePath)) {
    throw new Error(
      `unsupported absolute image URL "${url}"; use a path relative to the Markdown file`,
    );
  }

  return { filePath, suffix };
}

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
}

function safeExtension(extension: string): string {
  const normalized = extension.toLowerCase();
  return /^\.[a-z\d]{1,10}$/.test(normalized) ? normalized : '';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
