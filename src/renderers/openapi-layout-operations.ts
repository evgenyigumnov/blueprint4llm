import type { OpenApiLayoutBuilder } from './openapi-layout-builder.js';
import { layoutSchemaDetails } from './openapi-layout-schema.js';
import type { ApiMediaType, ApiOperation, ApiParameter, ApiResponse } from './openapi-types.js';

const LEFT = 32;
const CARD_WIDTH = 1_136;

const METHOD_STYLES: Record<string, { solid: string; tint: string }> = {
  GET: { solid: '#2563eb', tint: '#eff6ff' },
  POST: { solid: '#059669', tint: '#ecfdf5' },
  PUT: { solid: '#d97706', tint: '#fffbeb' },
  PATCH: { solid: '#0d9488', tint: '#f0fdfa' },
  DELETE: { solid: '#dc2626', tint: '#fef2f2' },
  OPTIONS: { solid: '#7c3aed', tint: '#f5f3ff' },
  HEAD: { solid: '#64748b', tint: '#f1f5f9' },
  TRACE: { solid: '#475569', tint: '#f1f5f9' },
};

export function layoutOperations(builder: OpenApiLayoutBuilder, operations: ApiOperation[]): void {
  for (const operation of operations) layoutOperation(builder, operation);
}

function layoutOperation(builder: OpenApiLayoutBuilder, operation: ApiOperation): void {
  const top = builder.y;
  const style = METHOD_STYLES[operation.method] ?? METHOD_STYLES.GET!;
  const frame = builder.box(LEFT, top, CARD_WIDTH, 0, '#ffffff', '#cbd5e1', 9);
  const header = builder.box(LEFT + 1, top + 1, CARD_WIDTH - 2, 0, style.tint, undefined, 8);
  builder.pill(operation.method, LEFT + 16, top + 15, 76, style.solid, '#ffffff', {
    fontSize: 11,
    height: 25,
    pointer: operation.pointer,
  });
  const textX = LEFT + 108;
  const textWidth = CARD_WIDTH - 128;
  let rowY = top + 12;
  const pathHeight = builder.text(operation.path, textX, rowY, textWidth, {
    fontSize: 18,
    color: '#0f172a',
    weight: 700,
    family: 'mono',
    pointer: operation.pointer,
    lineHeight: 24,
  });
  rowY += pathHeight + 1;
  if (operation.summary !== undefined) {
    rowY += builder.text(operation.summary, textX, rowY, textWidth, {
      fontSize: 13,
      color: '#475569',
      pointer: operation.pointer,
    });
  }
  const metadata = [
    ...(operation.operationId === undefined ? [] : [`ID ${operation.operationId}`]),
    ...(operation.tags.length === 0 ? [] : [`Tags ${operation.tags.join(', ')}`]),
    ...(operation.deprecated ? ['Deprecated'] : []),
  ];
  if (metadata.length > 0) {
    rowY += builder.text(metadata.join('  ·  '), textX, rowY + 2, textWidth, {
      fontSize: 11,
      color: operation.deprecated ? '#b45309' : '#64748b',
      weight: operation.deprecated ? 700 : 400,
      pointer: operation.pointer,
    });
  }
  const headerHeight = Math.max(57, rowY - top + 11);
  builder.setBoxHeight(header, headerHeight);
  builder.y = top + headerHeight + 9;

  if (operation.description !== undefined) {
    subsection(builder, 'Description', operation.pointer);
    const height = builder.text(operation.description, LEFT + 22, builder.y, CARD_WIDTH - 44, {
      fontSize: 13,
      color: '#334155',
      pointer: operation.pointer,
    });
    builder.y += height + 8;
  }
  if (operation.parameters.length > 0) {
    subsection(builder, 'Parameters', operation.pointer, operation.parameters.length);
    for (const parameter of operation.parameters) layoutParameter(builder, parameter);
  }
  if (operation.requestBody !== undefined) {
    subsection(
      builder,
      `Request body${operation.requestBody.required ? ' · required' : ''}`,
      operation.requestBody.pointer,
      operation.requestBody.content.length,
    );
    if (operation.requestBody.description !== undefined) {
      builder.y += builder.text(
        operation.requestBody.description,
        LEFT + 22,
        builder.y,
        CARD_WIDTH - 44,
        { fontSize: 12, color: '#475569', pointer: operation.requestBody.pointer },
      );
      builder.y += 3;
    }
    for (const media of operation.requestBody.content) layoutMediaType(builder, media, 1);
  }
  if (operation.responses.length > 0) {
    subsection(builder, 'Responses', operation.pointer, operation.responses.length);
    for (const response of operation.responses) layoutResponse(builder, response);
  }
  builder.y += 6;
  builder.setBoxHeight(frame, builder.y - top + 7);
  builder.y += 15;
}

