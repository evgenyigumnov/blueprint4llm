import { OpenApiError } from './openapi-error.js';
import type {
  ApiDocument,
  ApiLayoutBox,
  ApiLayoutText,
  ApiSchema,
  OpenApiValue,
} from './openapi-types.js';

export const OPENAPI_SVG_WIDTH = 1_200;
export const OPENAPI_SVG_MAX_HEIGHT = 16_384;
export const OPENAPI_LAYOUT_MAX_LINES = 5_000;

const SIDE_PADDING = 28;
const TEXT_WIDTH = OPENAPI_SVG_WIDTH - SIDE_PADDING * 2;

export interface OpenApiLayout {
  width: number;
  height: number;
  boxes: ApiLayoutBox[];
  texts: ApiLayoutText[];
}

/** Lays out all API data in source order and fails when the complete document cannot fit. */
export function layoutOpenApiDocument(document: ApiDocument): OpenApiLayout {
  const layout = new LayoutBuilder(document.positions);
  layout.header(document);
  if (document.operations.length > 0) {
    layout.section('Operations');
    for (const operation of document.operations) {
      layout.card(`${operation.method} ${operation.path}`, operation.pointer, () => {
        layout.optionalField('Summary', operation.summary);
        layout.optionalField('Description', operation.description);
        layout.optionalField('Operation ID', operation.operationId);
        layout.optionalField(
          'Tags',
          operation.tags.length === 0 ? undefined : operation.tags.join(', '),
        );
        if (operation.deprecated) layout.field('Deprecated', 'Yes');
        if (operation.parameters.length > 0) {
          layout.subheading('Parameters');
          for (const parameter of operation.parameters) {
            const required = parameter.required ? ', required' : '';
            layout.field(
              `${parameter.name} (${parameter.in}${required})`,
              parameter.schema === undefined ? 'content' : schemaSummary(parameter.schema),
              parameter.pointer,
            );
            layout.optionalField('Description', parameter.description, parameter.pointer, 1);
            for (const media of parameter.content) {
              layout.field(
                `Content ${media.mediaType}`,
                media.schema ? schemaSummary(media.schema) : 'schema not specified',
                media.pointer,
                1,
              );
            }
          }
        }
        if (operation.requestBody !== undefined) {
          const body = operation.requestBody;
          layout.subheading(`Request body${body.required ? ' (required)' : ''}`, body.pointer);
          layout.optionalField('Description', body.description, body.pointer);
          for (const media of body.content) {
            layout.field(
              `Content ${media.mediaType}`,
              media.schema ? schemaSummary(media.schema) : 'schema not specified',
              media.pointer,
            );
            if (media.schema !== undefined) layout.schemaDetails(media.schema, 'Schema', 1);
          }
        }
        if (operation.responses.length > 0) {
          layout.subheading('Responses');
          for (const response of operation.responses) {
            layout.field(response.status, response.description, response.pointer);
            for (const media of response.content) {
              layout.field(
                `Content ${media.mediaType}`,
                media.schema ? schemaSummary(media.schema) : 'schema not specified',
                media.pointer,
                1,
              );
              if (media.schema !== undefined) layout.schemaDetails(media.schema, 'Schema', 2);
            }
            for (const header of response.headers) {
              const required = header.required ? ', required' : '';
              layout.field(
                `Header ${header.name}${required}`,
                header.schema ? schemaSummary(header.schema) : 'content',
                header.pointer,
                1,
              );
              layout.optionalField('Description', header.description, header.pointer, 2);
            }
          }
        }
      });
    }
  }
  if (document.schemas.length > 0) {
    layout.section('Models');
    for (const namedSchema of document.schemas) {
      layout.card(namedSchema.name, namedSchema.pointer, () => {
        layout.schemaDetails(namedSchema.schema, 'Schema', 0);
      });
    }
  }
  if (document.operations.length === 0 && document.schemas.length === 0) {
    layout.line('No paths or models are defined.', 15, SIDE_PADDING, '#334155', '#');
  }
  const summaries = [...new Set(document.warnings.map((warning) => warning.summary))];
  if (summaries.length > 0) {
    layout.section('Not shown');
    layout.line(`Not shown: ${summaries.join(', ')}`, 13, SIDE_PADDING, '#475569', '#');
  }
  return layout.finish();
}

