import type { CompileResponse } from '@d2lang/d2';

import { D2Error } from './d2-error.js';

export type D2LayoutEngine = 'dagre' | 'elk';

interface D2AstMap {
  nodes?: D2AstNode[];
}

interface D2AstNode {
  map_key?: D2AstMapKey;
}

interface D2AstMapKey {
  range?: string;
  key?: { path?: unknown[] };
  value?: unknown;
}

type D2GraphRecord = {
  layers?: Array<D2GraphRecord | undefined>;
  scenarios?: Array<D2GraphRecord | undefined>;
  steps?: Array<D2GraphRecord | undefined>;
  objects?: Array<D2GraphObject | undefined>;
  edges?: Array<D2GraphEdge | undefined>;
};

interface D2GraphObject {
  attributes?: D2Attributes;
  objects?: D2GraphObject[];
}

interface D2GraphEdge {
  attributes?: D2Attributes;
}

interface D2Attributes {
  icon?: unknown;
  link?: { value?: string };
  tooltip?: { value?: string };
  language?: string;
  style?: { animated?: { value?: string } };
}

const ALLOWED_LAYOUTS = new Set<D2LayoutEngine>(['dagre', 'elk']);
const UNSUPPORTED_FIELDS = new Set(['icon', 'link', 'tooltip', 'language']);

/** Enforces the renderer profile and returns the one approved layout engine. */
export function validateD2Profile(result: CompileResponse): D2LayoutEngine {
  const ast = result.graph.ast as D2AstMap | undefined;
  if (ast === undefined || !Array.isArray(ast.nodes)) {
    throw new D2Error('D2.js did not return the syntax tree needed to validate this diagram');
  }

  const layout = validateConfiguration(ast);
  validateAstFeatures(ast);
  validateGraph(result.graph as unknown as D2GraphRecord);
  validateRenderOptions(result.renderOptions as unknown as Record<string, unknown>);
  return layout;
}

function validateConfiguration(ast: D2AstMap): D2LayoutEngine {
  let layout: D2LayoutEngine = 'dagre';
  let layoutSeen = false;
  let themeSeen = false;

  for (const node of ast.nodes ?? []) {
    const mapKey = node.map_key;
    if (mapKey === undefined || !samePath(readPath(mapKey), ['vars'])) {
      continue;
    }

    for (const variable of readMapNodes(mapKey.value)) {
      const variableKey = variable.map_key;
      if (variableKey === undefined || !samePath(readPath(variableKey), ['d2-config'])) {
        fail('only `vars.d2-config` may be set in a D2 block', variableKey);
      }

      for (const setting of readMapNodes(variableKey.value)) {
        const settingKey = setting.map_key;
        const path = settingKey === undefined ? [] : readPath(settingKey);
        if (path.length !== 1 || (path[0] !== 'layout-engine' && path[0] !== 'theme-id')) {
          fail('only `layout-engine` and `theme-id` are supported in `vars.d2-config`', settingKey);
        }

        const value = readScalar(settingKey?.value);
        if (path[0] === 'layout-engine') {
          if (layoutSeen) fail('set `layout-engine` only once', settingKey);
          layoutSeen = true;
          if (typeof value !== 'string' || !ALLOWED_LAYOUTS.has(value as D2LayoutEngine)) {
            fail('`layout-engine` must be `dagre` or `elk`', settingKey);
          }
          layout = value as D2LayoutEngine;
        } else {
          if (themeSeen) fail('set `theme-id` only once', settingKey);
          themeSeen = true;
          if (value !== 0 && value !== '0') {
            fail('only the static light theme `0` is supported', settingKey);
          }
        }
      }
    }
  }

  return layout;
}

function validateAstFeatures(ast: D2AstMap): void {
  visitAstNodes(ast.nodes ?? [], (mapKey) => {
    const path = readPath(mapKey);
    const field = path.at(-1)?.toLowerCase();
    if (field !== undefined && UNSUPPORTED_FIELDS.has(field)) {
      fail(`D2 field \`${field}\` is not supported`, mapKey);
    }
    if (
      field === 'animated' &&
      readScalar(mapKey.value) !== false &&
      readScalar(mapKey.value) !== 'false'
    ) {
      fail('animated diagrams are not supported', mapKey);
    }
  });
}

