import { afterEach, describe, expect, it, vi } from 'vitest';

import { checkMarkdown, compileMarkdown } from '../src/compiler.js';
import {
  fetchFigmaSvg,
  FIGMA_REQUEST_TIMEOUT_MS,
  MAX_FIGMA_API_RESPONSE_BYTES,
  MAX_FIGMA_SVG_RESPONSE_BYTES,
} from '../src/renderers/figma-api.js';
import { addSvgSansSerifFallback } from '../src/renderers/figma-fonts.js';
import { FIGMA_URL_CACHE_TTL_MS, figmaRenderer } from '../src/renderers/figma.js';
import { DiagramRenderCache } from '../src/renderers/cache.js';

const FIGMA_LINK = 'https://www.figma.com/design/AbCd1234/Profile?node-id=12-34';
const EXPORTED_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80" viewBox="0 0 240 80"><text x="12" y="32" font-family="Inter" font-size="18">Searchable Figma text</text></svg>';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('Figma API renderer', () => {
  it('keeps Figma font names and adds a generic fallback only when needed', () => {
    expect(
      addSvgSansSerifFallback(
        '<svg><text font-family="Inter"/><text font-family="Inter, Arial"/><text font-family="Inter, sans-serif"/><text font-family="monospace"/></svg>',
      ),
    ).toBe(
      '<svg><text font-family="Inter, sans-serif"/><text font-family="Inter, Arial, sans-serif"/><text font-family="Inter, sans-serif"/><text font-family="monospace"/></svg>',
    );
  });

  it('requests one SVG frame and downloads it without the API token', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ err: null, images: { '12:34': 'https://cdn.figma.test/frame.svg' } }),
      )
      .mockResolvedValueOnce(new Response(EXPORTED_SVG, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('FIGMA_ACCESS_TOKEN', 'private-token');

    const compiled = await compileMarkdown(['```figma', FIGMA_LINK, '```'].join('\n'), {
      sourceFile: 'figma-link.md',
    });

    const [apiRequest, imageRequest] = fetchMock.mock.calls;
    const apiUrl = new URL(String(apiRequest?.[0]));
    expect(apiUrl.origin).toBe('https://api.figma.com');
    expect(apiUrl.pathname).toBe('/v1/images/AbCd1234');
    expect(apiUrl.searchParams.get('ids')).toBe('12:34');
    expect(apiUrl.searchParams.get('format')).toBe('svg');
    expect(apiUrl.searchParams.get('svg_outline_text')).toBe('false');
    expect(new Headers(apiRequest?.[1]?.headers).get('X-Figma-Token')).toBe('private-token');
    expect(String(imageRequest?.[0])).toBe('https://cdn.figma.test/frame.svg');
    expect(new Headers(imageRequest?.[1]?.headers).has('X-Figma-Token')).toBe(false);
    expect(compiled.html).toContain('Searchable Figma text');
    expect(compiled.html).toContain('font-family="Inter, sans-serif"');
    expect(compiled.html).not.toContain('private-token');
  });

  it('uses the CompileOptions token before the environment token', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ images: { '12:34': 'https://cdn.figma.test/frame.svg' } }),
      )
      .mockResolvedValueOnce(new Response(EXPORTED_SVG, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('FIGMA_ACCESS_TOKEN', 'environment-token');

    await compileMarkdown(['```figma', FIGMA_LINK, '```'].join('\n'), {
      sourceFile: 'figma-link.md',
      figmaAccessToken: 'options-token',
    });

    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('X-Figma-Token')).toBe(
      'options-token',
    );
  });

  it('uses the token while checking a Figma URL block', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ images: { '12:34': 'https://cdn.figma.test/frame.svg' } }),
      )
      .mockResolvedValueOnce(new Response(EXPORTED_SVG, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await checkMarkdown(['```figma', FIGMA_LINK, '```'].join('\n'), {
      sourceFile: 'figma-check.md',
      figmaAccessToken: 'check-token',
    });

    expect(result).toEqual({ warnings: [], errors: [], diagnostics: [] });
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('X-Figma-Token')).toBe(
      'check-token',
    );
  });

  it('renders both Figma source forms alongside Mermaid, PlantUML, and Wiremark', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ images: { '12:34': 'https://cdn.figma.test/frame.svg' } }),
      )
      .mockResolvedValueOnce(new Response(EXPORTED_SVG, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const localJson = JSON.stringify({
      name: 'Local frame',
      document: {
        id: '0:0',
        name: 'Document',
        type: 'DOCUMENT',
        children: [
          {
            id: '1:1',
            name: 'Page',
            type: 'CANVAS',
            children: [
              {
                id: '12:34',
                name: 'Local frame',
                type: 'FRAME',
                absoluteBoundingBox: { x: 0, y: 0, width: 240, height: 80 },
                children: [
                  {
                    id: '12:35',
                    name: 'Label',
                    type: 'TEXT',
                    absoluteBoundingBox: { x: 10, y: 10, width: 160, height: 24 },
                    characters: 'Offline JSON frame',
                    style: { fontFamily: 'Inter', fontSize: 16 },
                    fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 } }],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const markdown = [
      '# Combined diagrams',
      '',
      '```figma',
      localJson,
      '```',
      '',
      '```mermaid',
      'flowchart TB',
      '  A --> B',
      '```',
      '',
      '```plantuml',
      '@startuml',
      'Client -> API: Combined',
      '@enduml',
      '```',
      '',
      '```wireframe',
      'Wireframe #combined mobile',
      '  Stack column gap=2',
      '    Typography h4 "Wiremark diagram"',
      '```',
      '',
      '```figma',
      FIGMA_LINK,
      '```',
    ].join('\n');

    const compiled = await compileMarkdown(markdown, {
      sourceFile: 'combined-figma.md',
      figmaAccessToken: 'private-token',
    });

    expect(compiled.html).toContain('bp-diagram--figma');
    expect(compiled.html).toContain('bp-diagram--mermaid');
    expect(compiled.html).toContain('bp-diagram--plantuml');
    expect(compiled.html).toContain('bp-diagram--wiremark');
    expect(compiled.html).toContain('Offline JSON frame');
    expect(compiled.html).toContain('Searchable Figma text');
    expect(compiled.html.match(/<svg\b/g)).toHaveLength(5);
    expect(compiled.html).not.toContain('private-token');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(compiled.errors).toEqual([]);
  }, 60_000);

  it('separates cached URL results by token and reuses a token until the TTL expires', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ images: { '12:34': 'https://cdn.figma.test/frame.svg' } }),
      )
      .mockResolvedValueOnce(new Response(EXPORTED_SVG, { status: 200 }))
      .mockResolvedValueOnce(
        Response.json({ images: { '12:34': 'https://cdn.figma.test/frame.svg' } }),
      )
      .mockResolvedValueOnce(new Response(EXPORTED_SVG, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const diagramCache = new DiagramRenderCache();
    const markdown = ['```figma', FIGMA_LINK, '```'].join('\n');

    await compileMarkdown(markdown, {
      sourceFile: 'figma-cache.md',
      diagramCache,
      figmaAccessToken: 'first-token',
    });
    await compileMarkdown(markdown, {
      sourceFile: 'figma-cache.md',
      diagramCache,
      figmaAccessToken: 'first-token',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await compileMarkdown(markdown, {
      sourceFile: 'figma-cache.md',
      diagramCache,
      figmaAccessToken: 'second-token',
    });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(diagramCache.size).toBe(2);
  });

  it('passes a requested version and cancellation signal to both requests', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ images: { '12:34': 'https://cdn.figma.test/frame.svg' } }),
      )
      .mockResolvedValueOnce(new Response(EXPORTED_SVG, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    const svg = await fetchFigmaSvg(
      { fileKey: 'AbCd1234', nodeId: '12:34', versionId: 'version_5' },
      'private-token',
      { signal: controller.signal },
    );

    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).searchParams.get('version')).toBe(
      'version_5',
    );
    const [apiSignal, svgSignal] = fetchMock.mock.calls.map(([, init]) => init?.signal);
    expect(apiSignal).toBe(svgSignal);
    expect(apiSignal).toBeInstanceOf(AbortSignal);
    controller.abort(new Error('cancelled'));
    expect(apiSignal?.aborted).toBe(true);
    expect(svg).toBe(EXPORTED_SVG);
  });

  it('rejects missing credentials before making a request', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchFigmaSvg({ fileKey: 'key', nodeId: '1:2' }, '  ')).rejects.toThrow(
      'FIGMA_ACCESS_TOKEN is required',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fingerprints tokens only for URL blocks and applies a remote cache TTL', () => {
    const firstKey = figmaRenderer.cacheKeyForContext?.(FIGMA_LINK, {
      diagramId: 'bp-diagram-001',
      sourceFile: 'figma.md',
      line: 1,
      figmaAccessToken: 'first-private-token',
    });
    const secondKey = figmaRenderer.cacheKeyForContext?.(FIGMA_LINK, {
      diagramId: 'bp-diagram-001',
      sourceFile: 'figma.md',
      line: 1,
      figmaAccessToken: 'second-private-token',
    });
    const jsonKey = figmaRenderer.cacheKeyForContext?.('{"document":{}}', {
      diagramId: 'bp-diagram-001',
      sourceFile: 'figma.md',
      line: 1,
      figmaAccessToken: 'first-private-token',
    });

    expect(firstKey).not.toBe(secondKey);
    expect(firstKey).not.toContain('first-private-token');
    expect(secondKey).not.toContain('second-private-token');
    expect(jsonKey).toBe('local');
    expect(figmaRenderer.cacheTtlMsForSource?.(FIGMA_LINK)).toBe(FIGMA_URL_CACHE_TTL_MS);
    expect(figmaRenderer.cacheTtlMsForSource?.('{"document":{}}')).toBeUndefined();
  });

  it('rejects API failures without copying response bodies into diagnostics', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('private response details', { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchFigmaSvg({ fileKey: 'key', nodeId: '1:2' }, 'token')).rejects.toThrow(
      'Figma access denied (HTTP 403); check file permissions and the file_content:read scope',
    );
  });

  it.each([
    [401, 'Figma authentication failed (HTTP 401); the FIGMA_ACCESS_TOKEN is invalid or expired'],
    [404, 'Figma file or node was not found or is not available to this token (HTTP 404)'],
    [429, 'Figma API rate limit exceeded (HTTP 429); retry after the limit resets'],
  ])('reports HTTP %i without exposing the response body', async (status, diagnostic) => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('sensitive response body', { status }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchFigmaSvg({ fileKey: 'key', nodeId: '1:2' }, 'private-token')).rejects.toThrow(
      diagnostic,
    );
  });

  it('rejects absent frames and non-HTTPS export URLs', async () => {
    const missingFrameFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ images: { '3:4': null } }));
    vi.stubGlobal('fetch', missingFrameFetch);
    await expect(fetchFigmaSvg({ fileKey: 'key', nodeId: '1:2' }, 'token')).rejects.toThrow(
      'did not return an SVG for node "1:2"',
    );

    const insecureUrlFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ images: { '1:2': 'http://cdn.figma.test/frame.svg' } }),
      );
    vi.stubGlobal('fetch', insecureUrlFetch);
    await expect(fetchFigmaSvg({ fileKey: 'key', nodeId: '1:2' }, 'token')).rejects.toThrow(
      'must use HTTPS',
    );
    expect(insecureUrlFetch).toHaveBeenCalledTimes(1);
  });

  it('reports malformed API JSON and rejects an export URL with credentials', async () => {
    const invalidJsonFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('{'));
    vi.stubGlobal('fetch', invalidJsonFetch);
    await expect(fetchFigmaSvg({ fileKey: 'key', nodeId: '1:2' }, 'token')).rejects.toThrow(
      'Figma API returned an invalid JSON response',
    );

    const credentialUrlFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ images: { '1:2': 'https://user@cdn.figma.test/frame.svg' } }),
      );
    vi.stubGlobal('fetch', credentialUrlFetch);
    await expect(fetchFigmaSvg({ fileKey: 'key', nodeId: '1:2' }, 'token')).rejects.toThrow(
      'must use HTTPS without credentials',
    );
    expect(credentialUrlFetch).toHaveBeenCalledTimes(1);
  });

  it('rejects unsuccessful or empty SVG downloads', async () => {
    const failedDownloadFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ images: { '1:2': 'https://cdn.figma.test/frame.svg' } }),
      )
      .mockResolvedValueOnce(new Response('', { status: 429 }));
    vi.stubGlobal('fetch', failedDownloadFetch);
    await expect(fetchFigmaSvg({ fileKey: 'key', nodeId: '1:2' }, 'token')).rejects.toThrow(
      'Figma SVG download rate limit exceeded (HTTP 429); retry later',
    );

    const emptySvgFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ images: { '1:2': 'https://cdn.figma.test/frame.svg' } }),
      )
      .mockResolvedValueOnce(new Response('  ', { status: 200 }));
    vi.stubGlobal('fetch', emptySvgFetch);
    await expect(fetchFigmaSvg({ fileKey: 'key', nodeId: '1:2' }, 'token')).rejects.toThrow(
      'Figma SVG download returned an empty response',
    );
  });

  it('enforces response size limits from Content-Length before parsing the body', async () => {
    const oversizedApiFetch = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response('{"images":{}}', {
        headers: { 'Content-Length': String(MAX_FIGMA_API_RESPONSE_BYTES + 1) },
      }),
    );
    vi.stubGlobal('fetch', oversizedApiFetch);
    await expect(fetchFigmaSvg({ fileKey: 'key', nodeId: '1:2' }, 'token')).rejects.toThrow(
      `Figma API response is too large (limit ${MAX_FIGMA_API_RESPONSE_BYTES} bytes)`,
    );

    const oversizedStreamFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('x'.repeat(MAX_FIGMA_API_RESPONSE_BYTES + 1)));
    vi.stubGlobal('fetch', oversizedStreamFetch);
    await expect(fetchFigmaSvg({ fileKey: 'key', nodeId: '1:2' }, 'token')).rejects.toThrow(
      `Figma API response is too large (limit ${MAX_FIGMA_API_RESPONSE_BYTES} bytes)`,
    );

    const oversizedSvgFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ images: { '1:2': 'https://cdn.figma.test/frame.svg' } }),
      )
      .mockResolvedValueOnce(
        new Response('<svg/>', {
          headers: { 'Content-Length': String(MAX_FIGMA_SVG_RESPONSE_BYTES + 1) },
        }),
      );
    vi.stubGlobal('fetch', oversizedSvgFetch);
    await expect(fetchFigmaSvg({ fileKey: 'key', nodeId: '1:2' }, 'token')).rejects.toThrow(
      `Figma SVG response is too large (limit ${MAX_FIGMA_SVG_RESPONSE_BYTES} bytes)`,
    );
  });

  it('converts an aborted timeout signal into a safe timeout diagnostic', async () => {
    const timeoutController = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeoutController.signal);
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(async () => {
        timeoutController.abort(new Error('sensitive timeout details'));
        throw new Error('sensitive timeout details');
      }),
    );

    await expect(fetchFigmaSvg({ fileKey: 'key', nodeId: '1:2' }, 'token')).rejects.toThrow(
      `Figma request timed out after ${FIGMA_REQUEST_TIMEOUT_MS} ms`,
    );
  });

  it('reports source file and Markdown line for remote API and SVG sanitizer errors', async () => {
    const apiMarkdown = ['# Remote Figma', '', '```figma', FIGMA_LINK, '```'].join('\n');
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(new Response('private response body', { status: 429 })),
    );
    const apiResult = await checkMarkdown(apiMarkdown, {
      sourceFile: 'remote-design.md',
      figmaAccessToken: 'private-token',
    });
    expect(apiResult.diagnostics).toMatchObject([
      {
        sourceFile: 'remote-design.md',
        line: 3,
        message: expect.stringContaining('Figma API rate limit exceeded (HTTP 429)'),
      },
    ]);
    expect(JSON.stringify(apiResult.diagnostics)).not.toContain('private-token');

    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          Response.json({ images: { '12:34': 'https://temporary.figma.test/private.svg' } }),
        )
        .mockResolvedValueOnce(
          new Response('<svg><script>private JSON and token</script></svg>', { status: 200 }),
        ),
    );
    const svgResult = await compileMarkdown(apiMarkdown, {
      sourceFile: 'remote-design.md',
      figmaAccessToken: 'private-token',
    });
    expect(svgResult.diagnostics).toMatchObject([
      {
        code: 'diagram.svg',
        sourceFile: 'remote-design.md',
        line: 3,
        message: expect.stringContaining('forbidden <script>'),
      },
    ]);
    expect(svgResult.html).not.toContain('<script>private JSON and token</script>');
  });

  it('reports invalid Figma links at the Markdown line without echoing the URL', async () => {
    const privateUrl =
      'https://attacker.example/private?node-id=1-2&t=FIGMA_TEMPORARY_LINK_MUST_NOT_APPEAR';
    const result = await checkMarkdown(
      ['# Invalid link', '', '```figma', privateUrl, '```'].join('\n'),
      { sourceFile: 'invalid-link.md' },
    );
    const diagnostic = result.diagnostics?.[0];

    expect(diagnostic).toMatchObject({
      sourceFile: 'invalid-link.md',
      line: 3,
      message: expect.stringContaining('host must be figma.com or www.figma.com'),
    });
    expect(JSON.stringify(diagnostic)).not.toContain('FIGMA_TEMPORARY_LINK_MUST_NOT_APPEAR');
  });
});
