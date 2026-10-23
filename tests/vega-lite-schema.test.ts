import { describe, expect, it, vi } from 'vitest';

import { parseVegaLiteSource } from '../src/renderers/vega-lite-source.js';
import {
  validateVegaLiteSchema,
  VEGA_LITE_SCHEMA_SHA256,
} from '../src/renderers/vega-lite-schema.js';

describe('Vega-Lite local v6 schema', () => {
  it('accepts a v6-compatible specification without a schema URL', async () => {
    const parsed = parseVegaLiteSource(
      JSON.stringify({
        data: { values: [{ category: 'A', value: 1 }] },
        mark: 'bar',
        encoding: {
          x: { field: 'category', type: 'nominal' },
          y: { field: 'value', type: 'quantitative' },
        },
      }),
    );
    await expect(validateVegaLiteSchema(parsed.value, parsed.positions)).resolves.toMatchObject({
      vegaLiteVersion: '6.5.0',
      vegaVersion: '6.4.0',
      schemaHash: VEGA_LITE_SCHEMA_SHA256,
    });
  });

  it('reports schema fields at their JSON Pointer source location', async () => {
    const source =
      '{\n  "mark": "bar",\n  "encoding": { "x": { "field": 5, "type": "nominal" } }\n}';
    const parsed = parseVegaLiteSource(source);
    try {
      await validateVegaLiteSchema(parsed.value, parsed.positions);
      throw new Error('expected schema validation failure');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'VegaLiteError',
        line: 3,
        column: 24,
        pointer: '/encoding/x/field',
      });
      expect(error).toHaveProperty('message', expect.stringContaining('/encoding/x/field'));
    }
  });

  it('uses the parent object position for a required field that has no source token', async () => {
    const source = '{"data":{"values":[]}}';
    const parsed = parseVegaLiteSource(source);
    await expect(validateVegaLiteSchema(parsed.value, parsed.positions)).rejects.toMatchObject({
      name: 'VegaLiteError',
      pointer: '/mark',
      line: 1,
      column: 1,
    });
  });

  it('validates package-local schema references without logging warnings', async () => {
    const logger = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const parsed = parseVegaLiteSource('{"data":{"values":[]},"mark":"point"}');
      await validateVegaLiteSchema(parsed.value, parsed.positions);
      expect(logger).not.toHaveBeenCalled();
    } finally {
      logger.mockRestore();
    }
  });
});
