import type { OpenApiLayout } from './openapi-layout.js';
import { OPENAPI_SVG_MAX_HEIGHT, OPENAPI_SVG_WIDTH } from './openapi-layout.js';
import { OpenApiError } from './openapi-error.js';
import type { OpenApiPosition } from './openapi-types.js';

export const MAX_OPENAPI_SVG_BYTES = 4 * 1024 * 1024;

/** Serializes the measured layout as static, self-contained SVG with escaped text only. */
export function renderOpenApiSvg(
  layout: OpenApiLayout,
  title: string,
  positions?: ReadonlyMap<string, OpenApiPosition>,
): string {
  if (
    !Number.isFinite(layout.width) ||
    !Number.isFinite(layout.height) ||
    layout.width <= 0 ||
    layout.width > OPENAPI_SVG_WIDTH ||
    layout.height <= 0 ||
    layout.height > OPENAPI_SVG_MAX_HEIGHT
  ) {
    throw new OpenApiError(
      `OpenAPI SVG dimensions exceed limits: ${layout.width}×${layout.height} px (maximum ${OPENAPI_SVG_WIDTH}×${OPENAPI_SVG_MAX_HEIGHT} px)`,
      errorOptions('#', positions),
    );
  }

  const elements: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">`,
    `<title>${escapeXml(title)}</title>`,
    `<rect x="0" y="0" width="${layout.width}" height="${layout.height}" fill="${escapeXml(layout.background ?? '#ffffff')}"/>`,
  ];
  for (const box of layout.boxes) {
    const radius = box.radius === undefined ? '' : ` rx="${formatNumber(box.radius)}"`;
    const stroke = box.stroke === undefined ? 'none' : escapeXml(box.stroke);
    const strokeWidth = box.strokeWidth === undefined ? 1 : box.strokeWidth;
    elements.push(
      `<rect x="${formatNumber(box.x)}" y="${formatNumber(box.y)}" width="${formatNumber(box.width)}" height="${formatNumber(box.height)}"${radius} fill="${escapeXml(box.fill)}" stroke="${stroke}" stroke-width="${formatNumber(strokeWidth)}"/>`,
    );
  }
  for (const text of layout.texts) {
    const weight = text.weight === undefined ? '' : ` font-weight="${text.weight}"`;
    const family =
      text.family === 'mono'
        ? 'ui-monospace, SFMono-Regular, Consolas, monospace'
        : 'Noto Sans, Arial, sans-serif';
    elements.push(
      `<text x="${formatNumber(text.x)}" y="${formatNumber(text.y)}" font-family="${escapeXml(family)}" font-size="${formatNumber(text.fontSize)}" fill="${escapeXml(text.color)}"${weight}><tspan x="${formatNumber(text.x)}" dy="0">${escapeXml(text.text)}</tspan></text>`,
    );
  }
  elements.push('</svg>');
  const svg = elements.join('');
  const bytes = Buffer.byteLength(svg, 'utf8');
  if (bytes > MAX_OPENAPI_SVG_BYTES) {
    throw new OpenApiError(
      `OpenAPI SVG is too large: ${bytes} bytes (limit ${MAX_OPENAPI_SVG_BYTES} bytes)`,
      errorOptions('#', positions),
    );
  }
  return svg;
}

function errorOptions(
  pointer: string,
  positions: ReadonlyMap<string, OpenApiPosition> | undefined,
) {
  const position = positions?.get(pointer);
  return {
    pointer,
    ...(position === undefined ? {} : { line: position.line, column: position.column }),
  };
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/u, '').replace(/\.$/u, '');
}