function layoutParameter(builder: OpenApiLayoutBuilder, parameter: ApiParameter): void {
  const x = LEFT + 10;
  const top = builder.y;
  const width = CARD_WIDTH - 20;
  const frame = builder.box(x, top, width, 0, '#ffffff', '#e2e8f0', 6);
  const headingHeight = builder.text(parameter.name, x + 12, top + 9, width - 250, {
    fontSize: 13,
    color: '#0f172a',
    weight: 700,
    family: 'mono',
    pointer: parameter.pointer,
  });
  const tagsY = top + 8;
  builder.pill(parameter.in.toUpperCase(), x + width - 190, tagsY, 72, '#e0f2fe', '#0369a1', {
    fontSize: 10,
    height: 21,
    pointer: parameter.pointer,
  });
  if (parameter.required) {
    builder.pill('required', x + width - 108, tagsY, 78, '#fef3c7', '#92400e', {
      fontSize: 10,
      height: 21,
      pointer: parameter.pointer,
    });
  }
  builder.y = top + Math.max(34, headingHeight + 17);
  if (parameter.description !== undefined) {
    builder.y += builder.text(parameter.description, x + 12, builder.y, width - 24, {
      fontSize: 12,
      color: '#475569',
      pointer: parameter.pointer,
    });
  }
  if (parameter.schema !== undefined) {
    layoutSchemaDetails(builder, parameter.schema, 'Schema', 1);
  }
  for (const media of parameter.content) layoutMediaType(builder, media, 1);
  builder.y += 8;
  builder.setBoxHeight(frame, Math.max(42, builder.y - top));
  builder.y += 7;
}

function layoutResponse(builder: OpenApiLayoutBuilder, response: ApiResponse): void {
  const x = LEFT + 10;
  const top = builder.y;
  const width = CARD_WIDTH - 20;
  const frame = builder.box(x, top, width, 0, '#ffffff', '#e2e8f0', 6);
  const statusStyle = statusColors(response.status);
  builder.pill(
    response.status.toUpperCase(),
    x + 12,
    top + 9,
    58,
    statusStyle.fill,
    statusStyle.color,
    {
      fontSize: 10,
      height: 22,
      pointer: response.pointer,
      stroke: statusStyle.stroke,
    },
  );
  const descriptionHeight = builder.text(response.description, x + 84, top + 8, width - 98, {
    fontSize: 13,
    color: '#334155',
    pointer: response.pointer,
  });
  builder.y = top + Math.max(38, descriptionHeight + 16);
  for (const media of response.content) layoutMediaType(builder, media, 2);
  for (const header of response.headers) layoutHeader(builder, header);
  builder.y += 8;
  builder.setBoxHeight(frame, Math.max(42, builder.y - top));
  builder.y += 7;
}

function layoutHeader(builder: OpenApiLayoutBuilder, header: ApiParameter): void {
  const x = LEFT + 30;
  const top = builder.y;
  const width = CARD_WIDTH - 60;
  const frame = builder.box(x, top, width, 0, '#f8fafc', '#e2e8f0', 5);
  const required = header.required ? ' · required' : '';
  const height = builder.text(`Header ${header.name}${required}`, x + 10, top + 7, width - 20, {
    fontSize: 12,
    color: '#334155',
    weight: 700,
    pointer: header.pointer,
  });
  builder.y = top + height + 13;
  if (header.description !== undefined) {
    builder.y += builder.text(header.description, x + 10, builder.y, width - 20, {
      fontSize: 11,
      color: '#64748b',
      pointer: header.pointer,
    });
  }
  if (header.schema !== undefined) layoutSchemaDetails(builder, header.schema, 'Schema', 2);
  for (const media of header.content) layoutMediaType(builder, media, 2);
  builder.setBoxHeight(frame, Math.max(38, builder.y - top + 8));
  builder.y += 6;
}

function layoutMediaType(builder: OpenApiLayoutBuilder, media: ApiMediaType, indent: number): void {
  const x = LEFT + 20 + indent * 10;
  const width = CARD_WIDTH - (x - LEFT) - 18;
  builder.pill(media.mediaType, x, builder.y, 180, '#f1f5f9', '#334155', {
    fontSize: 10,
    height: 21,
    pointer: media.pointer,
    stroke: '#e2e8f0',
  });
  builder.y += 26;
  if (media.schema !== undefined) layoutSchemaDetails(builder, media.schema, 'Schema', indent + 1);
  else {
    builder.y += builder.text('Schema not specified', x + 10, builder.y, width - 20, {
      fontSize: 11,
      color: '#64748b',
      pointer: media.pointer,
    });
  }
}

function subsection(
  builder: OpenApiLayoutBuilder,
  title: string,
  pointer: string,
  count?: number,
): void {
  const x = LEFT + 10;
  const top = builder.y;
  builder.box(x, top, CARD_WIDTH - 20, 28, '#f1f5f9', undefined, 5);
  builder.text(title, x + 11, top + 5, CARD_WIDTH - 52, {
    fontSize: 12,
    color: '#334155',
    weight: 700,
    pointer,
  });
  if (count !== undefined) {
    builder.pill(String(count), x + CARD_WIDTH - 62, top + 4, 30, '#e2e8f0', '#475569', {
      fontSize: 10,
      height: 20,
      pointer,
    });
  }
  builder.y += 36;
}

function statusColors(status: string): { fill: string; color: string; stroke: string } {
  if (status.startsWith('2')) return { fill: '#dcfce7', color: '#166534', stroke: '#bbf7d0' };
  if (status.startsWith('3')) return { fill: '#dbeafe', color: '#1d4ed8', stroke: '#bfdbfe' };
  if (status.startsWith('4')) return { fill: '#fef3c7', color: '#92400e', stroke: '#fde68a' };
  if (status.startsWith('5')) return { fill: '#fee2e2', color: '#b91c1c', stroke: '#fecaca' };
  return { fill: '#e2e8f0', color: '#334155', stroke: '#cbd5e1' };
}