class LayoutBuilder {
  private y = 28;
  private lineCount = 0;
  private lastPointer = '#';
  private readonly boxes: ApiLayoutBox[] = [];
  private readonly texts: ApiLayoutText[] = [];

  constructor(private readonly positions: ApiDocument['positions']) {}

  header(document: ApiDocument): void {
    this.wrapped(document.title, 26, SIDE_PADDING, '#172554', true, '#');
    this.wrapped(
      `Version ${document.version} · OpenAPI 3.1.1`,
      15,
      SIDE_PADDING,
      '#475569',
      false,
      '#',
    );
    this.optionalField('Description', document.description, '#', 0, 14);
    this.y += 8;
  }

  section(text: string): void {
    this.y += 13;
    this.wrapped(text, 20, SIDE_PADDING, '#172554', true, '#');
    this.y += 3;
  }

  card(title: string, pointer: string, content: () => void): void {
    const top = this.y;
    const contentTop = top + 16;
    this.y = contentTop;
    this.wrapped(title, 17, SIDE_PADDING + 14, '#1e3a8a', true, pointer);
    content();
    this.y += 15;
    const height = Math.max(48, this.y - top);
    this.boxes.push({
      x: SIDE_PADDING,
      y: top,
      width: TEXT_WIDTH,
      height,
      fill: '#f8fafc',
      stroke: '#cbd5e1',
    });
    this.y += 12;
  }

  subheading(text: string, pointer = '#'): void {
    this.y += 4;
    this.wrapped(text, 14, SIDE_PADDING + 14, '#334155', true, pointer);
  }

  field(label: string, value: string, pointer = '#', indent = 0, fontSize = 13): void {
    this.wrapped(
      `${label}: ${value}`,
      fontSize,
      SIDE_PADDING + 14 + Math.min(indent, 6) * 12,
      '#334155',
      false,
      pointer,
    );
  }

  optionalField(
    label: string,
    value: string | undefined,
    pointer = '#',
    indent = 0,
    fontSize = 13,
  ): void {
    if (value !== undefined && value.length > 0) {
      this.field(label, value, pointer, indent, fontSize);
    }
  }

  schemaDetails(schema: ApiSchema, label: string, indent: number): void {
    if (schema.booleanSchema !== undefined) {
      this.field(
        label,
        schema.booleanSchema ? 'true (allows any value)' : 'false (allows no value)',
        schema.pointer,
        indent,
      );
      return;
    }
    if (schema.ref !== undefined) {
      this.field('$ref', referenceLabel(schema.ref), schema.pointer, indent);
    }
    if (schema.type !== undefined)
      this.field(
        `${label} type`,
        Array.isArray(schema.type) ? schema.type.join(' | ') : schema.type,
        schema.pointer,
        indent,
      );
    if (schema.format !== undefined) this.field('Format', schema.format, schema.pointer, indent);
    if (schema.description !== undefined)
      this.field('Description', schema.description, schema.pointer, indent);
    if (schema.enum !== undefined)
      this.field('Enum', schema.enum.map(formatValue).join(', '), schema.pointer, indent);
    if (schema.readOnly) this.field('Read only', 'Yes', schema.pointer, indent);
    if (schema.writeOnly) this.field('Write only', 'Yes', schema.pointer, indent);
    if (schema.properties.length > 0) {
      for (const property of schema.properties) {
        const required = schema.required.includes(property.name) ? ' (required)' : '';
        this.field(
          `Property ${property.name}${required}`,
          schemaSummary(property.schema),
          property.pointer,
          indent,
        );
        this.schemaDetails(property.schema, 'Details', indent + 1);
      }
    } else if (schema.required.length > 0) {
      this.field('Required', schema.required.join(', '), schema.pointer, indent);
    }
    if (schema.items !== undefined)
      this.field('Items', schemaSummary(schema.items), schema.items.pointer, indent);
    if (schema.additionalProperties !== undefined) {
      this.field(
        'Additional properties',
        typeof schema.additionalProperties === 'boolean'
          ? String(schema.additionalProperties)
          : schemaSummary(schema.additionalProperties),
        schema.pointer,
        indent,
      );
    }
    for (const composition of schema.compositions) {
      composition.schemas.forEach((variant, index) => {
        this.field(
          `${composition.kind}[${index + 1}]`,
          schemaSummary(variant),
          variant.pointer,
          indent,
        );
        this.schemaDetails(variant, 'Details', indent + 1);
      });
    }
  }

