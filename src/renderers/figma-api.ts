import type { ParsedFigmaUrl } from './figma-url.js';
import { ConcurrencyLimiter } from './concurrency-limiter.js';

const FIGMA_IMAGES_API = 'https://api.figma.com/v1/images/';
export const FIGMA_REQUEST_TIMEOUT_MS = 20_000;
export const MAX_FIGMA_API_RESPONSE_BYTES = 256 * 1024;
export const MAX_FIGMA_SVG_RESPONSE_BYTES = 5 * 1024 * 1024;
export const MAX_CONCURRENT_FIGMA_REQUESTS = 4;

const figmaRequestLimiter = new ConcurrencyLimiter(MAX_CONCURRENT_FIGMA_REQUESTS);

export interface FigmaFetchOptions {
  signal?: AbortSignal;
}

/** Fetches one frame as SVG through Figma's authenticated images endpoint. */
export async function fetchFigmaSvg(
  figmaUrl: ParsedFigmaUrl,
  accessToken: string,
  options: FigmaFetchOptions = {},
): Promise<string> {
  throwIfAborted(options.signal);
  return figmaRequestLimiter.run(() => fetchFigmaSvgWithLimits(figmaUrl, accessToken, options));
}

async function fetchFigmaSvgWithLimits(
  figmaUrl: ParsedFigmaUrl,
  accessToken: string,
  options: FigmaFetchOptions,
): Promise<string> {
  const token = accessToken.trim();
  if (token.length === 0) {
    throw new Error('FIGMA_ACCESS_TOKEN is required to render a Figma URL');
  }

  const timeoutSignal = AbortSignal.timeout(FIGMA_REQUEST_TIMEOUT_MS);
  const signal =
    options.signal === undefined ? timeoutSignal : AbortSignal.any([options.signal, timeoutSignal]);

  const endpoint = new URL(encodeURIComponent(figmaUrl.fileKey), FIGMA_IMAGES_API);
  endpoint.searchParams.set('ids', figmaUrl.nodeId);
  endpoint.searchParams.set('format', 'svg');
  endpoint.searchParams.set('svg_outline_text', 'false');
  if (figmaUrl.versionId !== undefined) {
    endpoint.searchParams.set('version', figmaUrl.versionId);
  }

  try {
    const apiResponse = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json', 'X-Figma-Token': token },
      redirect: 'error',
      signal,
    });
    if (!apiResponse.ok) {
      await cancelResponseBody(apiResponse);
      throw new Error(formatHttpFailure(apiResponse.status, 'api'));
    }

    const apiPayload = await readApiPayload(apiResponse);
    const imageUrl = readImageUrl(apiPayload, figmaUrl.nodeId);
    const parsedImageUrl = parseImageUrl(imageUrl);
    const svgResponse = await fetch(parsedImageUrl, {
      method: 'GET',
      headers: { Accept: 'image/svg+xml' },
      redirect: 'error',
      signal,
    });
    if (!svgResponse.ok) {
      await cancelResponseBody(svgResponse);
      throw new Error(formatHttpFailure(svgResponse.status, 'svg'));
    }

    const svg = await readLimitedText(
      svgResponse,
      MAX_FIGMA_SVG_RESPONSE_BYTES,
      'Figma SVG response',
    );
    if (svg.trim().length === 0) {
      throw new Error('Figma SVG download returned an empty response');
    }
    return svg;
  } catch (error) {
    if (timeoutSignal.aborted && !options.signal?.aborted) {
      throw new Error(`Figma request timed out after ${FIGMA_REQUEST_TIMEOUT_MS} ms`, {
        cause: error,
      });
    }
    throw error;
  }
}

function formatHttpFailure(status: number, stage: 'api' | 'svg'): string {
  if (stage === 'api') {
    switch (status) {
      case 401:
        return 'Figma authentication failed (HTTP 401); the FIGMA_ACCESS_TOKEN is invalid or expired';
      case 403:
        return 'Figma access denied (HTTP 403); check file permissions and the file_content:read scope';
      case 404:
        return 'Figma file or node was not found or is not available to this token (HTTP 404)';
      case 429:
        return 'Figma API rate limit exceeded (HTTP 429); retry after the limit resets';
      default:
        return `Figma API request failed (HTTP ${status})`;
    }
  }

  return status === 429
    ? 'Figma SVG download rate limit exceeded (HTTP 429); retry later'
    : `Figma SVG download failed (HTTP ${status})`;
}

async function readApiPayload(response: Response): Promise<unknown> {
  const text = await readLimitedText(response, MAX_FIGMA_API_RESPONSE_BYTES, 'Figma API response');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('Figma API returned an invalid JSON response');
  }
}

async function readLimitedText(
  response: Response,
  maxBytes: number,
  description: string,
): Promise<string> {
  const contentLength = response.headers.get('content-length');
  if (contentLength !== null && /^\d+$/.test(contentLength)) {
    const declaredLength = Number(contentLength);
    if (declaredLength > maxBytes) {
      await cancelResponseBody(response);
      throw new Error(`${description} is too large (limit ${maxBytes} bytes)`);
    }
  }

  const reader = response.body?.getReader();
  if (reader === undefined) {
    return '';
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      if (value === undefined) {
        continue;
      }
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new Error(`${description} is too large (limit ${maxBytes} bytes)`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${description} is not valid UTF-8`);
  }
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Keep the HTTP status or size diagnostic when a response cannot be cancelled.
  }
}

function readImageUrl(payload: unknown, nodeId: string): string {
  if (!isRecord(payload) || !isRecord(payload.images)) {
    throw new Error('Figma API response did not contain an images object');
  }
  const imageUrl = payload.images[nodeId];
  if (typeof imageUrl !== 'string' || imageUrl.trim().length === 0) {
    throw new Error(`Figma API did not return an SVG for node "${nodeId}"`);
  }
  return imageUrl;
}

function parseImageUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Figma API returned an invalid SVG URL');
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') {
    throw new Error('Figma API returned an SVG URL that must use HTTPS without credentials');
  }
  return url;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) {
    return;
  }
  throw signal.reason instanceof Error ? signal.reason : new Error('Figma rendering was aborted');
}
