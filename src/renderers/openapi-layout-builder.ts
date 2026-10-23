import { OpenApiError } from './openapi-error.js';
import type { ApiLayoutBox, ApiLayoutText, ApiDocument, OpenApiPosition } from './openapi-types.js';

export const OPENAPI_SVG_WIDTH = 1_200;
export const OPENAPI_SVG_MAX_HEIGHT = 16_384;
export const OPENAPI_LAYOUT_MAX_LINES = 5_000;

const SIDE_PADDING = 32;

export interface OpenApiLayout {
  width: number;
  height: number;
  background?: string;
  boxes: ApiLayoutBox[];
  texts: ApiLayoutText[];
}

export interface OpenApiTextOptions {
  fontSize: number;
  color: string;
  weight?: number;
  family?: 'sans' | 'mono';
  lineHeight?: number;
  pointer?: string;
}

/** Adds styled vector primitives and checks limits while the document is laid out. */
export class OpenApiLayoutBuilder {
  y = 30;
  readonly width = OPENAPI_SVG_WIDTH;
  readonly contentWidth = OPENAPI_SVG_WIDTH - SIDE_PADDING * 2;
  readonly boxes: ApiLayoutBox[] = [];
  readonly texts: ApiLayoutText[] = [];
  private lineCount = 0;
  private lastPointer = '#';

  constructor(private readonly positions: ReadonlyMap<string, OpenApiPosition>) {}

  text(text: string, x: number, y: number, width: number, options: OpenApiTextOptions): number {
    this.lastPointer = options.pointer ?? '#';
    const lines = wrapText(text, width, options.fontSize, options.family === 'mono');
    const lineHeight = options.lineHeight ?? options.fontSize * 1.45;
    for (const [index, line] of lines.entries()) {
      this.lineCount += 1;
      if (this.lineCount > OPENAPI_LAYOUT_MAX_LINES) {
        throw new OpenApiError(
          `OpenAPI layout line limit exceeded: ${this.lineCount} (limit ${OPENAPI_LAYOUT_MAX_LINES})`,
          this.errorOptions(this.lastPointer),
        );
      }
      this.texts.push({
        x,
        y: y + options.fontSize + index * lineHeight,
        fontSize: options.fontSize,
        color: options.color,
        text: line,
        ...(options.weight === undefined ? {} : { weight: options.weight }),
        ...(options.family === undefined ? {} : { family: options.family }),
      });
    }
    return lines.length * lineHeight;
  }

  box(
    x: number,
    y: number,
    width: number,
    height: number,
    fill: string,
    stroke?: string,
    radius = 0,
    strokeWidth = 1,
  ): number {
    const box: ApiLayoutBox = {
      x,
      y,
      width,
      height,
      fill,
      ...(stroke === undefined ? {} : { stroke }),
      ...(radius === 0 ? {} : { radius }),
      ...(strokeWidth === 1 ? {} : { strokeWidth }),
    };
    this.boxes.push(box);
    return this.boxes.length - 1;
  }

  setBoxHeight(index: number, height: number): void {
    const box = this.boxes[index];
    if (box !== undefined) box.height = height;
  }

  rule(x: number, y: number, width: number, color = '#e2e8f0', height = 1): void {
    this.box(x, y, width, height, color);
  }

  pill(
    label: string,
    x: number,
    y: number,
    width: number,
    fill: string,
    color: string,
    options: { fontSize?: number; height?: number; pointer?: string; stroke?: string } = {},
  ): void {
    const fontSize = options.fontSize ?? 11;
    const height = options.height ?? 22;
    this.box(x, y, width, height, fill, options.stroke, height / 2);
    const textWidth = estimateTextWidth(label, fontSize, false);
    this.text(
      label,
      x + Math.max(6, (width - textWidth) / 2),
      y + (height - fontSize * 1.45) / 2,
      width - 8,
      {
        fontSize,
        color,
        weight: 700,
        ...(options.pointer === undefined ? {} : { pointer: options.pointer }),
        lineHeight: fontSize * 1.45,
      },
    );
  }