  line(text: string, fontSize: number, x: number, color: string, pointer: string): void {
    this.wrapped(text, fontSize, x, color, false, pointer);
  }

  finish(): OpenApiLayout {
    const height = Math.ceil(this.y + 24);
    if (height > OPENAPI_SVG_MAX_HEIGHT) {
      throw new OpenApiError(
        `OpenAPI layout height exceeds limit: ${height} px (limit ${OPENAPI_SVG_MAX_HEIGHT} px)`,
        this.errorOptions(this.lastPointer),
      );
    }
    return { width: OPENAPI_SVG_WIDTH, height, boxes: this.boxes, texts: this.texts };
  }

  private wrapped(
    text: string,
    fontSize: number,
    x: number,
    color: string,
    bold: boolean,
    pointer: string,
  ): void {
    const availableWidth = OPENAPI_SVG_WIDTH - x - SIDE_PADDING;
    this.lastPointer = pointer;
    for (const line of wrapText(text, availableWidth, fontSize)) {
      this.lineCount += 1;
      if (this.lineCount > OPENAPI_LAYOUT_MAX_LINES) {
        throw new OpenApiError(
          `OpenAPI layout line limit exceeded: ${this.lineCount} (limit ${OPENAPI_LAYOUT_MAX_LINES})`,
          this.errorOptions(pointer),
        );
      }
      this.y += fontSize * 1.5;
      this.texts.push({
        x,
        y: this.y,
        fontSize,
        color,
        text: line,
        ...(bold ? { weight: 700 } : {}),
      });
    }
  }

  private errorOptions(pointer: string) {
    const position = this.positions.get(pointer) ?? this.positions.get('#');
    return {
      pointer,
      ...(position === undefined ? {} : { line: position.line, column: position.column }),
    };
  }
}

function schemaSummary(schema: ApiSchema): string {
  if (schema.booleanSchema !== undefined) return String(schema.booleanSchema);
  const parts: string[] = [];
  if (schema.ref !== undefined) parts.push(referenceLabel(schema.ref));
  if (schema.type !== undefined)
    parts.push(Array.isArray(schema.type) ? schema.type.join(' | ') : schema.type);
  if (schema.format !== undefined) parts.push(`format ${schema.format}`);
  if (schema.enum !== undefined) parts.push(`enum ${schema.enum.map(formatValue).join(' | ')}`);
  if (schema.compositions.length > 0)
    parts.push(schema.compositions.map((item) => item.kind).join(', '));
  return parts.length === 0 ? 'schema' : parts.join('; ');
}

function referenceLabel(reference: NonNullable<ApiSchema['ref']>): string {
  return reference.targetName === undefined
    ? reference.targetPointer
    : `${reference.targetName} (${reference.targetPointer})`;
}

function formatValue(value: OpenApiValue): string {
  if (value instanceof Map) {
    const entries = [...value.entries()].map(
      ([key, item]) => `${JSON.stringify(key)}:${formatValue(item)}`,
    );
    return `{${entries.join(',')}}`;
  }
  if (Array.isArray(value)) return `[${value.map(formatValue).join(',')}]`;
  return typeof value === 'string' ? JSON.stringify(value) : String(value);
}

function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const paragraphs = text.split(/\r\n|\r|\n/u);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of paragraph.split(/\s+/u)) {
      if (measureText(word, fontSize) > maxWidth) {
        if (current.length > 0) {
          lines.push(current);
        }
        let chunk = '';
        for (const character of Array.from(word)) {
          if (chunk.length > 0 && measureText(chunk + character, fontSize) > maxWidth) {
            lines.push(chunk);
            chunk = character;
          } else {
            chunk += character;
          }
        }
        current = chunk;
      } else if (current.length === 0) {
        current = word;
      } else if (measureText(`${current} ${word}`, fontSize) <= maxWidth) {
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

function measureText(text: string, fontSize: number): number {
  let units = 0;
  for (const character of Array.from(text)) {
    if (/\s/u.test(character)) units += 0.34;
    else if (/[MW@#%&]/u.test(character)) units += 0.82;
    else if (
      /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Extended_Pictographic}]/u.test(
        character,
      )
    )
      units += 1;
    else units += 0.62;
  }
  return units * fontSize;
}
