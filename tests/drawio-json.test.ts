import { describe, expect, it } from 'vitest';

import {
  MAX_DRAWIO_JSON_BYTES,
  MAX_DRAWIO_JSON_CELLS,
  MAX_DRAWIO_JSON_PAGES,
  parseDrawioJson,
} from '../src/renderers/drawio-json.js';

describe('parseDrawioJson', () => {
  it('normalizes a single page and keeps only safe graph fields', () => {
    const graph = parseDrawioJson(
      JSON.stringify({
        version: '26.0',
        data: '<mxfile>not parsed</mxfile>',
        pages: [
          {
            id: 'page-1',
            name: 'Release flow',
            cells: [
              { id: 'layer-1', type: 'layer' },
              { id: 'group-1', type: 'group', parent: 'layer-1', label: 'Deployment' },
              {
                id: 'start',
                type: 'node',
                parent: 'group-1',
                label: 'Start <safe>',
                html: '<script>alert(1)</script>',
                metadata: { ignored: true },
              },
              { id: 'finish', type: 'node', parent: 'layer-1' },
              {
                id: 'edge-1',
                type: 'edge',
                parent: 'layer-1',
                source: 'start',
                target: 'finish',
                label: 'deploy',
                html: '<b>ignored</b>',
              },
            ],
          },
        ],
      }),
    );

    expect(graph).toEqual({
      version: '26.0',
      pageId: 'page-1',
      pageName: 'Release flow',
      direction: 'TB',
      cells: [
        { id: 'layer-1', type: 'layer', label: '' },
        { id: 'group-1', type: 'group', parent: 'layer-1', label: 'Deployment' },
        { id: 'start', type: 'node', parent: 'group-1', label: 'Start <safe>' },
        { id: 'finish', type: 'node', parent: 'layer-1', label: 'finish' },
        {
          id: 'edge-1',
          type: 'edge',
          parent: 'layer-1',
          source: 'start',
          target: 'finish',
          label: 'deploy',
        },
      ],
    });
  });

  it('selects a requested page and reads the layout direction', () => {
    const source = JSON.stringify({
      version: '26.0',
      pages: [
        { id: 'first', cells: [] },
        { id: 'second', name: 'Selected', cells: [] },
      ],
    });

    expect(() => parseDrawioJson(source)).toThrow('set page=<id> to select one');
    expect(parseDrawioJson(source, 'page=second direction=LR')).toEqual({
      version: '26.0',
      pageId: 'second',
      pageName: 'Selected',
      direction: 'LR',
      cells: [],
    });
    expect(() => parseDrawioJson(source, 'page=missing')).toThrow('page "missing" was not found');
  });

  it.each([
    ['invalid JSON', '{', 'invalid draw.io JSON'],
    ['non-object root', '[]', 'draw.io JSON must be an object'],
    ['missing version', JSON.stringify({ pages: [] }), 'non-empty string version'],
    ['empty pages', JSON.stringify({ version: '1', pages: [] }), 'non-empty pages array'],
    [
      'invalid page',
      stringify({ version: '1', pages: [null] }),
      'page at index 1 must be an object',
    ],
    [
      'empty page id',
      stringify({ version: '1', pages: [{ id: ' ', cells: [] }] }),
      'page at index 1 id',
    ],
    [
      'duplicate page ids',
      stringify({
        version: '1',
        pages: [
          { id: 'p', cells: [] },
          { id: 'p', cells: [] },
        ],
      }),
      'duplicate page id',
    ],
    [
      'invalid page name',
      stringify({ version: '1', pages: [{ id: 'p', name: 4, cells: [] }] }),
      'name must be a string',
    ],
    ['missing cells', stringify({ version: '1', pages: [{ id: 'p' }] }), 'cells must be an array'],
    [
      'invalid cell',
      stringify({ version: '1', pages: [{ id: 'p', cells: [null] }] }),
      'cell at index 1 must be an object',
    ],
    [
      'empty cell id',
      stringify({
        version: '1',
        pages: [{ id: 'p', cells: [{ id: ' ', type: 'node', parent: 'layer' }] }],
      }),
      'cell id must be a non-empty string',
    ],
    [
      'duplicate cell ids',
      stringify({
        version: '1',
        pages: [
          {
            id: 'p',
            cells: [
              { id: 'n', type: 'node', parent: 'l' },
              { id: 'n', type: 'node', parent: 'l' },
            ],
          },
        ],
      }),
      'duplicate cell id',
    ],
    [
      'unknown type',
      stringify({ version: '1', pages: [{ id: 'p', cells: [{ id: 'n', type: 'unknown' }] }] }),
      'unsupported type',
    ],
    [
      'invalid label',
      stringify({
        version: '1',
        pages: [{ id: 'p', cells: [{ id: 'n', type: 'node', parent: 'l', label: 7 }] }],
      }),
      'label must be a string',
    ],
    [
      'missing parent',
      stringify({ version: '1', pages: [{ id: 'p', cells: [{ id: 'n', type: 'node' }] }] }),
      'must have a parent id',
    ],
    [
      'missing edge source',
      stringify({
        version: '1',
        pages: [{ id: 'p', cells: [{ id: 'e', type: 'edge', parent: 'l', target: 'n' }] }],
      }),
      'edge "e" source',
    ],
    [
      'missing edge target',
      stringify({
        version: '1',
        pages: [{ id: 'p', cells: [{ id: 'e', type: 'edge', parent: 'l', source: 'n' }] }],
      }),
      'edge "e" target',
    ],
  ])('rejects %s', (_caseName, source, expectedError) => {
    expect(() => parseDrawioJson(source)).toThrow(expectedError);
  });

  it.each([
    [
      'parent',
      [{ id: 'node-1', type: 'node', parent: 'missing' }],
      'references missing parent "missing"',
    ],
    [
      'edge source',
      [
        { id: 'layer-1', type: 'layer' },
        { id: 'edge-1', type: 'edge', parent: 'layer-1', source: 'missing', target: 'missing' },
      ],
      'references missing source "missing"',
    ],
    [
      'edge target',
      [
        { id: 'layer-1', type: 'layer' },
        { id: 'node-1', type: 'node', parent: 'layer-1' },
        { id: 'edge-1', type: 'edge', parent: 'layer-1', source: 'node-1', target: 'missing' },
      ],
      'references missing target "missing"',
    ],
    [
      'non-node endpoint',
      [
        { id: 'layer-1', type: 'layer' },
        { id: 'edge-1', type: 'edge', parent: 'layer-1', source: 'layer-1', target: 'layer-1' },
      ],
      'source "layer-1" must be a node or group',
    ],
    [
      'parent cycle',
      [
        { id: 'group-a', type: 'group', parent: 'group-b' },
        { id: 'group-b', type: 'group', parent: 'group-a' },
      ],
      'contains a parent cycle',
    ],
  ])('rejects invalid %s references', (_caseName, cells, expectedError) => {
    expect(() => parseDrawioJson(stringify({ version: '1', pages: [{ id: 'p', cells }] }))).toThrow(
      expectedError,
    );
  });

  it.each([
    ['duplicate page option', 'page=one page=two', 'only one page=<id> option'],
    ['empty page option', 'page=', 'page option must use the form page=<id>'],
    [
      'duplicate direction option',
      'direction=TB direction=LR',
      'only one direction=<TB|LR> option',
    ],
    ['invalid direction option', 'direction=BT', 'direction must be TB or LR'],
  ])('rejects %s', (_caseName, metadata, expectedError) => {
    const source = stringify({ version: '1', pages: [{ id: 'p', cells: [] }] });
    expect(() => parseDrawioJson(source, metadata)).toThrow(expectedError);
  });

  it('enforces the source, page, and cell limits', () => {
    expect(() => parseDrawioJson(' '.repeat(MAX_DRAWIO_JSON_BYTES + 1))).toThrow(
      'draw.io JSON is too large',
    );

    const tooManyPages = Array.from({ length: MAX_DRAWIO_JSON_PAGES + 1 }, (_, index) => ({
      id: `page-${index}`,
      cells: [],
    }));
    expect(() => parseDrawioJson(stringify({ version: '1', pages: tooManyPages }))).toThrow(
      'too many pages',
    );

    const tooManyCells = Array.from({ length: MAX_DRAWIO_JSON_CELLS + 1 }, (_, index) => ({
      id: `layer-${index}`,
      type: 'layer',
    }));
    expect(() =>
      parseDrawioJson(stringify({ version: '1', pages: [{ id: 'p', cells: tooManyCells }] })),
    ).toThrow('too many cells');
  });
});

function stringify(value: unknown): string {
  return JSON.stringify(value);
}
