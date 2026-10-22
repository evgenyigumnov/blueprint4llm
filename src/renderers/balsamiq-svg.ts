import type { BalsamiqControl, BalsamiqMockup, BalsamiqTextAlign } from './balsamiq-json.js';
import { MAX_BALSAMIQ_CANVAS_SIDE } from './balsamiq-json.js';

const MAX_BALSAMIQ_SVG_BYTES = 4 * 1024 * 1024;
const TEXT_COLOR = '#1f2937';
const BORDER_COLOR = '#64748b';
const LIGHT_BORDER_COLOR = '#94a3b8';
const BUTTON_FILL = '#e2e8f0';

/** Converts normalized Balsamiq controls into a bounded, self-contained SVG. */
export function renderBalsamiqSvg(mockup: BalsamiqMockup): string {
  if (mockup.width > MAX_BALSAMIQ_CANVAS_SIDE || mockup.height > MAX_BALSAMIQ_CANVAS_SIDE) {
    throw new Error(
      `Balsamiq SVG is too large: ${formatNumber(mockup.width)} × ${formatNumber(mockup.height)} px (limit ${MAX_BALSAMIQ_CANVAS_SIDE} px per side)`,
    );
  }

  const background = mockup.canvas?.properties.color ?? '#ffffff';
  const controls = mockup.controls.map(renderControl).join('');
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg"',
    ` width="${formatNumber(mockup.width)}" height="${formatNumber(mockup.height)}"`,
    ` viewBox="0 0 ${formatNumber(mockup.width)} ${formatNumber(mockup.height)}">`,
    '<title>Balsamiq mockup</title>',
    `<rect class="balsamiq-canvas" x="0" y="0" width="${formatNumber(mockup.width)}" height="${formatNumber(mockup.height)}" fill="${background}"/>`,
    controls,
    '</svg>',
  ].join('');
  const byteLength = Buffer.byteLength(svg, 'utf8');
  if (byteLength > MAX_BALSAMIQ_SVG_BYTES) {
    throw new Error(
      `Balsamiq SVG is too large: ${byteLength} bytes (limit ${MAX_BALSAMIQ_SVG_BYTES} bytes)`,
    );
  }
  return svg;
}

function renderControl(control: BalsamiqControl): string {
  const { properties, x, y, width, height } = control;
  let body: string;
  switch (control.type) {
    case 'Label':
    case 'Title':
    case 'SubTitle':
    case 'Paragraph':
      body = renderLabel(control);
      break;
    case 'TextInput':
      body = renderTextInput(control, false);
      break;
    case 'TextArea':
      body = renderTextInput(control, true);
      break;
    case 'Button':
      body = renderButton(control);
      break;
    case 'CheckBox':
      body = renderChoice(control, 'checkbox');
      break;
    case 'RadioButton':
      body = renderChoice(control, 'radio');
      break;
    case 'ComboBox':
      body = renderComboBox(control);
      break;
    case 'List':
      body = renderList(control);
      break;
    case 'Rectangle':
      body = renderRectangle(control);
      break;
    case 'Line':
      body = `<line x1="${formatNumber(x)}" y1="${formatNumber(y)}" x2="${formatNumber(x + width)}" y2="${formatNumber(y + height)}" stroke="${properties.color ?? BORDER_COLOR}" stroke-width="2"/>`;
      break;
    case 'Canvas':
      // Canvas is rendered once as the mockup background.
      body = '';
      break;
  }

  if (control.type === 'Canvas') {
    return '';
  }
  return `<g class="balsamiq-control balsamiq-control--${control.type.toLowerCase()}" data-control-id="${escapeXmlAttribute(control.id)}"><title>${escapeXml(control.id)}</title>${body}</g>`;
}

function renderLabel(control: BalsamiqControl): string {
  const { properties, type, x, y, width, height } = control;
  const fontSize = properties.fontSize ?? defaultFontSize(type);
  const color = properties.color ?? TEXT_COLOR;
  const weight = properties.bold || type === 'Title' ? '700' : '400';
  const style = properties.italic ? 'italic' : 'normal';
  const lineHeight = fontSize * 1.25;
  const lines = wrapText(properties.text ?? '', width, fontSize);
  const visibleLines = fitLines(lines, height, lineHeight);
  const textAnchor = anchor(properties.align ?? 'left');
  const textX = alignedX(x, width, properties.align ?? 'left');
  const textY = y + Math.max(0, (height - visibleLines.length * lineHeight) / 2);
  return renderText(visibleLines, textX, textY, {
    fontSize,
    lineHeight,
    color,
    weight,
    style,
    anchor: textAnchor,
  });
}

