import type { DrawioDirection } from './drawio-json.js';

const ITEM_GAP = 48;
const RANK_GAP = 76;

export interface DrawioRankedItem {
  id: string;
  width: number;
  height: number;
}

export interface DrawioPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DrawioRankedLayout {
  width: number;
  height: number;
  byId: Map<string, DrawioPosition>;
}

/** Ranks a directed graph, groups cycles, and places items in ordered layers. */
export function arrangeDrawioItems(
  items: readonly DrawioRankedItem[],
  edges: ReadonlyArray<readonly [string, string]>,
  direction: DrawioDirection,
  checkTime: () => void = () => undefined,
): DrawioRankedLayout {
  checkTime();
  if (items.length === 0) {
    return { width: 0, height: 0, byId: new Map() };
  }
  const ids = items.map(({ id }) => id);
  const ranks = rankGraph(ids, edges, checkTime);
  const ranksMap = new Map<number, DrawioRankedItem[]>();
  for (const item of items) {
    checkTime();
    const rank = ranks.get(item.id) ?? 0;
    const group = ranksMap.get(rank) ?? [];
    group.push(item);
    ranksMap.set(rank, group);
  }
  const incoming = buildNeighbors(ids, edges, true, checkTime);
  const outgoing = buildNeighbors(ids, edges, false, checkTime);
  const sortedRanks = [...ranksMap.keys()].sort((a, b) => a - b);
  const indexById = new Map<string, number>();
  for (const rank of sortedRanks) {
    checkTime();
    ranksMap.get(rank)!.sort((a, b) => a.id.localeCompare(b.id));
  }
  for (let sweep = 0; sweep < 4; sweep += 1) {
    const forward = sweep % 2 === 0;
    const visitRanks = forward ? sortedRanks : [...sortedRanks].reverse();
    for (const rank of visitRanks) {
      checkTime();
      const group = ranksMap.get(rank)!;
      const referenceRank = forward ? rank - 1 : rank + 1;
      const neighbors = forward ? incoming : outgoing;
      group.sort((left, right) => {
        checkTime();
        const leftValue = barycenter(left.id, neighbors, indexById, ranks, referenceRank);
        const rightValue = barycenter(right.id, neighbors, indexById, ranks, referenceRank);
        return leftValue - rightValue || left.id.localeCompare(right.id);
      });
      group.forEach((item, index) => indexById.set(item.id, index));
    }
  }

  return positionRanks(ranksMap, sortedRanks, direction, checkTime);
}

function positionRanks(
  ranksMap: Map<number, DrawioRankedItem[]>,
  sortedRanks: number[],
  direction: DrawioDirection,
  checkTime: () => void,
): DrawioRankedLayout {
  const byId = new Map<string, DrawioPosition>();
  let crossExtent = 0;
  let rankCursor = 0;
  for (const rank of sortedRanks) {
    checkTime();
    const group = ranksMap.get(rank)!;
    const isVertical = direction === 'TB';
    const rankExtent = Math.max(...group.map((item) => (isVertical ? item.height : item.width)));
    const itemExtent = group.reduce(
      (sum, item) => sum + (isVertical ? item.width : item.height),
      0,
    );
    const span = itemExtent + ITEM_GAP * Math.max(group.length - 1, 0);
    let itemCursor = -span / 2;
    for (const item of group) {
      checkTime();
      const crossSize = isVertical ? item.width : item.height;
      byId.set(item.id, {
        x: isVertical ? itemCursor + crossSize / 2 - item.width / 2 : rankCursor,
        y: isVertical ? rankCursor : itemCursor + crossSize / 2 - item.height / 2,
        width: item.width,
        height: item.height,
      });
      itemCursor += crossSize + ITEM_GAP;
    }
    crossExtent = Math.max(crossExtent, span);
    rankCursor += rankExtent + RANK_GAP;
  }

  for (const box of byId.values()) {
    checkTime();
    if (direction === 'TB') {
      box.x += crossExtent / 2;
    } else {
      box.y += crossExtent / 2;
    }
  }
  const rankExtent = Math.max(0, rankCursor - RANK_GAP);
  return direction === 'TB'
    ? { width: crossExtent, height: rankExtent, byId }
    : { width: rankExtent, height: crossExtent, byId };
}

