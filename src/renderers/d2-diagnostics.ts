import { D2Error } from './d2-error.js';
import type { D2Location } from './d2-error.js';

interface NativeDiagnostic {
  range?: string;
  errmsg?: string;
}

/** Converts D2.js worker messages into a concise diagnostic with local source coordinates. */
export function toD2Error(error: unknown): D2Error {
  if (error instanceof D2Error) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  const diagnostics = parseNativeDiagnostics(message);
  if (diagnostics.length === 0) {
    return new D2Error(cleanEngineMessage(message), readLocation(message), { cause: error });
  }

  const first = diagnostics[0];
  if (first === undefined) {
    return new D2Error(cleanEngineMessage(message), {}, { cause: error });
  }

  const location = readRangeLocation(first.range) ?? readLocation(first.errmsg ?? '');
  const description = diagnostics
    .map((diagnostic) => cleanEngineMessage(diagnostic.errmsg ?? 'D2 compilation failed'))
    .filter(Boolean)
    .join('\n');
  return new D2Error(description || 'D2 compilation failed', location, { cause: error });
}

function parseNativeDiagnostics(message: string): NativeDiagnostic[] {
  if (!message.startsWith('[')) {
    return [];
  }
  try {
    const value: unknown = JSON.parse(message);
    return Array.isArray(value)
      ? value.filter(
          (item): item is NativeDiagnostic =>
            typeof item === 'object' && item !== null && 'errmsg' in item,
        )
      : [];
  } catch {
    return [];
  }
}

function readRangeLocation(range: string | undefined): D2Location | undefined {
  const match = range?.match(/(?:^|,)index\.d2,(\d+):(\d+):\d+-/);
  if (match?.[1] === undefined || match[2] === undefined) {
    return undefined;
  }
  return { line: Number(match[1]) + 1, column: Number(match[2]) + 1 };
}

function readLocation(message: string): D2Location {
  const match = message.match(/(?:^|\n)index\.d2:(\d+):(\d+):/);
  if (match?.[1] === undefined || match[2] === undefined) {
    return {};
  }
  return { line: Number(match[1]), column: Number(match[2]) };
}

function cleanEngineMessage(message: string): string {
  return message
    .replace(/(?:^|\n)index\.d2:\d+:\d+:\s*/g, '')
    .replace(/(?:^|\n)index\.d2:\s*/g, '')
    .trim();
}
