import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { parseExcalidrawJson } from '../src/renderers/excalidraw-json.js';
import { renderExcalidrawSvg } from '../src/renderers/excalidraw-svg.js';
import { parseAndValidateSvg } from '../src/svg/parse-and-validate.js';

const readFixture = (name: string) =>
  readFile(new URL(`./fixtures/excalidraw/${name}`, import.meta.url), 'utf8');

describe('renderExcalidrawSvg', () => {
  it('preserves scene order, groups, multi-line text, and excludes deleted elements from bounds', async () => {
    const scene = parseExcalidrawJson(await readFixture('architectural-scene-v2.excalidraw'));
    const svg = renderExcalidrawSvg(scene);

    expect(svg.indexOf('data-element-id="client"')).toBeLessThan(
      svg.indexOf('data-element-id="api"'),
    );
    expect(svg).toContain('data-group-ids="frontend-inner frontend"');
    expect(svg).toContain('data-group-ids="backend services"');
    expect(svg).toContain('<tspan x="142" y="195">Valid</tspan>');
    expect(svg).toContain('<tspan x="142" y="214.2">request?</tspan>');
    expect(svg).not.toContain('deleted-far-away');
    expect(svg).not.toContain('250000');
    expect(svg).toContain(`rotate(${(-0.28 * 180) / Math.PI} 362 207)`);
    expect(parseAndValidateSvg(svg).tagName).toBe('svg');
  });

  it('draws each bound label once and keeps links and file payloads out of SVG', async () => {
    const scene = parseExcalidrawJson(await readFixture('unsupported-scene-v2.excalidraw'));
    const svg = renderExcalidrawSvg(scene);

    expect(svg.match(/Изображение не поддерживается/g)).toHaveLength(1);
    expect(svg).toContain('freedraw: не поддерживается');
    expect(svg).toContain('frame: не поддерживается');
    expect(svg).toContain('arrow: не поддерживается (elbow-one)');
    expect(svg).not.toContain('example.invalid');
    expect(svg).not.toContain('token=secret');
    expect(svg).not.toContain('data:image/png');
    expect(svg).not.toContain('file-one');
    expect(svg).toContain('stroke-dasharray="8 6"');
    expect(svg).toContain('fill="#fef3c7"');
    expect(parseAndValidateSvg(svg).tagName).toBe('svg');
  });

  it('escapes element IDs, group IDs, and text without emitting active markup', () => {
    const scene = parseExcalidrawJson(
      JSON.stringify({
        type: 'excalidraw',
        version: 2,
        elements: [
          {
            id: `node"<&`,
            type: 'text',
            x: 0,
            y: 0,
            width: 80,
            height: 12,
            groupIds: ['group"<&'],
            text: '<title> & safe',
            fontFamily: 2,
          },
        ],
      }),
    );
    const svg = renderExcalidrawSvg(scene);

    expect(svg).toContain('data-element-id="node&quot;&lt;&amp;"');
    expect(svg).toContain('data-group-ids="group&quot;&lt;&amp;"');
    expect(svg).toContain('&lt;title&gt; &amp; safe');
    expect(svg).not.toContain('<title> & safe');
    expect(parseAndValidateSvg(svg).tagName).toBe('svg');
  });

  it('replaces unsupported arrowheads with arrow-shaped heads and is deterministic', async () => {
    const scene = parseExcalidrawJson(await readFixture('unsupported-scene-v2.excalidraw'));
    const first = renderExcalidrawSvg(scene);
    const second = renderExcalidrawSvg(scene);

    expect(first).toBe(second);
    expect(first).toContain('M 346 15.24 L 340 18 L 346 20.76');
    expect(scene.warnings.map(({ message }) => message)).toContainEqual(
      expect.stringContaining('arrowhead "diamond" is replaced with "arrow"'),
    );
  });

  it('renders an empty or deleted-only scene as a small labeled SVG', () => {
    const scene = parseExcalidrawJson(
      JSON.stringify({
        type: 'excalidraw',
        version: 2,
        elements: [],
        appState: { viewBackgroundColor: '#dbeafe' },
      }),
    );
    const svg = renderExcalidrawSvg(scene);

    expect(svg).toContain('Пустая сцена Excalidraw');
    expect(svg).toContain('<rect width="240" height="48" fill="#dbeafe"/>');
    expect(scene.warnings[0]?.message).toContain('empty Excalidraw scene');
    expect(parseAndValidateSvg(svg).tagName).toBe('svg');
  });

  it('enforces the output byte limit while fragments are appended', () => {
    const scene = parseExcalidrawJson(
      JSON.stringify({
        type: 'excalidraw',
        version: 2,
        elements: [{ id: 'large', type: 'text', x: 0, y: 0, width: 1, height: 1, text: 'ok' }],
      }),
    );
    scene.elements[0]!.text = '<'.repeat(1_100_000);

    expect(() => renderExcalidrawSvg(scene)).toThrow('Excalidraw SVG is too large');
  });
});
