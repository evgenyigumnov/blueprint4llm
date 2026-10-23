import type { OpenApiLayoutBuilder } from './openapi-layout-builder.js';
import type { ApiSchema, OpenApiValue } from './openapi-types.js';

const LEFT = 32;

/** Renders a schema tree as expanded property rows and visible nested constraints. */
export function layoutSchemaDetails(
  builder: OpenApiLayoutBuilder,
  schema: ApiSchema,
  label = 'Schema',
  indent = 0,
  bounds?: { x: number; width: number },
): void {
  const x = bounds?.x ?? LEFT + Math.min(indent, 8) * 20;
  const width = bounds?.width ?? builder.width - x - LEFT;
  builder.text(label, x, builder.y, width, {
    fontSize: 12,
    color: '#64748b',
    weight: 700,
    pointer: schema.pointer,
  });
  builder.y += 20;
  layoutSchemaNode(builder, schema, x, width, indent, false);
}

function layoutSchemaNode(
  builder: OpenApiLayoutBuilder,
  schema: ApiSchema,
  x: number,
  width: number,
  indent: number,
  propertyRow: boolean,
  label?: string,
  required = false,
): void {
  const pointer = schema.pointer;
  const top = builder.y;
  const boxIndex = propertyRow
    ? builder.box(x, top, width, 0, indent % 2 === 0 ? '#ffffff' : '#f8fafc', '#e2e8f0', 6)
    : undefined;
  const padding = propertyRow ? 9 : 0;
  let contentY = top + padding;
  if (propertyRow) {
    const heading = `${label ?? 'Property'}${required ? ' (required)' : ''}`;
    const headingHeight = builder.text(heading, x + 12, contentY, width - 24, {
      fontSize: 13,
      color: '#0f172a',
      weight: 700,
      family: 'mono',
      pointer,
    });
    contentY += headingHeight + 2;
  }

  if (schema.booleanSchema !== undefined) {
    contentY += builder.text(
      schema.booleanSchema ? 'Allows any value' : 'Allows no value',
      x + padding + 12,
      contentY,
      width - padding - 24,
      { fontSize: 12, color: '#475569', pointer },
    );
  } else {
    const summary = schemaSummary(schema);
    contentY += builder.text(summary, x + padding + 12, contentY, width - padding - 24, {
      fontSize: propertyRow ? 12 : 13,
      color: '#0f766e',
      weight: propertyRow ? 400 : 700,
      pointer,
    });
    if (schema.description !== undefined) {
      contentY += builder.text(
        schema.description,
        x + padding + 12,
        contentY + 2,
        width - padding - 24,
        { fontSize: 12, color: '#475569', pointer },
      );
    }
    if (schema.readOnly || schema.writeOnly) {
      const flags = [
        ...(schema.readOnly ? ['read only'] : []),
        ...(schema.writeOnly ? ['write only'] : []),
      ].join(' · ');
      contentY += builder.text(flags, x + padding + 12, contentY + 2, width - padding - 24, {
        fontSize: 11,
        color: '#7c3aed',
        weight: 700,
        pointer,
      });
    }
    if (schema.properties.length === 0 && schema.required.length > 0) {
      contentY += builder.text(
        `Required: ${schema.required.join(', ')}`,
        x + padding + 12,
        contentY + 2,
        width - padding - 24,
        { fontSize: 12, color: '#475569', pointer },
      );
    }
  }

  builder.y = contentY + (propertyRow ? 8 : 0);
  if (schema.properties.length > 0) {
    builder.y += 3;
    builder.text(`Properties · ${schema.properties.length}`, x + 4, builder.y, width - 8, {
      fontSize: 11,
      color: '#64748b',
      weight: 700,
      pointer,
    });
    builder.y += 19;
    for (const property of schema.properties) {
      layoutSchemaNode(
        builder,
        property.schema,
        Math.min(x + 8, builder.width - 180),
        width - Math.min(8, builder.width - x - width),
        indent + 1,
        true,
        property.name,
        schema.required.includes(property.name),
      );
      builder.y += 6;
    }
  }
  if (schema.items !== undefined) {
    builder.y += 2;
    layoutSchemaNode(builder, schema.items, x + 8, width - 8, indent + 1, true, 'Items');
    builder.y += 5;
  }
  if (schema.additionalProperties !== undefined) {
    if (typeof schema.additionalProperties === 'boolean') {
      builder.y += builder.text(
        `Additional properties: ${schema.additionalProperties}`,
        x + 8,
        builder.y,
        width - 16,
        { fontSize: 12, color: '#475569', pointer },
      );
    } else {
      builder.y += 2;
      layoutSchemaNode(
        builder,
        schema.additionalProperties,
        x + 8,
        width - 8,
        indent + 1,
        true,
        'Additional properties',
      );
      builder.y += 5;
    }
  }
  for (const composition of schema.compositions) {
    composition.schemas.forEach((variant, index) => {
      builder.y += 2;
      layoutSchemaNode(
        builder,
        variant,
        x + 8,
        width - 8,
        indent + 1,
        true,
        `${composition.kind} ${index + 1}`,
      );
      builder.y += 5;
    });
  }
  if (boxIndex !== undefined) builder.setBoxHeight(boxIndex, Math.max(42, builder.y - top));
}

export function schemaSummary(schema: ApiSchema): string {
  if (schema.booleanSchema !== undefined) {
    return schema.booleanSchema ? 'true · allows any value' : 'false · allows no value';
  }
  const parts: string[] = [];
  if (schema.ref !== undefined) parts.push(referenceLabel(schema.ref));
  if (schema.type !== undefined)
    parts.push(Array.isArray(schema.type) ? schema.type.join(' | ') : schema.type);
  if (schema.format !== undefined) parts.push(`format ${schema.format}`);
  if (schema.enum !== undefined) parts.push(`enum ${schema.enum.map(formatValue).join(' | ')}`);
  if (schema.compositions.length > 0)
    parts.push(schema.compositions.map((item) => item.kind).join(' · '));
  return parts.length === 0 ? 'schema' : parts.join(' · ');
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
