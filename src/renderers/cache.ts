import { createHash } from 'node:crypto';

import type { DiagramRenderer, DiagramRenderContext, DiagramResult } from './types.js';

const DEFAULT_MAX_ENTRIES = 500;
const DEFAULT_MAX_BYTES = 32 * 1024 * 1024;

interface CacheEntry {
  result: DiagramResult;
  bytes: number;
  expiresAt?: number;
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
    const now = Date.now();
    this.removeExpiredEntries(now);
    const key = cacheKey(renderer, source, context);
    const cached = this.entries.get(key);
    if (cached !== undefined) {
      this.entries.delete(key);
      this.entries.set(key, cached);
      return copyResult(cached.result);
    }

    const result = await renderer.render(source, context);
    throwIfAborted(context.signal);
    this.set(key, result, renderer.cacheTtlMsForSource?.(source));
    return copyResult(result);
  }

  clear(): void {
    this.entries.clear();
    this.totalBytes = 0;
  }

  get size(): number {
    this.removeExpiredEntries(Date.now());
    return this.entries.size;
  }

  private set(key: string, result: DiagramResult, ttlMs: number | undefined): void {
    const entryBytes = Buffer.byteLength(result.svg, 'utf8');
    if (
      this.maxEntries <= 0 ||
      this.maxBytes <= 0 ||
      entryBytes > this.maxBytes ||
      (ttlMs !== undefined && (!Number.isFinite(ttlMs) || ttlMs <= 0))
    ) {
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
    this.entries.set(key, {
      result: stored,
      bytes: entryBytes,
      ...(ttlMs === undefined ? {} : { expiresAt: Date.now() + ttlMs }),
    });
    this.totalBytes += entryBytes;
  }

  private removeExpiredEntries(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt !== undefined && entry.expiresAt <= now) {
        this.entries.delete(key);
        this.totalBytes -= entry.bytes;
      }
    }
  }
}

function cacheKey(
  renderer: DiagramRenderer,
  source: string,
  context: DiagramRenderContext,
): string {
  return createHash('sha256')
    .update(renderer.name)
    .update('\0')
    .update(renderer.cacheKey)
    .update('\0')
    .update(renderer.cacheKeyForContext?.(source, context) ?? '')
    .update('\0')
    .update(source)
    .update('\0')
    .update(context.metadata ?? '')
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
