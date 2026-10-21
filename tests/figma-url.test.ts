import { describe, expect, it } from 'vitest';

import { parseFigmaUrl } from '../src/renderers/figma-url.js';
import { figmaRenderer } from '../src/renderers/figma.js';

describe('Figma URL parsing', () => {
  it.each([
    'https://www.figma.com/design/AbCd1234/Profile?node-id=12-34&t=ignored',
    'https://figma.com/file/AbCd1234/Profile?node-id=12%3A34&foo=ignored',
  ])('extracts API parameters and ignores unrelated query data from %s', (source) => {
    expect(parseFigmaUrl(source)).toEqual({ fileKey: 'AbCd1234', nodeId: '12:34' });
  });

  it('reads a version-id without retaining other URL data', () => {
    expect(
      parseFigmaUrl(
        'https://www.figma.com/design/AbCd1234/Profile?node-id=12-34&version-id=v_45&t=secret',
      ),
    ).toEqual({ fileKey: 'AbCd1234', nodeId: '12:34', versionId: 'v_45' });
  });

  it('validates links before URL rendering', async () => {
    await expect(
      figmaRenderer.render('https://example.com/design/key/name?node-id=1-2', {
        diagramId: 'bp-diagram-001',
        sourceFile: 'figma.md',
        line: 1,
      }),
    ).rejects.toThrow('Figma URL host must be figma.com or www.figma.com');
  });

  it.each([
    ['rejects HTTP', 'http://www.figma.com/design/key/name?node-id=1-2', 'HTTPS'],
    [
      'rejects an untrusted host',
      'https://figma.com.attacker.example/design/key/name?node-id=1-2',
      'host must be figma.com or www.figma.com',
    ],
    [
      'rejects credentials',
      'https://user@www.figma.com/design/key/name?node-id=1-2',
      'must not include credentials or a custom port',
    ],
    [
      'rejects a non-default port',
      'https://www.figma.com:8443/design/key/name?node-id=1-2',
      'must not include credentials or a custom port',
    ],
    [
      'rejects unsupported paths',
      'https://www.figma.com/community/file/key?node-id=1-2',
      'path must be /design/:key or /file/:key',
    ],
    [
      'requires one node-id',
      'https://www.figma.com/design/key/name?foo=bar',
      'exactly one node-id parameter',
    ],
    [
      'rejects duplicate node-id parameters',
      'https://www.figma.com/design/key/name?node-id=1-2&node-id=3-4',
      'exactly one node-id parameter',
    ],
    [
      'rejects malformed node-id values',
      'https://www.figma.com/design/key/name?node-id=1',
      'node-id must use the form <number>-<number>',
    ],
    [
      'rejects duplicate version-id parameters',
      'https://www.figma.com/design/key/name?node-id=1-2&version-id=1&version-id=2',
      'at most one version-id parameter',
    ],
    [
      'rejects malformed version-id values',
      'https://www.figma.com/design/key/name?node-id=1-2&version-id=bad%2Fvalue',
      'version-id is invalid',
    ],
  ])('%s', (_caseName, source, expectedError) => {
    expect(() => parseFigmaUrl(source)).toThrow(expectedError);
  });
});
