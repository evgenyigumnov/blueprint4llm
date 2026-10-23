import { VegaLiteError, toJsonPointer } from './vega-lite-error.js';
import type { SourcePosition } from './vega-lite-source.js';

const STYLE_KEYS = new Set([
  'color',
  'fill',
  'stroke',
  'background',
  'font',
  'fontFamily',
  'labelColor',
  'titleColor',
  'domainColor',
  'gridColor',
  'tickColor',
]);

/** Rejects external CSS resources, then applies the static chart defaults safely. */
export function applyVegaLiteStylePolicy(
  spec: Record<string, unknown>,
  source: string,
  positions: Map<string, SourcePosition>,
): void {
  validateSafeStyleStrings(spec, [], source, positions);
  applyDefaults(spec);
}

export function isAutomaticResize(value: unknown): boolean {
  return (
    value === 'fit' ||
    value === 'fit-x' ||
    value === 'fit-y' ||
    (isRecord(value) && (value.type === 'fit' || value.resize === true))
  );
}

function validateSafeStyleStrings(
  value: unknown,
  path: (string | number)[],
  source: string,
  positions: Map<string, SourcePosition>,
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      validateSafeStyleStrings(item, [...path, index], source, positions),
    );
    return;
  }
  if (!isRecord(value)) return;
  for (const key of Object.keys(value)) {
    const childPath = [...path, key];
    const pointer = toJsonPointer(childPath);
    if (key === 'href')
      failAt('href values are not supported in static export', pointer, source, positions);
    if (key === 'data' || key === 'datasets' || key === 'values' || key === 'usermeta') continue;
    const child = value[key];
    if (STYLE_KEYS.has(key) && typeof child === 'string' && /url\s*\(/i.test(child)) {
      const references = [...child.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)];
      if (
        references.some((match) => !(match[1] ?? match[2] ?? match[3] ?? '').trim().startsWith('#'))
      ) {
        failAt('external CSS url() resources are not supported', pointer, source, positions);
      }
    }
    validateSafeStyleStrings(child, childPath, source, positions);
  }
}

function applyDefaults(spec: Record<string, unknown>): void {
  if (!hasOwn(spec, 'background') && !configuredViewBackground(spec.config)) {
    defineOwn(spec, 'background', 'white');
  }
  let config: Record<string, unknown>;
  if (isRecord(spec.config)) config = spec.config;
  else {
    config = Object.create(null) as Record<string, unknown>;
    defineOwn(spec, 'config', config);
  }
  if (!hasOwn(config, 'font')) defineOwn(config, 'font', 'sans-serif');
  applyDimensions(spec, config);
}

function applyDimensions(
  spec: Record<string, unknown>,
  inheritedConfig: Record<string, unknown>,
): void {
  const config = isRecord(spec.config) ? spec.config : inheritedConfig;
  if (hasOwn(spec, 'mark')) {
    if (!hasOwn(spec, 'width') && !hasConfiguredDimension(config, inheritedConfig, 'width')) {
      defineOwn(spec, 'width', 480);
    }
    if (!hasOwn(spec, 'height') && !hasConfiguredDimension(config, inheritedConfig, 'height')) {
      defineOwn(spec, 'height', 300);
    }
    return;
  }
  if (Array.isArray(spec.layer)) {
    if (!hasOwn(spec, 'width') && !hasConfiguredDimension(config, inheritedConfig, 'width')) {
      defineOwn(spec, 'width', 480);
    }
    if (!hasOwn(spec, 'height') && !hasConfiguredDimension(config, inheritedConfig, 'height')) {
      defineOwn(spec, 'height', 300);
    }
    return;
  }
  for (const key of ['concat', 'hconcat', 'vconcat']) {
    const children = spec[key];
    if (Array.isArray(children))
      children.forEach((child) => isRecord(child) && applyDimensions(child, config));
  }
  if (isRecord(spec.spec)) applyDimensions(spec.spec, config);
}

function configuredViewBackground(config: unknown): boolean {
  return (
    isRecord(config) &&
    (hasOwn(config, 'background') || (isRecord(config.view) && hasOwn(config.view, 'background')))
  );
}

function hasConfiguredDimension(
  config: Record<string, unknown>,
  inheritedConfig: Record<string, unknown>,
  dimension: 'width' | 'height',
): boolean {
  return (
    hasDimensionInConfig(config, dimension) || hasDimensionInConfig(inheritedConfig, dimension)
  );
}

function hasDimensionInConfig(
  config: Record<string, unknown>,
  dimension: 'width' | 'height',
): boolean {
  if (!isRecord(config.view)) return false;
  const keys =
    dimension === 'width'
      ? ['continuousWidth', 'discreteWidth']
      : ['continuousHeight', 'discreteHeight'];
  return (
    keys.some((key) => hasOwn(config.view as Record<string, unknown>, key)) ||
    hasOwn(config.view, 'step')
  );
}

function failAt(
  message: string,
  pointer: string,
  _source: string,
  positions: Map<string, SourcePosition>,
): never {
  const parent = pointer.replace(/\/[^/]*$/, '');
  const location = positions.get(pointer) ?? positions.get(parent);
  throw new VegaLiteError(`${pointer || '/'}: ${message}`, { ...(location ?? {}), pointer });
}

function defineOwn(target: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
