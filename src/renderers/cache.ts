import { createHash } from 'node:crypto';

import type { DiagramRenderer, DiagramRenderContext, DiagramResult } from './types.js';

const DEFAULT_MAX_ENTRIES = 500;
const DEFAULT_MAX_BYTES = 32 * 1024 * 1024;

interface CacheEntry {
  result: DiagramResult;
  bytes: number;
}

/** Bounded LRU cache for successful raw diagram SVG results. */
export class DiagramRenderCache {
  private readonly entries = new Map<string, CacheEntry>();
  private totalBytes = 0;

  constructor(
    private readonly maxEntries = DEFAULT_MAX_ENTRIES,
    private readonly maxBytes = DEFAULT_MAX_BYTES,
  ) {}

  async render(
    renderer: DiagramRenderer,
    source: string,
    context: DiagramRenderContext,
  ): Promise<DiagramResult> {
    throwIfAborted(context.signal);
    const key = cacheKey(renderer, source);
    const cached = this.entries.get(key);
    if (cached !== undefined) {
      this.entries.delete(key);
      this.entries.set(key, cached);
      return copyResult(cached.result);
    }

    const result = await renderer.render(source, context);
    throwIfAborted(context.signal);
    this.set(key, result);
    return copyResult(result);
  }

  clear(): void {
    this.entries.clear();
    this.totalBytes = 0;
  }

  get size(): number {
    return this.entries.size;
  }

  private set(key: string, result: DiagramResult): void {
    const entryBytes = Buffer.byteLength(result.svg, 'utf8');
    if (this.maxEntries <= 0 || this.maxBytes <= 0 || entryBytes > this.maxBytes) {
      return;
    }

    const previous = this.entries.get(key);
    if (previous !== undefined) {
      this.totalBytes -= previous.bytes;
      this.entries.delete(key);
    }

    while (this.entries.size >= this.maxEntries || this.totalBytes + entryBytes > this.maxBytes) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (oldestKey === undefined) {
        break;
      }
      const oldest = this.entries.get(oldestKey);
      if (oldest !== undefined) {
        this.totalBytes -= oldest.bytes;
      }
      this.entries.delete(oldestKey);
    }

    const stored = copyResult(result);
    this.entries.set(key, { result: stored, bytes: entryBytes });
    this.totalBytes += entryBytes;
  }
}

function cacheKey(renderer: DiagramRenderer, source: string): string {
  return createHash('sha256')
    .update(renderer.name)
    .update('\0')
    .update(renderer.cacheKey)
    .update('\0')
    .update(source)
    .digest('hex');
}

function copyResult(result: DiagramResult): DiagramResult {
  return {
    svg: result.svg,
    warnings: result.warnings.map((warning) => ({ ...warning })),
    ...(result.errors === undefined
      ? {}
      : { errors: result.errors.map((error) => ({ ...error })) }),
  };
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) {
    return;
  }
  throw signal.reason instanceof Error ? signal.reason : new Error('diagram rendering was aborted');
}
