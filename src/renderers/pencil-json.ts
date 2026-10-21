import { createScanner, parseTree, printParseErrorCode, type ParseError } from 'jsonc-parser';

import { decodeJsonNode, PencilJsonError } from './pencil-json-error.js';
import {
  MAX_PENCIL_DEPTH,
  MAX_PENCIL_JSON_BYTES,
  validatePencilDocument,
} from './pencil-schema.js';
import type { PencilDocument } from './pencil-schema.js';

/** Parses JSONC and validates the supported Pencil schema. */
export function parsePencilJson(source: string): PencilDocument {
  const byteLength = Buffer.byteLength(source, 'utf8');
  if (byteLength > MAX_PENCIL_JSON_BYTES) {
    throw new PencilJsonError(
      `Pencil JSONC is too large: ${byteLength} bytes (limit ${MAX_PENCIL_JSON_BYTES} bytes)`,
      source,
      0,
    );
  }

  assertJsonNesting(source);
  const errors: ParseError[] = [];
  const root = parseTree(source, errors, {
    allowTrailingComma: false,
    disallowComments: false,
    allowEmptyContent: false,
  });
  const parseError = errors[0];
  if (parseError !== undefined) {
    throw new PencilJsonError(
      `invalid Pencil JSONC: ${printParseErrorCode(parseError.error)}`,
      source,
      parseError.offset,
    );
  }
  if (root === undefined) {
    throw new PencilJsonError('Pencil JSONC must contain a document', source, 0);
  }

  return validatePencilDocument(decodeJsonNode(root, source), source, root);
}

function assertJsonNesting(source: string): void {
  const scanner = createScanner(source, true);
  let nesting = 0;
  const maxJsonNesting = MAX_PENCIL_DEPTH * 2 + 16;
  // jsonc-parser exposes these token kinds as ambient const enums.
  for (let token = scanner.scan(); token !== 17; token = scanner.scan()) {
    if (token === 1 || token === 3) {
      nesting += 1;
      if (nesting > maxJsonNesting) {
        throw new PencilJsonError(
          `Pencil JSONC structure exceeds the nesting limit of ${MAX_PENCIL_DEPTH} nodes`,
          source,
          scanner.getTokenOffset(),
        );
      }
    } else if (token === 2 || token === 4) {
      nesting = Math.max(0, nesting - 1);
    }
  }
}