function rankGraph(
  ids: string[],
  edges: ReadonlyArray<readonly [string, string]>,
  checkTime: () => void,
): Map<string, number> {
  const adjacency = new Map(ids.map((id) => [id, [] as string[]]));
  const reverse = new Map(ids.map((id) => [id, [] as string[]]));
  for (const [source, target] of edges) {
    checkTime();
    adjacency.get(source)?.push(target);
    reverse.get(target)?.push(source);
  }

  const visited = new Set<string>();
  const finishOrder: string[] = [];
  for (const start of ids) {
    checkTime();
    if (visited.has(start)) {
      continue;
    }
    visited.add(start);
    const stack = [{ id: start, next: 0 }];
    while (stack.length > 0) {
      checkTime();
      const frame = stack.at(-1)!;
      const neighbors = adjacency.get(frame.id)!;
      if (frame.next < neighbors.length) {
        const neighbor = neighbors[frame.next++]!;
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          stack.push({ id: neighbor, next: 0 });
        }
      } else {
        finishOrder.push(frame.id);
        stack.pop();
      }
    }
  }

  const componentById = new Map<string, number>();
  let componentCount = 0;
  for (const start of finishOrder.reverse()) {
    checkTime();
    if (componentById.has(start)) {
      continue;
    }
    const stack = [start];
    componentById.set(start, componentCount);
    while (stack.length > 0) {
      checkTime();
      const current = stack.pop()!;
      for (const neighbor of reverse.get(current)!) {
        checkTime();
        if (!componentById.has(neighbor)) {
          componentById.set(neighbor, componentCount);
          stack.push(neighbor);
        }
      }
    }
    componentCount += 1;
  }

  const componentEdges = Array.from({ length: componentCount }, () => new Set<number>());
  const indegree = new Array<number>(componentCount).fill(0);
  for (const [source, target] of edges) {
    checkTime();
    const from = componentById.get(source)!;
    const to = componentById.get(target)!;
    if (from !== to && !componentEdges[from]!.has(to)) {
      componentEdges[from]!.add(to);
      indegree[to] = indegree[to]! + 1;
    }
  }

  const componentRank = new Array<number>(componentCount).fill(0);
  const ready = indegree.flatMap((count, index) => (count === 0 ? [index] : []));
  for (let index = 0; index < ready.length; index += 1) {
    checkTime();
    const current = ready[index]!;
    for (const next of componentEdges[current]!) {
      checkTime();
      componentRank[next] = Math.max(componentRank[next]!, componentRank[current]! + 1);
      indegree[next] = indegree[next]! - 1;
      if (indegree[next] === 0) {
        ready.push(next);
      }
    }
  }

  return new Map(ids.map((id) => [id, componentRank[componentById.get(id)!]!]));
}

function buildNeighbors(
  ids: string[],
  edges: ReadonlyArray<readonly [string, string]>,
  incoming: boolean,
  checkTime: () => void,
): Map<string, string[]> {
  const result = new Map(ids.map((id) => [id, [] as string[]]));
  for (const [source, target] of edges) {
    checkTime();
    const key = incoming ? target : source;
    const value = incoming ? source : target;
    result.get(key)?.push(value);
  }
  return result;
}

function barycenter(
  id: string,
  neighbors: Map<string, string[]>,
  indices: Map<string, number>,
  ranks: Map<string, number>,
  referenceRank: number,
): number {
  const relevant = (neighbors.get(id) ?? []).filter(
    (neighbor) => ranks.get(neighbor) === referenceRank,
  );
  if (relevant.length === 0) {
    return indices.get(id) ?? 0;
  }
  return (
    relevant.reduce((sum, neighbor) => sum + (indices.get(neighbor) ?? 0), 0) / relevant.length
  );
}