function validateGraph(graph: D2GraphRecord): void {
  for (const boardName of ['layers', 'scenarios', 'steps'] as const) {
    if (graph[boardName]?.length) {
      throw new D2Error(`D2 ${boardName} are not supported; use one static board per block`);
    }
  }

  for (const object of graph.objects ?? []) {
    if (object === undefined) continue;
    validateAttributes(object.attributes);
    validateObjects(object.objects ?? []);
  }
  for (const edge of graph.edges ?? []) {
    if (edge !== undefined) validateAttributes(edge.attributes);
  }
}

function validateObjects(objects: Array<D2GraphObject | undefined>): void {
  for (const object of objects) {
    if (object === undefined) continue;
    validateAttributes(object.attributes);
    validateObjects(object.objects ?? []);
  }
}

function validateAttributes(attributes: D2Attributes | undefined): void {
  if (attributes === undefined) return;
  if (attributes.icon !== undefined)
    throw new D2Error('D2 icons and image objects are not supported');
  if (attributes.link?.value) throw new D2Error('clickable D2 links are not supported');
  if (attributes.tooltip?.value) throw new D2Error('D2 tooltips are not supported');
  if (attributes.language !== undefined && attributes.language !== '') {
    throw new D2Error('Markdown and LaTeX labels are not supported; use plain text labels');
  }
  if (attributes.style?.animated?.value === 'true') {
    throw new D2Error('animated diagrams are not supported');
  }
}

function validateRenderOptions(options: Record<string, unknown>): void {
  if (options.themeID !== 0) throw new D2Error('only the static light theme `0` is supported');
  if (options.sketch === true) throw new D2Error('D2 sketch rendering is not supported');
  for (const field of [
    'darkThemeID',
    'themeOverrides',
    'darkThemeOverrides',
    'animateInterval',
    'target',
    'forceAppendix',
    'ascii',
  ]) {
    if (options[field] !== undefined && options[field] !== null && options[field] !== false) {
      throw new D2Error(`D2 render option \`${field}\` is not supported`);
    }
  }
}

function visitAstNodes(nodes: D2AstNode[], action: (mapKey: D2AstMapKey) => void): void {
  for (const node of nodes) {
    const mapKey = node.map_key;
    if (mapKey === undefined) continue;
    action(mapKey);
    visitAstNodes(readMapNodes(mapKey.value), action);
  }
}

function readMapNodes(value: unknown): D2AstNode[] {
  if (!isRecord(value) || !isRecord(value.map) || !Array.isArray(value.map.nodes)) return [];
  return value.map.nodes.filter(isRecord) as D2AstNode[];
}

function readPath(mapKey: D2AstMapKey): string[] {
  const path = mapKey.key?.path;
  if (!Array.isArray(path)) return [];
  return path
    .map((part) => readScalar(part))
    .filter((part): part is string => typeof part === 'string');
}

function readScalar(value: unknown): string | number | boolean | undefined {
  if (!isRecord(value)) return undefined;
  for (const key of [
    'unquoted_string',
    'double_quoted_string',
    'single_quoted_string',
    'number',
    'boolean',
  ]) {
    const item = value[key];
    if (!isRecord(item)) continue;
    const scalar = item.value;
    if (typeof scalar === 'string') return key === 'number' ? Number(scalar) : scalar;
    if (typeof scalar === 'number' || typeof scalar === 'boolean') return scalar;
    if (Array.isArray(scalar)) {
      const text = scalar
        .map((part) => (isRecord(part) && typeof part.string === 'string' ? part.string : ''))
        .join('');
      return text;
    }
  }
  return undefined;
}

function samePath(actual: string[], expected: string[]): boolean {
  return (
    actual.length === expected.length && actual.every((part, index) => part === expected[index])
  );
}

function fail(message: string, mapKey: D2AstMapKey | undefined): never {
  const location = parseAstRange(mapKey?.range);
  throw new D2Error(message, location);
}

function parseAstRange(range: string | undefined): { line?: number; column?: number } {
  const match = range?.match(/(?:^|,)index\.d2,(\d+):(\d+):\d+-/);
  if (match?.[1] === undefined || match[2] === undefined) return {};
  return { line: Number(match[1]) + 1, column: Number(match[2]) + 1 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
