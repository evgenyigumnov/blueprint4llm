import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

export interface VegaLiteAssets {
  vegaScript: string;
  vegaLiteScript: string;
  schema: Record<string, unknown>;
  vegaVersion: string;
  vegaLiteVersion: string;
  schemaHash: string;
}

const require = createRequire(import.meta.url);
let assetsPromise: Promise<VegaLiteAssets> | undefined;

/** Loads the package-local browser bundles and schema on first Vega-Lite use. */
export function loadVegaLiteAssets(): Promise<VegaLiteAssets> {
  assetsPromise ??= loadAssets();
  return assetsPromise;
}

async function loadAssets(): Promise<VegaLiteAssets> {
  const schemaPath = require.resolve('vega-lite/vega-lite-schema.json');
  const vegaSchemaPath = require.resolve('vega/vega-schema.json');
  const vegaLiteDirectory = path.dirname(schemaPath);
  const vegaDirectory = path.dirname(vegaSchemaPath);
  const [schemaText, vegaScript, vegaLiteScript, vegaPackage, vegaLitePackage] = await Promise.all([
    readFile(schemaPath, 'utf8'),
    readFile(path.join(vegaDirectory, 'vega.min.js'), 'utf8'),
    readFile(path.join(vegaLiteDirectory, 'vega-lite.min.js'), 'utf8'),
    readPackageJson(path.resolve(vegaDirectory, '..')),
    readPackageJson(path.resolve(vegaLiteDirectory, '..')),
  ]);

  const schema = JSON.parse(schemaText) as Record<string, unknown>;
  assertLocalSchemaReferences(schema);
  return {
    schema,
    vegaScript,
    vegaLiteScript,
    vegaVersion: vegaPackage.version,
    vegaLiteVersion: vegaLitePackage.version,
    schemaHash: createHash('sha256').update(schemaText).digest('hex'),
  };
}

async function readPackageJson(directory: string): Promise<{ version: string }> {
  const value = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8')) as unknown;
  if (!isRecord(value) || typeof value.version !== 'string') {
    throw new Error(`could not read package version from ${directory}`);
  }
  return { version: value.version };
}

function assertLocalSchemaReferences(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertLocalSchemaReferences);
  } else if (isRecord(value)) {
    const reference = value.$ref;
    if (reference !== undefined && (typeof reference !== 'string' || !reference.startsWith('#/'))) {
      throw new Error('installed Vega-Lite schema contains a non-local reference');
    }
    Object.keys(value).forEach((key) => assertLocalSchemaReferences(value[key]));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
