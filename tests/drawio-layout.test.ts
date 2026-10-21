import { describe, expect, it } from 'vitest';

import { parseDrawioJson } from '../src/renderers/drawio-json.js';
import { layoutDrawioGraph } from '../src/renderers/drawio-layout.js';
import { arrangeDrawioItems } from '../src/renderers/drawio-rank.js';

describe('layoutDrawioGraph', () => {
  it('places a tree and its branches in top-to-bottom ranks', () => {
    const layout = layoutDrawioGraph(
      graph([
        node('start', 'Start'),
        node('build', 'Build'),
        node('test', 'Test'),
        node('release', 'Release'),
        edge('start-build', 'start', 'build'),
        edge('build-test', 'build', 'test'),
        edge('build-release', 'build', 'release'),
      ]),
    );
    const cells = byId(layout.cells);

    expect(cells.get('start')!.y).toBeLessThan(cells.get('build')!.y);
    expect(cells.get('build')!.y).toBeLessThan(cells.get('test')!.y);
    expect(cells.get('test')!.y).toBe(cells.get('release')!.y);
    expect(cells.get('test')!.x).not.toBe(cells.get('release')!.x);
    expect(layout.edges).toHaveLength(3);
  });

  it('lays out left-to-right graphs and handles directed cycles', () => {
    const lr = layoutDrawioGraph(
      graph([node('one', 'One'), node('two', 'Two'), edge('e1', 'one', 'two')], 'LR'),
    );
    const lrCells = byId(lr.cells);
    expect(lrCells.get('one')!.x).toBeLessThan(lrCells.get('two')!.x);

    const cyclic = layoutDrawioGraph(
      graph([
        node('a', 'A'),
        node('b', 'B'),
        node('c', 'C'),
        edge('ab', 'a', 'b'),
        edge('bc', 'b', 'c'),
        edge('ca', 'c', 'a'),
        edge('self', 'b', 'b'),
      ]),
    );
    const cycleCells = byId(cyclic.cells);
    expect(cycleCells.get('a')!.y).toBe(cycleCells.get('b')!.y);
    expect(cycleCells.get('b')!.y).toBe(cycleCells.get('c')!.y);
    expect(cyclic.edges).toHaveLength(4);
  });

  it('keeps nested group children inside the group and connects to outside nodes', () => {
    const layout = layoutDrawioGraph(
      graph([
        { id: 'deployment', type: 'group', parent: 'layer', label: 'Deployment' },
        node('build', 'Build', 'deployment'),
        node('ship', 'Ship', 'deployment'),
        node('customer', 'Customer'),
        edge('deploy', 'ship', 'customer'),
        { id: 'layer', type: 'layer' },
      ]),
    );
    const cells = byId(layout.cells);
    const group = cells.get('deployment')!;
    const build = cells.get('build')!;
    const ship = cells.get('ship')!;

    expect(build.x).toBeGreaterThan(group.x);
    expect(build.y).toBeGreaterThan(group.y);
    expect(build.x + build.width).toBeLessThan(group.x + group.width);
    expect(ship.y + ship.height).toBeLessThan(group.y + group.height);
    expect(layout.edges[0]!.source.x).toBe(ship.x);
  });

  it('wraps long labels and rejects layouts that exceed the SVG side limit', () => {
    const longLabel = 'oneverylongword'.repeat(10);
    const long = layoutDrawioGraph(graph([node('long', longLabel)]));
    expect(long.cells[0]!.labelLines.length).toBeGreaterThan(1);
    expect(long.cells[0]!.width).toBeLessThanOrEqual(280);

    const chain: Array<Record<string, unknown>> = [];
    for (let index = 0; index < 170; index += 1) {
      chain.push(node(`node-${index}`, `Node ${index}`));
      if (index > 0) {
        chain.push(edge(`edge-${index}`, `node-${index - 1}`, `node-${index}`));
      }
    }
    expect(() => layoutDrawioGraph(graph(chain))).toThrow('layout is too large');
  });

  it('stops graph ranking when the layout time budget expires', () => {
    let checks = 0;
    const checkTime = () => {
      checks += 1;
      if (checks > 3) {
        throw new Error('layout time budget expired');
      }
    };

    expect(() =>
      arrangeDrawioItems(
        [
          { id: 'a', width: 120, height: 56 },
          { id: 'b', width: 120, height: 56 },
          { id: 'c', width: 120, height: 56 },
        ],
        [
          ['a', 'b'],
          ['b', 'c'],
        ],
        'TB',
        checkTime,
      ),
    ).toThrow('layout time budget expired');
  });
});

function graph(cells: Array<Record<string, unknown>>, direction = 'TB') {
  const normalizedCells = cells.map((cell) =>
    cell.type === 'edge' || cell.type === 'layer' || cell.parent !== undefined
      ? cell
      : { ...cell, parent: 'layer' },
  );
  if (!normalizedCells.some((cell) => cell.id === 'layer')) {
    normalizedCells.unshift({ id: 'layer', type: 'layer' });
  }
  return parseDrawioJson(
    JSON.stringify({
      version: '26.0',
      pages: [{ id: 'page', name: 'Test page', cells: normalizedCells }],
    }),
    `direction=${direction}`,
  );
}

function node(id: string, label: string, parent = 'layer'): Record<string, unknown> {
  return { id, type: 'node', parent, label };
}

function edge(id: string, source: string, target: string): Record<string, unknown> {
  return { id, type: 'edge', parent: 'layer', source, target, label: '' };
}

function byId(cells: ReturnType<typeof layoutDrawioGraph>['cells']) {
  const result = new Map<string, (typeof cells)[number]>();
  const add = (cell: (typeof cells)[number]) => {
    result.set(cell.cell.id, cell);
    cell.children.forEach(add);
  };
  cells.forEach(add);
  return result;
}