function renderTextInput(control: BalsamiqControl, multiline: boolean): string {
  const { properties, x, y, width, height } = control;
  const fontSize = properties.fontSize ?? 14;
  const lineHeight = fontSize * 1.25;
  const padding = 8;
  const maxTextWidth = Math.max(1, width - padding * 2);
  const lines = wrapText(properties.text ?? '', maxTextWidth, fontSize);
  const visibleLines = fitLines(lines, Math.max(lineHeight, height - padding * 2), lineHeight);
  const top = multiline
    ? y + padding
    : y + Math.max(padding, (height - visibleLines.length * lineHeight) / 2);
  return [
    `<rect x="${formatNumber(x)}" y="${formatNumber(y)}" width="${formatNumber(width)}" height="${formatNumber(height)}" rx="3" fill="#ffffff" stroke="${LIGHT_BORDER_COLOR}" stroke-width="1.5"/>`,
    renderText(visibleLines, x + padding, top, {
      fontSize,
      lineHeight,
      color: properties.color ?? TEXT_COLOR,
      weight: properties.bold ? '700' : '400',
      style: properties.italic ? 'italic' : 'normal',
      anchor: 'start',
    }),
  ].join('');
}

function renderButton(control: BalsamiqControl): string {
  const { properties, x, y, width, height } = control;
  const fontSize = properties.fontSize ?? 14;
  const lineHeight = fontSize * 1.25;
  const lines = fitLines(wrapText(properties.text ?? '', width - 16, fontSize), height, lineHeight);
  const top = y + Math.max(0, (height - lines.length * lineHeight) / 2);
  return [
    `<rect x="${formatNumber(x)}" y="${formatNumber(y)}" width="${formatNumber(width)}" height="${formatNumber(height)}" rx="4" fill="${properties.color ?? BUTTON_FILL}" stroke="${BORDER_COLOR}" stroke-width="1.5"/>`,
    renderText(lines, x + width / 2, top, {
      fontSize,
      lineHeight,
      color: '#111827',
      weight: properties.bold ? '700' : '500',
      style: properties.italic ? 'italic' : 'normal',
      anchor: 'middle',
    }),
  ].join('');
}

function renderChoice(control: BalsamiqControl, kind: 'checkbox' | 'radio'): string {
  const { properties, x, y, width, height } = control;
  const size = Math.min(16, Math.max(10, height - 4));
  const markX = x + 2;
  const markY = y + (height - size) / 2;
  const checked = properties.checked === true || properties.selected === true;
  const mark =
    kind === 'checkbox'
      ? `<rect x="${formatNumber(markX)}" y="${formatNumber(markY)}" width="${formatNumber(size)}" height="${formatNumber(size)}" rx="2" fill="#ffffff" stroke="${BORDER_COLOR}" stroke-width="1.5"/>${checked ? `<path d="M${formatNumber(markX + size * 0.2)} ${formatNumber(markY + size * 0.52)} l${formatNumber(size * 0.22)} ${formatNumber(size * 0.22)} l${formatNumber(size * 0.42)} ${formatNumber(-size * 0.48)}" fill="none" stroke="#2563eb" stroke-width="2"/>` : ''}`
      : `<circle cx="${formatNumber(markX + size / 2)}" cy="${formatNumber(markY + size / 2)}" r="${formatNumber(size / 2)}" fill="#ffffff" stroke="${BORDER_COLOR}" stroke-width="1.5"/>${checked ? `<circle cx="${formatNumber(markX + size / 2)}" cy="${formatNumber(markY + size / 2)}" r="${formatNumber(size * 0.23)}" fill="#2563eb"/>` : ''}`;
  const fontSize = properties.fontSize ?? 14;
  const label = wrapText(properties.text ?? '', Math.max(1, width - size - 12), fontSize);
  return `${mark}${renderText(
    fitLines(label, height, fontSize * 1.25),
    markX + size + 6,
    y + (height - fontSize) / 2,
    {
      fontSize,
      lineHeight: fontSize * 1.25,
      color: properties.color ?? TEXT_COLOR,
      weight: properties.bold ? '700' : '400',
      style: properties.italic ? 'italic' : 'normal',
      anchor: 'start',
    },
  )}`;
}

function renderComboBox(control: BalsamiqControl): string {
  const { properties, x, y, width, height } = control;
  const fontSize = properties.fontSize ?? 14;
  const padding = 8;
  const arrowWidth = Math.min(26, width * 0.2);
  const textWidth = Math.max(1, width - padding * 2 - arrowWidth);
  const lines = fitLines(
    wrapText(properties.text ?? '', textWidth, fontSize),
    height,
    fontSize * 1.25,
  );
  const textY = y + Math.max(0, (height - lines.length * fontSize * 1.25) / 2);
  const arrowX = x + width - arrowWidth;
  return [
    `<rect x="${formatNumber(x)}" y="${formatNumber(y)}" width="${formatNumber(width)}" height="${formatNumber(height)}" rx="3" fill="#ffffff" stroke="${LIGHT_BORDER_COLOR}" stroke-width="1.5"/>`,
    `<path d="M${formatNumber(arrowX)} ${formatNumber(y + 1)} V${formatNumber(y + height - 1)} M${formatNumber(arrowX + arrowWidth / 2 - 5)} ${formatNumber(y + height / 2 - 2)} l5 5 l5 -5" fill="none" stroke="${BORDER_COLOR}" stroke-width="1.5"/>`,
    renderText(lines, x + padding, textY, {
      fontSize,
      lineHeight: fontSize * 1.25,
      color: properties.color ?? TEXT_COLOR,
      weight: properties.bold ? '700' : '400',
      style: properties.italic ? 'italic' : 'normal',
      anchor: 'start',
    }),
  ].join('');
}

