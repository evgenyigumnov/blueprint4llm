import { layoutDrawioGraph, type DrawioBox, type DrawioLayoutCell } from './drawio-layout.js';
import type { DrawioGraph } from './drawio-json.js';

const MAX_DRAWIO_SVG_BYTES = 4 * 1024 * 1024;
const NODE_RADIUS = 8;
const TEXT_LINE_HEIGHT = 20;

/** Converts the normalized draw.io graph into a self-contained, safe SVG. */
export function renderDrawioSvg(graph: DrawioGraph): string {
  const layout = layoutDrawioGraph(graph);
  const edgeMarkup = layout.edges
    .map(({ cell, labelLines, source, target }, index) =>
      renderEdge(cell.id, labelLines, source, target, index, graph.direction),
    )
    .join('');
  const cellMarkup = layout.cells.map(renderCell).join('');
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg"',
    ` width="${formatNumber(layout.width)}" height="${formatNumber(layout.height)}"`,
    ` viewBox="0 0 ${formatNumber(layout.width)} ${formatNumber(layout.height)}">`,
    `<title>${escapeXml(graph.pageName)}</title>`,
    '<defs><marker id="drawio-arrow" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,4 L0,8 z" fill="#64748b"/></marker></defs>',
    `<g class="drawio-edges">${edgeMarkup}</g>`,
    `<g class="drawio-cells">${cellMarkup}</g>`,
    '</svg>',
  ].join('');

  const byteLength = Buffer.byteLength(svg, 'utf8');
  if (byteLength > MAX_DRAWIO_SVG_BYTES) {
    throw new Error(
      `draw.io SVG is too large: ${byteLength} bytes (limit ${MAX_DRAWIO_SVG_BYTES} bytes)`,
    );
  }
  return svg;
}

function renderCell(cell: DrawioLayoutCell): string {
  const { x, y, width, height } = cell;
  if (cell.cell.type === 'group') {
    const header = renderGroupLabel(cell, x + 20, y + 13);
    const children = cell.children.map(renderCell).join('');
    return [
      '<g class="drawio-group">',
      `<title>${escapeXml(cell.cell.label)}</title>`,
      `<rect x="${formatNumber(x)}" y="${formatNumber(y)}" width="${formatNumber(width)}" height="${formatNumber(height)}" rx="10" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="6 4"/>`,
      header,
      children,
      '</g>',
    ].join('');
  }

  return [
    '<g class="drawio-node">',
    `<title>${escapeXml(cell.cell.label)}</title>`,
    `<rect x="${formatNumber(x)}" y="${formatNumber(y)}" width="${formatNumber(width)}" height="${formatNumber(height)}" rx="${NODE_RADIUS}" fill="#ffffff" stroke="#2563eb" stroke-width="1.8"/>`,
    renderCenteredText(cell, x + width / 2, y + height / 2, '#0f172a', 14),
    '</g>',
  ].join('');
}

function renderGroupLabel(cell: DrawioLayoutCell, x: number, y: number): string {
  return [
    `<text x="${formatNumber(x)}" y="${formatNumber(y)}" fill="#334155" font-family="system-ui, sans-serif" font-size="13" font-weight="600" dominant-baseline="hanging">`,
    cell.labelLines
      .map(
        (line, index) =>
          `<tspan x="${formatNumber(x)}" dy="${index === 0 ? '0' : formatNumber(TEXT_LINE_HEIGHT)}">${escapeXml(line)}</tspan>`,
      )
      .join(''),
    '</text>',
  ].join('');
}

function renderCenteredText(
  cell: DrawioLayoutCell,
  x: number,
  y: number,
  color: string,
  fontSize: number,
): string {
  const firstDy = -((cell.labelLines.length - 1) * TEXT_LINE_HEIGHT) / 2;
  return [
    `<text x="${formatNumber(x)}" y="${formatNumber(y)}" fill="${color}" font-family="system-ui, sans-serif" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle">`,
    cell.labelLines
      .map(
        (line, index) =>
          `<tspan x="${formatNumber(x)}" dy="${index === 0 ? formatNumber(firstDy) : formatNumber(TEXT_LINE_HEIGHT)}">${escapeXml(line)}</tspan>`,
      )
      .join(''),
    '</text>',
  ].join('');
}

function renderEdge(
  id: string,
  labelLines: string[],
  source: DrawioBox,
  target: DrawioBox,
  index: number,
  direction: DrawioGraph['direction'],
): string {
  const path = edgePath(source, target, index, direction);
  const labelMarkup = labelLines.every((line) => line.length === 0)
    ? ''
    : renderEdgeLabel(labelLines, path.labelX, path.labelY);
  return [
    '<g class="drawio-edge">',
    `<title>${escapeXml(labelLines.join(' ') || id)}</title>`,
    `<path d="${path.d}" fill="none" stroke="#64748b" stroke-width="1.6" marker-end="url(#drawio-arrow)"/>`,
    labelMarkup,
    '</g>',
  ].join('');
}

