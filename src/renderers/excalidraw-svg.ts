import { getExcalidrawElementBounds } from './excalidraw-geometry.js';
import type { ExcalidrawBounds, ExcalidrawScene } from './excalidraw-schema.js';
import { MAX_EXCALIDRAW_SVG_BYTES } from './excalidraw-schema.js';
import { renderExcalidrawElement } from './excalidraw-svg-elements.js';
import { formatExcalidrawNumber, escapeAttribute } from './excalidraw-svg-utils.js';

const VIEWBOX_PADDING = 16;

/** Converts a normalized Excalidraw scene into bounded, deterministic static SVG. */
export function renderExcalidrawSvg(scene: ExcalidrawScene, signal?: AbortSignal): string {
  const visible = scene.elements.filter((element) => !element.isDeleted);
  if (visible.length === 0) {
    return renderEmptyScene(scene.backgroundColor);
  }

  const bounds = emptyBounds();
  for (const [index, element] of visible.entries()) {
    if (index % 64 === 0) {
      throwIfAborted(signal);
    }
    mergeBounds(bounds, getExcalidrawElementBounds(element));
  }
  const minX = bounds.minX - VIEWBOX_PADDING;
  const minY = bounds.minY - VIEWBOX_PADDING;
  const width = Math.max(1, bounds.maxX - bounds.minX + VIEWBOX_PADDING * 2);
  const height = Math.max(1, bounds.maxY - bounds.minY + VIEWBOX_PADDING * 2);
  const builder = new SvgBuilder();
  builder.append(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${formatExcalidrawNumber(width)}" height="${formatExcalidrawNumber(height)}" viewBox="${formatExcalidrawNumber(minX)} ${formatExcalidrawNumber(minY)} ${formatExcalidrawNumber(width)} ${formatExcalidrawNumber(height)}">`,
  );
  builder.append('<title>Excalidraw scene</title>');
  if (scene.backgroundColor !== 'transparent') {
    builder.append(
      `<rect class="excalidraw-background" x="${formatExcalidrawNumber(minX)}" y="${formatExcalidrawNumber(minY)}" width="${formatExcalidrawNumber(width)}" height="${formatExcalidrawNumber(height)}" fill="${escapeAttribute(scene.backgroundColor)}"/>`,
    );
  }
  for (const [index, element] of visible.entries()) {
    if (index % 64 === 0) {
      throwIfAborted(signal);
    }
    builder.append(renderExcalidrawElement(element));
  }
  builder.append('</svg>');
  throwIfAborted(signal);
  return builder.toString();
}

function renderEmptyScene(backgroundColor: string): string {
  const background =
    backgroundColor === 'transparent'
      ? ''
      : `<rect width="240" height="48" fill="${escapeAttribute(backgroundColor)}"/>`;
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="48" viewBox="0 0 240 48">',
    '<title>Пустая сцена Excalidraw</title>',
    background,
    '<text x="120" y="16" text-anchor="middle" dominant-baseline="text-before-edge" font-family="sans-serif" font-size="14" fill="#64748b">Пустая сцена Excalidraw</text>',
    '</svg>',
  ].join('');
}

function emptyBounds(): ExcalidrawBounds {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

function mergeBounds(target: ExcalidrawBounds, source: ExcalidrawBounds): void {
  target.minX = Math.min(target.minX, source.minX);
  target.minY = Math.min(target.minY, source.minY);
  target.maxX = Math.max(target.maxX, source.maxX);
  target.maxY = Math.max(target.maxY, source.maxY);
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new Error('diagram rendering was aborted');
  }
}

class SvgBuilder {
  private readonly fragments: string[] = [];
  private byteLength = 0;

  append(fragment: string): void {
    this.byteLength += Buffer.byteLength(fragment, 'utf8');
    if (this.byteLength > MAX_EXCALIDRAW_SVG_BYTES) {
      throw new Error(
        `Excalidraw SVG is too large: exceeds the ${MAX_EXCALIDRAW_SVG_BYTES} byte limit`,
      );
    }
    this.fragments.push(fragment);
  }

  toString(): string {
    return this.fragments.join('');
  }
}