function renderList(control: BalsamiqControl): string {
  const { properties, x, y, width, height } = control;
  const fontSize = properties.fontSize ?? 13;
  const lineHeight = Math.max(16, fontSize * 1.35);
  const padding = 7;
  const rowCapacity = Math.max(1, Math.floor((height - padding * 2) / lineHeight));
  const entries = (properties.text ?? '').replace(/\r\n?/g, '\n').split('\n').slice(0, rowCapacity);
  const rows = entries.map((entry, index) => {
    const rowY = y + padding + index * lineHeight;
    const text = wrapText(entry, width - padding * 2, fontSize).slice(0, 1);
    return [
      index > 0
        ? `<line x1="${formatNumber(x + 1)}" y1="${formatNumber(rowY - padding / 2)}" x2="${formatNumber(x + width - 1)}" y2="${formatNumber(rowY - padding / 2)}" stroke="#e2e8f0" stroke-width="1"/>`
        : '',
      renderText(text, x + padding, rowY, {
        fontSize,
        lineHeight,
        color: properties.color ?? TEXT_COLOR,
        weight: properties.bold ? '700' : '400',
        style: properties.italic ? 'italic' : 'normal',
        anchor: 'start',
      }),
    ].join('');
  });
  return `<rect x="${formatNumber(x)}" y="${formatNumber(y)}" width="${formatNumber(width)}" height="${formatNumber(height)}" fill="#ffffff" stroke="${LIGHT_BORDER_COLOR}" stroke-width="1.5"/>${rows.join('')}`;
}

function renderRectangle(control: BalsamiqControl): string {
  const { properties, x, y, width, height } = control;
  const shape = `<rect x="${formatNumber(x)}" y="${formatNumber(y)}" width="${formatNumber(width)}" height="${formatNumber(height)}" fill="${properties.color ?? '#f8fafc'}" stroke="${BORDER_COLOR}" stroke-width="1.5"/>`;
  if (properties.text === undefined) {
    return shape;
  }
  const fontSize = properties.fontSize ?? 14;
  const lineHeight = fontSize * 1.25;
  const lines = fitLines(wrapText(properties.text, width - 16, fontSize), height, lineHeight);
  const top = y + Math.max(4, (height - lines.length * lineHeight) / 2);
  return (
    shape +
    renderText(lines, x + width / 2, top, {
      fontSize,
      lineHeight,
      color: TEXT_COLOR,
      weight: properties.bold ? '700' : '400',
      style: properties.italic ? 'italic' : 'normal',
      anchor: 'middle',
    })
  );
}

function renderText(
  lines: string[],
  x: number,
  y: number,
  style: {
    fontSize: number;
    lineHeight: number;
    color: string;
    weight: string;
    style: string;
    anchor: 'start' | 'middle' | 'end';
  },
): string {
  const tspans = lines
    .map(
      (line, index) =>
        `<tspan x="${formatNumber(x)}" dy="${index === 0 ? '0' : formatNumber(style.lineHeight)}">${escapeXml(line)}</tspan>`,
    )
    .join('');
  return `<text x="${formatNumber(x)}" y="${formatNumber(y)}" fill="${style.color}" font-family="Arial, sans-serif" font-size="${formatNumber(style.fontSize)}" font-weight="${style.weight}" font-style="${style.style}" text-anchor="${style.anchor}" dominant-baseline="hanging">${tspans}</text>`;
}

function wrapText(text: string, width: number, fontSize: number): string[] {
  const maxCharacters = Math.max(1, Math.floor(width / (fontSize * 0.56)));
  const result: string[] = [];
  for (const sourceLine of text.replace(/\r\n?/g, '\n').split('\n')) {
    const words = sourceLine.split(/\s+/).filter((word) => word !== '');
    if (words.length === 0) {
      result.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const next = line === '' ? word : `${line} ${word}`;
      if (line !== '' && next.length > maxCharacters) {
        result.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    result.push(line);
  }
  return result;
}

function fitLines(lines: string[], height: number, lineHeight: number): string[] {
  return lines.slice(0, Math.max(1, Math.floor(height / lineHeight)));
}

function defaultFontSize(type: BalsamiqControl['type']): number {
  switch (type) {
    case 'Title':
      return 22;
    case 'SubTitle':
      return 18;
    case 'Paragraph':
      return 14;
    default:
      return 14;
  }
}

function anchor(align: BalsamiqTextAlign): 'start' | 'middle' | 'end' {
  if (align === 'center') {
    return 'middle';
  }
  return align === 'right' ? 'end' : 'start';
}

function alignedX(x: number, width: number, align: BalsamiqTextAlign): number {
  if (align === 'center') {
    return x + width / 2;
  }
  return align === 'right' ? x + width : x;
}

function formatNumber(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function escapeXmlAttribute(value: string): string {
  return escapeXml(value).replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}
