import { OpenApiLayoutBuilder } from './openapi-layout-builder.js';
import { layoutOperations } from './openapi-layout-operations.js';
import { layoutSchemaDetails } from './openapi-layout-schema.js';
import type { ApiDocument, ApiNamedSchema } from './openapi-types.js';
import type { OpenApiLayout } from './openapi-layout-builder.js';

export {
  OPENAPI_LAYOUT_MAX_LINES,
  OPENAPI_SVG_MAX_HEIGHT,
  OPENAPI_SVG_WIDTH,
} from './openapi-layout-builder.js';
export type { OpenApiLayout } from './openapi-layout-builder.js';

/** Lays out every operation and schema as an expanded, styled API reference. */
export function layoutOpenApiDocument(document: ApiDocument): OpenApiLayout {
  const layout = new OpenApiLayoutBuilder(document.positions);
  layout.header(document);
  if (document.operations.length > 0) {
    layout.section('Operations', document.operations.length);
    layoutOperations(layout, document.operations);
  }
  if (document.schemas.length > 0) {
    layout.section('Models', document.schemas.length);
    for (const schema of document.schemas) layoutNamedSchema(layout, schema);
  }
  if (document.operations.length === 0 && document.schemas.length === 0) {
    layout.y += layout.text('No paths or models are defined.', 32, layout.y, layout.contentWidth, {
      fontSize: 15,
      color: '#334155',
      pointer: '#',
    });
  }
  const summaries = [...new Set(document.warnings.map((warning) => warning.summary))];
  if (summaries.length > 0) {
    layout.section('Not shown', summaries.length);
    layout.text(`Not shown: ${summaries.join(', ')}`, 32, layout.y, layout.contentWidth, {
      fontSize: 13,
      color: '#475569',
      pointer: '#',
    });
    layout.y += 20;
  }
  return layout.finish();
}

function layoutNamedSchema(layout: OpenApiLayoutBuilder, namedSchema: ApiNamedSchema): void {
  const left = 32;
  const padding = 16;
  const width = layout.contentWidth;
  const top = layout.y;
  const frame = layout.box(left, top, width, 0, '#ffffff', '#cbd5e1', 9);
  layout.box(left + 1, top + 1, width - 2, 43, '#eef2ff', undefined, 8);
  layout.text(namedSchema.name, left + padding, top + 9, width - padding * 2, {
    fontSize: 16,
    color: '#1e3a8a',
    weight: 700,
    pointer: namedSchema.pointer,
  });
  const propertyCount = namedSchema.schema.properties.length;
  layout.pill(
    `${propertyCount} ${propertyCount === 1 ? 'property' : 'properties'}`,
    left + width - 132,
    top + 10,
    116,
    '#dbeafe',
    '#1e40af',
    {
      fontSize: 10,
      height: 22,
      pointer: namedSchema.pointer,
    },
  );
  layout.y = top + 44 + padding;
  layoutSchemaDetails(layout, namedSchema.schema, 'Schema', 0, {
    x: left + padding,
    width: width - padding * 2,
  });
  layout.y += 9;
  layout.setBoxHeight(frame, layout.y - top + 4);
  layout.y += 15;
}