function edgePath(
  source: DrawioBox,
  target: DrawioBox,
  index: number,
  direction: DrawioGraph['direction'],
): { d: string; labelX: number; labelY: number } {
  const sourceCenter = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  if (source.x === target.x && source.y === target.y) {
    const start = { x: source.x + source.width, y: source.y + source.height * 0.35 };
    const end = { x: source.x + source.width, y: source.y + source.height * 0.65 };
    const outerX = source.x + source.width + 42;
    const outerY = source.y + source.height / 2;
    return {
      d: `M${formatPoint(start)} C${formatPoint({ x: outerX, y: start.y - 24 })} ${formatPoint({ x: outerX, y: end.y + 24 })} ${formatPoint(end)}`,
      labelX: outerX + 4,
      labelY: outerY,
    };
  }

  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  const start = rectBoundary(source, dx, dy);
  const end = rectBoundary(target, -dx, -dy);
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const along = direction === 'TB' ? dy : dx;
  const across = direction === 'TB' ? dx : dy;
  const bendsBack = along < 0;
  const staysOnRank = Math.abs(along) < Math.abs(across) * 0.55;
  const bend =
    bendsBack || staysOnRank
      ? (index % 2 === 0 ? 1 : -1) * Math.min(64, Math.max(32, distance * 0.18))
      : 0;
  const perpendicularLength = distance === 0 ? 1 : distance;
  const perpendicular = { x: -dy / perpendicularLength, y: dx / perpendicularLength };
  const firstControl = {
    x: start.x + (end.x - start.x) / 3 + perpendicular.x * bend,
    y: start.y + (end.y - start.y) / 3 + perpendicular.y * bend,
  };
  const secondControl = {
    x: start.x + ((end.x - start.x) * 2) / 3 + perpendicular.x * bend,
    y: start.y + ((end.y - start.y) * 2) / 3 + perpendicular.y * bend,
  };
  const labelX = start.x * 0.125 + firstControl.x * 0.375 + secondControl.x * 0.375 + end.x * 0.125;
  const labelY =
    start.y * 0.125 + firstControl.y * 0.375 + secondControl.y * 0.375 + end.y * 0.125 - 7;
  return {
    d: `M${formatPoint(start)} C${formatPoint(firstControl)} ${formatPoint(secondControl)} ${formatPoint(end)}`,
    labelX,
    labelY,
  };
}

function rectBoundary(box: DrawioBox, dx: number, dy: number): { x: number; y: number } {
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const scale = Math.max(Math.abs(dx) / (box.width / 2), Math.abs(dy) / (box.height / 2));
  if (scale === 0) {
    return { x: centerX, y: centerY };
  }
  return { x: centerX + dx / scale, y: centerY + dy / scale };
}

function renderEdgeLabel(lines: string[], x: number, y: number): string {
  const lineHeight = 16;
  const firstDy = -((lines.length - 1) * lineHeight) / 2;
  return [
    `<text x="${formatNumber(x)}" y="${formatNumber(y)}" fill="#334155" font-family="system-ui, sans-serif" font-size="12" text-anchor="middle" dominant-baseline="middle">`,
    lines
      .map(
        (line, index) =>
          `<tspan x="${formatNumber(x)}" dy="${index === 0 ? formatNumber(firstDy) : formatNumber(lineHeight)}">${escapeXml(line)}</tspan>`,
      )
      .join(''),
    '</text>',
  ].join('');
}

function formatPoint(point: { x: number; y: number }): string {
  return `${formatNumber(point.x)},${formatNumber(point.y)}`;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error('draw.io layout produced a non-finite coordinate');
  }
  return String(Math.round(value * 100) / 100);
}

function escapeXml(value: string): string {
  let result = '';
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    const isXmlCharacter =
      codePoint === 0x9 ||
      codePoint === 0xa ||
      codePoint === 0xd ||
      (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
      (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
      (codePoint >= 0x10000 && codePoint <= 0x10ffff);
    const safeCharacter = isXmlCharacter ? character : '\uFFFD';
    if (safeCharacter === '&') {
      result += '&amp;';
    } else if (safeCharacter === '<') {
      result += '&lt;';
    } else if (safeCharacter === '>') {
      result += '&gt;';
    } else if (safeCharacter === '"') {
      result += '&quot;';
    } else if (safeCharacter === "'") {
      result += '&apos;';
    } else {
      result += safeCharacter;
    }
  }
  return result;
}