  section(title: string, count: number): void {
    this.y += 8;
    const top = this.y;
    const titleHeight = this.text(title, SIDE_PADDING, top, 460, {
      fontSize: 21,
      color: '#0f172a',
      weight: 700,
    });
    const countX = SIDE_PADDING + estimateTextWidth(title, 21, false) + 20;
    this.pill(String(count), countX, top + 1, 34, '#e2e8f0', '#334155', {
      fontSize: 11,
      height: 22,
    });
    this.y = top + Math.max(titleHeight, 22) + 10;
    this.rule(SIDE_PADDING, this.y, this.contentWidth, '#dbe3ee');
    this.y += 15;
  }

  header(document: ApiDocument): void {
    const titleHeight = this.text(document.title, SIDE_PADDING, this.y, this.contentWidth, {
      fontSize: 31,
      color: '#172554',
      weight: 700,
    });
    this.y += titleHeight + 4;
    this.pill(
      `v${document.version}`,
      SIDE_PADDING,
      this.y,
      pillWidth(document.version, 11),
      '#e0e7ff',
      '#3730a3',
      {
        fontSize: 11,
        height: 23,
      },
    );
    this.pill(
      'OpenAPI 3.1.1',
      SIDE_PADDING + pillWidth(document.version, 11) + 9,
      this.y,
      102,
      '#dbeafe',
      '#1d4ed8',
      {
        fontSize: 11,
        height: 23,
      },
    );
    this.y += 34;
    if (document.description !== undefined) {
      this.y += this.text(document.description, SIDE_PADDING, this.y, this.contentWidth, {
        fontSize: 15,
        color: '#475569',
        pointer: '#',
      });
      this.y += 4;
    }
    this.rule(SIDE_PADDING, this.y, this.contentWidth, '#dbe3ee');
    this.y += 13;
  }

  finish(): OpenApiLayout {
    const height = Math.ceil(this.y + 28);
    if (height > OPENAPI_SVG_MAX_HEIGHT) {
      throw new OpenApiError(
        `OpenAPI layout height exceeds limit: ${height} px (limit ${OPENAPI_SVG_MAX_HEIGHT} px)`,
        this.errorOptions(this.lastPointer),
      );
    }
    return {
      width: this.width,
      height,
      background: '#f8fafc',
      boxes: this.boxes,
      texts: this.texts,
    };
  }

  private errorOptions(pointer: string) {
    const position = this.positions.get(pointer) ?? this.positions.get('#');
    return {
      pointer,
      ...(position === undefined ? {} : { line: position.line, column: position.column }),
    };
  }
}

function pillWidth(label: string, fontSize: number): number {
  return Math.ceil(estimateTextWidth(label, fontSize, false) + 22);
}

function wrapText(text: string, maxWidth: number, fontSize: number, mono: boolean): string[] {
  const paragraphs = text.split(/\r\n|\r|\n/u);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of paragraph.split(/\s+/u)) {
      if (estimateTextWidth(word, fontSize, mono) > maxWidth) {
        if (current.length > 0) lines.push(current);
        let chunk = '';
        for (const character of Array.from(word)) {
          if (chunk.length > 0 && estimateTextWidth(chunk + character, fontSize, mono) > maxWidth) {
            lines.push(chunk);
            chunk = character;
          } else {
            chunk += character;
          }
        }
        current = chunk;
      } else if (current.length === 0) {
        current = word;
      } else if (estimateTextWidth(`${current} ${word}`, fontSize, mono) <= maxWidth) {
        current += ` ${word}`;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current.length > 0) lines.push(current);
  }
  return lines;
}

export function estimateTextWidth(text: string, fontSize: number, mono: boolean): number {
  let units = 0;
  for (const character of Array.from(text)) {
    if (mono) units += 0.62;
    else if (/\s/u.test(character)) units += 0.34;
    else if (/[MW@#%&]/u.test(character)) units += 0.82;
    else if (
      /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Extended_Pictographic}]/u.test(
        character,
      )
    ) {
      units += 1;
    } else {
      units += 0.62;
    }
  }
  return units * fontSize;
}
