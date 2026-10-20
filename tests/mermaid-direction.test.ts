import { describe, expect, it } from 'vitest';

import { forceVerticalMermaidDirection } from '../src/renderers/mermaid-direction.js';
import { mermaidRenderer } from '../src/renderers/mermaid.js';

describe('Mermaid vertical direction', () => {
  it('forces flowcharts and graph subgraphs to top-to-bottom while preserving line endings', () => {
    const source = 'flowchart LR\r\n  subgraph Group\r\n    direction RL\r\n    A --> B\r\n  end';

    expect(forceVerticalMermaidDirection(source)).toBe(
      'flowchart TB\r\n  subgraph Group\r\n    direction TB\r\n    A --> B\r\n  end',
    );
  });

  it.each([
    ['classDiagram', 'direction LR', 'direction TB'],
    ['stateDiagram-v2', 'direction RL', 'direction TB'],
    ['erDiagram', 'direction BT', 'direction TB'],
    ['requirementDiagram', 'direction LR', 'direction TB'],
    ['usecase-beta', 'direction RL', 'direction TB'],
  ])('normalizes direction statements in %s diagrams', (type, direction, expected) => {
    expect(forceVerticalMermaidDirection(`${type}\n  ${direction}\n`)).toBe(
      `${type}\n  ${expected}\n`,
    );
  });

  it.each([
    ['timeline LR', 'timeline TD'],
    ['timeline', 'timeline TD'],
    ['gitGraph LR:', 'gitGraph TB:'],
    ['gitGraph', 'gitGraph TB:'],
    ['gitGraph LR: %% direction: commits', 'gitGraph TB: %% direction: commits'],
    ['swimlane-beta RL', 'swimlane-beta TB'],
    ['agentflow-beta LR', 'agentflow-beta TB'],
  ])('sets a vertical header direction for %s', (source, expected) => {
    expect(forceVerticalMermaidDirection(source)).toBe(expected);
  });

  it('leaves diagram types without a layout direction unchanged', () => {
    const source = 'sequenceDiagram\n  Alice->>Bob: Hello';

    expect(forceVerticalMermaidDirection(source)).toBe(source);
  });

  it('leaves non-direction text alone when it is not a diagram declaration', () => {
    const source = 'sequenceDiagram\n  direction LR';

    expect(forceVerticalMermaidDirection(source)).toBe(source);
  });

  it('renders an LR flowchart vertically', async () => {
    const source = 'flowchart LR\n  A[Start] --> B[Continue] --> C[Finish]';
    const result = await mermaidRenderer.render(source, {
      diagramId: 'bp-diagram-vertical-test',
      sourceFile: 'vertical.md',
      line: 1,
    });
    const svgRoot = result.svg.match(/<svg\b[^>]*>/)?.[0];
    const viewBox = svgRoot?.match(/\bviewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/);

    expect(viewBox).not.toBeNull();
    expect(Number(viewBox?.[2])).toBeGreaterThan(Number(viewBox?.[1]));
  }, 60_000);
});
