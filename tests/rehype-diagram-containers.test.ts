import { describe, expect, it } from 'vitest';
import type { Root } from 'hast';

import { rehypeDiagramContainersPlugin } from '../src/plugins/rehype-diagram-containers.js';

describe('rehype diagram containers plugin', () => {
  it('marks pre elements that wrap one diagram figure', () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'pre',
          properties: { className: ['existing'] },
          children: [
            {
              type: 'element',
              tagName: 'figure',
              properties: { className: ['bp-diagram', 'bp-diagram--mermaid'] },
              children: [],
            },
          ],
        },
      ],
    };

    rehypeDiagramContainersPlugin()(tree);

    expect(tree.children[0]).toMatchObject({
      properties: { className: ['existing', 'bp-diagram-container'] },
    });
  });

  it('leaves regular code blocks and non-diagram figures unchanged', () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'pre',
          properties: {},
          children: [{ type: 'text', value: 'code' }],
        },
        {
          type: 'element',
          tagName: 'pre',
          properties: {},
          children: [
            {
              type: 'element',
              tagName: 'figure',
              properties: { className: ['other-figure'] },
              children: [],
            },
          ],
        },
      ],
    };

    rehypeDiagramContainersPlugin()(tree);

    expect(tree.children[0]).not.toHaveProperty('properties.className');
    expect(tree.children[1]).not.toHaveProperty('properties.className');
  });
});
