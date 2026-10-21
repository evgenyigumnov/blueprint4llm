import { describe, expect, it, vi } from 'vitest';

import { checkMarkdown, compileMarkdown } from '../src/compiler.js';
import { parseAndValidateSvg } from '../src/svg/parse-and-validate.js';
import {
  MAX_FIGMA_JSON_BYTES,
  MAX_FIGMA_JSON_DEPTH,
  MAX_FIGMA_JSON_NODES,
  parseAndSelectFigmaFrame,
} from '../src/renderers/figma-json.js';
import { classifyFigmaSource, figmaRenderer } from '../src/renderers/figma.js';

describe('Figma source dispatch', () => {
  it('classifies JSON and HTTPS URL sources', () => {
    expect(classifyFigmaSource('  {"document":{}}')).toBe('json');
    expect(classifyFigmaSource('\nhttps://www.figma.com/design/file/frame')).toBe('url');
    expect(() => classifyFigmaSource('file.fig')).toThrow(
      'Figma source must be a JSON object or an HTTPS Figma URL',
    );
  });

  it('requires a token before making a URL-mode network request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    vi.stubEnv('FIGMA_ACCESS_TOKEN', '');
    try {
      await expect(
        figmaRenderer.render('https://www.figma.com/design/file/frame?node-id=12-34', {
          diagramId: 'bp-diagram-001',
          sourceFile: 'figma.md',
          line: 1,
        }),
      ).rejects.toThrow('FIGMA_ACCESS_TOKEN is required');
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});

describe('Figma JSON validation and frame selection', () => {
  it('selects the only top-level frame by default', () => {
    const frame = parseAndSelectFigmaFrame(makeResponse([makeFrame('12:34', 'Profile')]));
    expect(frame).toMatchObject({ id: '12:34', name: 'Profile', type: 'FRAME' });
  });

  it('selects a requested frame from metadata when the document has multiple frames', () => {
    const response = makeResponse([makeFrame('12:34', 'Profile'), makeFrame('12:35', 'Settings')]);

    expect(parseAndSelectFigmaFrame(response, 'scale=1 node=12:35').name).toBe('Settings');
  });

  it('requires an explicit frame when none or several are at the top level', () => {
    expect(() => parseAndSelectFigmaFrame(makeResponse([]))).toThrow(
      'Figma JSON has no top-level frame; set node=<id> to select a frame',
    );
    expect(() =>
      parseAndSelectFigmaFrame(
        makeResponse([makeFrame('12:34', 'Profile'), makeFrame('12:35', 'Settings')]),
      ),
    ).toThrow('Figma JSON has 2 top-level frames; set node=<id> to select one');
  });

  it('rejects malformed JSON and a response without a DOCUMENT root', () => {
    expect(() => parseAndSelectFigmaFrame('{broken')).toThrow('invalid Figma JSON');
    expect(() => parseAndSelectFigmaFrame('{"document":{"id":"0:0","type":"CANVAS"}}')).toThrow(
      'Figma document root must have type DOCUMENT',
    );
    expect(() => parseAndSelectFigmaFrame('{"name":"test"}')).toThrow(
      'Figma JSON must contain a document object',
    );
  });

  it('validates node fields and finite, non-negative frame dimensions', () => {
    const badChild = makeResponse([makeFrame('12:34', 'Profile')]).replace(
      '"type":"FRAME"',
      '"type":4',
    );
    expect(() => parseAndSelectFigmaFrame(badChild)).toThrow(
      'Figma node "12:34" must have a non-empty string type',
    );

    const badBounds = makeFrame('12:34', 'Profile', { x: 0, y: 0, width: -1, height: 50 });
    expect(() => parseAndSelectFigmaFrame(makeResponse([badBounds]))).toThrow(
      'Figma node "12:34" has invalid absoluteBoundingBox coordinates',
    );
    const zeroBounds = makeFrame('12:34', 'Profile', { x: 0, y: 0, width: 0, height: 50 });
    expect(() => parseAndSelectFigmaFrame(makeResponse([zeroBounds]))).toThrow(
      'Figma frame "12:34" has an empty absoluteBoundingBox',
    );
  });

  it('validates node metadata and selected node type', () => {
    const response = makeResponse([
      makeFrame('12:34', 'Profile', undefined, [{ id: '12:36', name: 'Title', type: 'TEXT' }]),
    ]);

    expect(() => parseAndSelectFigmaFrame(response, 'node=bad')).toThrow(
      'Figma metadata node option must use the form node=<number>:<number>',
    );
    expect(() => parseAndSelectFigmaFrame(response, 'node=12:99')).toThrow(
      'Figma node "12:99" was not found',
    );
    expect(() => parseAndSelectFigmaFrame(response, 'node=12:36')).toThrow(
      'Figma node "12:36" is not a frame, component, or instance',
    );
    expect(() => parseAndSelectFigmaFrame(response, 'node=12:34 node=12:36')).toThrow(
      'Figma metadata must contain only one node=<id> option',
    );
  });

  it('limits JSON bytes, node count, and nesting depth', () => {
    expect(() => parseAndSelectFigmaFrame(' '.repeat(MAX_FIGMA_JSON_BYTES + 1))).toThrow(
      `Figma JSON is too large: ${MAX_FIGMA_JSON_BYTES + 1} bytes`,
    );

    const manyChildren = Array.from({ length: MAX_FIGMA_JSON_NODES }, (_, index) => ({
      id: `20:${index}`,
      name: 'Layer',
      type: 'RECTANGLE',
    }));
    expect(() =>
      parseAndSelectFigmaFrame(
        makeResponse([makeFrame('12:34', 'Profile', undefined, manyChildren)]),
      ),
    ).toThrow(`Figma JSON has too many nodes (limit ${MAX_FIGMA_JSON_NODES})`);

    let deepNode: Record<string, unknown> = { id: '99:1', name: 'Leaf', type: 'RECTANGLE' };
    for (let depth = 1; depth < MAX_FIGMA_JSON_DEPTH; depth += 1) {
      deepNode = { id: `99:${depth + 1}`, name: 'Layer', type: 'GROUP', children: [deepNode] };
    }
    const tooDeep = makeResponse([makeFrame('12:34', 'Profile', undefined, [deepNode])]);
    expect(() => parseAndSelectFigmaFrame(tooDeep)).toThrow(
      `Figma JSON is nested too deeply (limit ${MAX_FIGMA_JSON_DEPTH} levels)`,
    );
  });

  it('passes fenced metadata into the Figma renderer and compiles offline', async () => {
    const response = makeResponse([
      makeFrame('12:34', 'Profile'),
      makeFrame('12:35', 'Account settings'),
    ]);
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    let compiled: Awaited<ReturnType<typeof compileMarkdown>>;
    try {
      compiled = await compileMarkdown(`\`\`\`figma node=12:35\n${response}\n\`\`\``, {
        sourceFile: 'figma.md',
      });
    } finally {
      vi.unstubAllGlobals();
    }

    expect(fetch).not.toHaveBeenCalled();
    expect(compiled.html).toContain('class="bp-diagram bp-diagram--figma"');
    expect(compiled.html).toContain('<title>Account settings</title>');
    expect(compiled.html).toContain('viewBox="0 0 360 640"');
    expect(compiled.warnings).toEqual([]);
  });

  it('checks local Figma JSON without making a network request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    let result: Awaited<ReturnType<typeof checkMarkdown>>;
    try {
      result = await checkMarkdown(
        ['```figma', makeResponse([makeFrame('12:34', 'Profile')]), '```'].join('\n'),
        { sourceFile: 'figma-check.md' },
      );
    } finally {
      vi.unstubAllGlobals();
    }

    expect(result).toEqual({ warnings: [], errors: [] });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports JSON diagnostics at the Markdown fence without exposing source JSON', async () => {
    const response = JSON.stringify({
      ...JSON.parse(makeResponse([])),
      privateSourceValue: 'JSON_SOURCE_MUST_NOT_APPEAR',
    });

    let diagnostic: unknown;
    try {
      await checkMarkdown(['# Document', '', '```figma', response, '```'].join('\n'), {
        sourceFile: 'bad-figma.md',
      });
    } catch (error) {
      diagnostic = error;
    }

    expect(diagnostic).toMatchObject({
      sourceFile: 'bad-figma.md',
      line: 3,
      message: expect.stringContaining('no top-level frame'),
    });
    expect(String(diagnostic)).not.toContain('JSON_SOURCE_MUST_NOT_APPEAR');
  });

  it('allows Figma JSON up to its format limit through the shared diagram pipeline', async () => {
    const filler = 'x'.repeat(300 * 1024);
    const response = JSON.stringify({
      ...JSON.parse(makeResponse([makeFrame('12:34', 'Profile')])),
      ignored: filler,
    });
    const compiled = await compileMarkdown(`\`\`\`figma\n${response}\n\`\`\``, {
      sourceFile: 'large-figma.json.md',
    });

    expect(compiled.html).toContain('<title>Profile</title>');
  });

  it('renders containers, shapes, solid paints, transforms, rounded corners, text, and paths', async () => {
    const frame = makeFrame('12:34', 'Design', { x: 100, y: 50, width: 400, height: 300 }, [
      {
        id: '12:35',
        name: 'Rounded card',
        type: 'RECTANGLE',
        absoluteBoundingBox: { x: 120, y: 70, width: 80, height: 40 },
        rotation: 45,
        rectangleCornerRadii: [2, 4, 6, 8],
        fills: [solid(0.1, 0.2, 0.3, 0.75, 0.8)],
        strokes: [solid(1, 1, 1)],
        strokeWeight: 2,
        strokeCap: 'ROUND',
      },
      {
        id: '12:36',
        name: 'Avatar',
        type: 'ELLIPSE',
        absoluteBoundingBox: { x: 220, y: 70, width: 40, height: 40 },
        fills: [solid(0.2, 0.6, 0.4)],
      },
      {
        id: '12:37',
        name: 'Divider',
        type: 'LINE',
        absoluteBoundingBox: { x: 120, y: 130, width: 100, height: 0 },
        strokes: [solid(0.3, 0.3, 0.3)],
        strokeWeight: 1,
      },
      {
        id: '12:38',
        name: 'Caption',
        type: 'TEXT',
        absoluteBoundingBox: { x: 120, y: 150, width: 160, height: 48 },
        characters: 'Hello\n<World & friends>',
        style: {
          fontFamily: 'Inter',
          fontSize: 16,
          fontWeight: 600,
          lineHeightPx: 20,
          textAlignHorizontal: 'CENTER',
        },
        fills: [solid(0.1, 0.1, 0.1)],
      },
      {
        id: '12:39',
        name: 'Icon path',
        type: 'VECTOR',
        absoluteBoundingBox: { x: 300, y: 100, width: 20, height: 20 },
        size: { x: 20, y: 20 },
        relativeTransform: [
          [1, 0, 200],
          [0, 1, 80],
        ],
        fillGeometry: [{ path: 'M 0 0 L 20 0 L 20 20 Z', windingRule: 'EVENODD' }],
        fills: [solid(0.8, 0.1, 0.2)],
      },
      {
        id: '12:40',
        name: 'Group',
        type: 'GROUP',
        absoluteBoundingBox: { x: 300, y: 150, width: 50, height: 50 },
        size: { x: 50, y: 50 },
        relativeTransform: [
          [1, 0, 200],
          [0, 1, 100],
        ],
        children: [
          {
            id: '12:41',
            name: 'Grouped rectangle',
            type: 'RECTANGLE',
            absoluteBoundingBox: { x: 310, y: 160, width: 12, height: 14 },
            size: { x: 12, y: 14 },
            relativeTransform: [
              [1, 0, 10],
              [0, 1, 10],
            ],
            fills: [solid(0.4, 0.4, 0.9)],
          },
        ],
      },
    ]);
    const compiled = await compileMarkdown(`\`\`\`figma\n${makeResponse([frame])}\n\`\`\``, {
      sourceFile: 'figma-shapes.md',
    });

    expect(compiled.html).toContain('d="M 22 20 H 96 Q 100 20 100 24');
    expect(compiled.html).toContain('rotate(45 60 40)');
    expect(compiled.html).toContain('fill="#1a334d" fill-opacity="0.6"');
    expect(compiled.html).toContain('stroke="#ffffff"');
    expect(compiled.html).toContain('<ellipse cx="140" cy="40" rx="20" ry="20"');
    expect(compiled.html).toContain('<line x1="20" y1="80" x2="120" y2="80"');
    expect(compiled.html).toContain(
      'font-family="Inter, sans-serif" font-size="16" font-weight="600"',
    );
    expect(compiled.html).toContain('&#x3C;World &#x26; friends>');
    expect(compiled.html).toContain('fill-rule="evenodd"');
    expect(compiled.html).toContain('transform="matrix(1 0 0 1 200 80)"');
    expect(compiled.html).toContain('transform="matrix(1 0 0 1 210 110)"');
    expect(compiled.warnings).toEqual([]);

    const svg = compiled.html.match(/<svg[\s\S]*?<\/svg>/)?.[0];
    expect(svg).toBeDefined();
    expect(() => parseAndValidateSvg(svg!)).not.toThrow();
  });

  it('preserves child order and clips frame children when clipsContent is enabled', async () => {
    const frame = makeFrame('12:34', 'Layer order', undefined, [
      {
        id: '12:35',
        name: 'First',
        type: 'RECTANGLE',
        absoluteBoundingBox: rect(0, 0, 20, 20),
        fills: [solid(1, 0, 0)],
      },
      {
        id: '12:36',
        name: 'Clipped group',
        type: 'FRAME',
        absoluteBoundingBox: rect(10, 10, 40, 40),
        clipsContent: true,
        children: [
          {
            id: '12:37',
            name: 'Second',
            type: 'ELLIPSE',
            absoluteBoundingBox: rect(15, 15, 20, 20),
            fills: [solid(0, 1, 0)],
          },
        ],
      },
      {
        id: '12:38',
        name: 'Last',
        type: 'RECTANGLE',
        absoluteBoundingBox: rect(30, 30, 20, 20),
        fills: [solid(0, 0, 1)],
      },
    ]);
    const compiled = await compileMarkdown(`\`\`\`figma\n${makeResponse([frame])}\n\`\`\``, {
      sourceFile: 'figma-order.md',
    });

    const first = compiled.html.indexOf('fill="#ff0000"');
    const second = compiled.html.indexOf('fill="#00ff00"');
    const last = compiled.html.indexOf('fill="#0000ff"');
    expect(first).toBeGreaterThan(-1);
    expect(first).toBeLessThan(second);
    expect(second).toBeLessThan(last);
    expect(compiled.html).toContain('clip-path="url(#bp-diagram-001-figma-clip-1)"');
  });

  it('reports unsupported node types and paints with the node ID and name', async () => {
    const unsupportedNode = makeFrame('12:34', 'Profile', undefined, [
      { id: '12:90', name: 'Boolean icon', type: 'BOOLEAN_OPERATION' },
    ]);
    await expect(
      compileMarkdown(`\`\`\`figma\n${makeResponse([unsupportedNode])}\n\`\`\``, {
        sourceFile: 'unsupported.md',
      }),
    ).rejects.toThrow(
      'unsupported Figma node type "BOOLEAN_OPERATION" at node "12:90" ("Boolean icon")',
    );

    const unsupportedPaint = makeFrame('12:34', 'Profile', undefined, [
      {
        id: '12:91',
        name: 'Gradient button',
        type: 'RECTANGLE',
        absoluteBoundingBox: rect(0, 0, 20, 20),
        fills: [{ type: 'GRADIENT_LINEAR', visible: true }],
      },
    ]);
    await expect(
      compileMarkdown(`\`\`\`figma\n${makeResponse([unsupportedPaint])}\n\`\`\``, {
        sourceFile: 'unsupported-paint.md',
      }),
    ).rejects.toThrow(
      'unsupported Figma paint type "GRADIENT_LINEAR" at node "12:91" ("Gradient button")',
    );
  });

  it('rejects missing or malformed vector path geometry', async () => {
    const noGeometry = makeFrame('12:34', 'Profile', undefined, [
      {
        id: '12:92',
        name: 'Missing path',
        type: 'VECTOR',
        absoluteBoundingBox: rect(0, 0, 20, 20),
        fills: [solid(0, 0, 0)],
      },
    ]);
    await expect(
      compileMarkdown(`\`\`\`figma\n${makeResponse([noGeometry])}\n\`\`\``, {
        sourceFile: 'vector.md',
      }),
    ).rejects.toThrow(
      'Figma vector "12:92" ("Missing path") has no fillGeometry; request geometry=paths',
    );

    const badPath = makeFrame('12:34', 'Profile', undefined, [
      {
        id: '12:93',
        name: 'Broken path',
        type: 'VECTOR',
        absoluteBoundingBox: rect(0, 0, 20, 20),
        fillGeometry: [{ path: 'M 0 0 L 10 <script>' }],
        fills: [solid(0, 0, 0)],
      },
    ]);
    await expect(
      compileMarkdown(`\`\`\`figma\n${makeResponse([badPath])}\n\`\`\``, {
        sourceFile: 'bad-vector.md',
      }),
    ).rejects.toThrow('Figma node "12:93" ("Broken path") has invalid path 1 in fillGeometry');
  });
});

function makeResponse(frames: Record<string, unknown>[]): string {
  return JSON.stringify({
    name: 'Figma file',
    document: {
      id: '0:0',
      name: 'Document',
      type: 'DOCUMENT',
      children: [
        {
          id: '1:1',
          name: 'Page 1',
          type: 'CANVAS',
          children: frames,
        },
      ],
    },
  });
}

function makeFrame(
  id: string,
  name: string,
  bounds = { x: 0, y: 0, width: 360, height: 640 },
  children: Record<string, unknown>[] = [],
): Record<string, unknown> {
  return {
    id,
    name,
    type: 'FRAME',
    absoluteBoundingBox: bounds,
    children,
  };
}

function solid(
  r: number,
  g: number,
  b: number,
  a?: number,
  opacity?: number,
): Record<string, unknown> {
  return {
    type: 'SOLID',
    color: { r, g, b, ...(a === undefined ? {} : { a }) },
    ...(opacity === undefined ? {} : { opacity }),
  };
}

function rect(x: number, y: number, width: number, height: number): Record<string, number> {
  return { x, y, width, height };
}
