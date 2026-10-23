import { Ajv, type ErrorObject, type ValidateFunction } from 'ajv';

import { loadVegaLiteAssets } from './vega-lite-assets.js';
import { VegaLiteError } from './vega-lite-error.js';
import type { SourcePosition } from './vega-lite-source.js';

export const VEGA_LITE_SCHEMA_URL = 'https://vega.github.io/schema/vega-lite/v6.json';
export const VEGA_LITE_SCHEMA_SHA256 =
  '86a215814e105262c19c986703d5dd1cb7ef476d6b710d717085071e1d83ebba';
export const AJV_POLICY_VERSION = 'ajv-8.20.0;allErrors=true;strict=false;local-refs-only';

let validatorPromise:
  | Promise<{
      validate: ValidateFunction;
      schemaHash: string;
      vegaVersion: string;
      vegaLiteVersion: string;
    }>
  | undefined;

export async function validateVegaLiteSchema(
  spec: Record<string, unknown>,
  positions: Map<string, SourcePosition>,
): Promise<{ schemaHash: string; vegaVersion: string; vegaLiteVersion: string }> {
  const validator = await getValidator();
  if (validator.validate(spec)) {
    return {
      schemaHash: validator.schemaHash,
      vegaVersion: validator.vegaVersion,
      vegaLiteVersion: validator.vegaLiteVersion,
    };
  }

  const errors = selectConcreteErrors(validator.validate.errors ?? []);
  const first = errors[0];
  if (first === undefined) {
    throw new VegaLiteError('Vega-Lite specification does not match the local v6 schema');
  }
  const pointer = errorPointer(first);
  const location = positions.get(pointer) ?? parentPosition(pointer, positions);
  const details = errors
    .map((error) => `${errorPointer(error) || '/'}: ${formatAjvError(error)}`)
    .join('; ');
  throw new VegaLiteError(`invalid Vega-Lite specification: ${details}`, {
    ...(location ?? {}),
    pointer,
  });
}

async function getValidator(): Promise<{
  validate: ValidateFunction;
  schemaHash: string;
  vegaVersion: string;
  vegaLiteVersion: string;
}> {
  validatorPromise ??= loadVegaLiteAssets().then((assets) => {
    const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false, logger: false });
    ajv.addFormat('uri', (value: string) => isAbsoluteUri(value));
    ajv.addFormat('uri-reference', (value: string) => !/[\s<>"{}|\\^`]/.test(value));
    ajv.addFormat('color-hex', /^#(?:[\da-f]{3}|[\da-f]{6})$/i);
    return {
      validate: ajv.compile(assets.schema),
      schemaHash: assets.schemaHash,
      vegaVersion: assets.vegaVersion,
      vegaLiteVersion: assets.vegaLiteVersion,
    };
  });
  return validatorPromise;
}

function isAbsoluteUri(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol.length > 1;
  } catch {
    return false;
  }
}

function selectConcreteErrors(errors: ErrorObject[]): ErrorObject[] {
  return [...errors]
    .filter(
      (error) => error.keyword !== 'if' && error.keyword !== 'anyOf' && error.keyword !== 'oneOf',
    )
    .sort((left, right) => {
      const specificity = right.instancePath.length - left.instancePath.length;
      return specificity || priority(right.keyword) - priority(left.keyword);
    })
    .filter((error, index, items) => {
      const path = errorPointer(error);
      return items.findIndex((candidate) => errorPointer(candidate) === path) === index;
    })
    .slice(0, 3);
}

function priority(keyword: string): number {
  switch (keyword) {
    case 'required':
    case 'additionalProperties':
    case 'type':
    case 'enum':
      return 3;
    default:
      return 1;
  }
}

function errorPointer(error: ErrorObject): string {
  if (error.keyword === 'required' && typeof error.params.missingProperty === 'string') {
    return `${error.instancePath}/${escapePointer(error.params.missingProperty)}`;
  }
  if (
    error.keyword === 'additionalProperties' &&
    typeof error.params.additionalProperty === 'string'
  ) {
    return `${error.instancePath}/${escapePointer(error.params.additionalProperty)}`;
  }
  return error.instancePath;
}

function parentPosition(
  pointer: string,
  positions: Map<string, SourcePosition>,
): SourcePosition | undefined {
  const parent = pointer.replace(/\/[^/]*$/, '');
  return positions.get(parent) ?? positions.get('');
}

function formatAjvError(error: ErrorObject): string {
  if (error.keyword === 'required' && typeof error.params.missingProperty === 'string') {
    return `missing required property ${JSON.stringify(error.params.missingProperty)}`;
  }
  return error.message ?? `schema keyword ${error.keyword} failed`;
}

function escapePointer(value: string): string {
  return value.replace(/~/g, '~0').replace(/\//g, '~1');
}
