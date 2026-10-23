import { lstat, readlink, realpath } from 'node:fs/promises';
import path from 'node:path';

import { summarizeDiagnostics } from './diagnostics.js';
import type { BlueprintDiagnostic, DiagnosticCode, DiagnosticScope } from './diagnostics.js';
import { toDiagnosticError } from './errors.js';

export type DiagnosticReportOutput = 'html' | 'pdf' | 'svg' | 'png' | 'jpeg';

export interface DiagnosticReport {
  schemaVersion: 1;
  sourceFile: string;
  status: 'ok' | 'error';
  summary: { errors: number; warnings: number };
  diagnostics: readonly BlueprintDiagnostic[];
  outputs?: Partial<Record<DiagnosticReportOutput, string>>;
}

export class ReportPathConflictError extends Error {
  constructor(reportPath: string, conflictingPath: string) {
    super(`--report-json path ${reportPath} conflicts with ${conflictingPath}`);
    this.name = 'ReportPathConflictError';
  }
}

/** Creates the versioned, JSON-safe CLI report. */
export function createDiagnosticReport(
  sourceFile: string,
  diagnostics: readonly BlueprintDiagnostic[],
  outputs: Partial<Record<DiagnosticReportOutput, string>> = {},
): DiagnosticReport {
  const summary = summarizeDiagnostics(diagnostics);
  const report: DiagnosticReport = {
    schemaVersion: 1,
    sourceFile: path.resolve(sourceFile),
    status: summary.errors > 0 ? 'error' : 'ok',
    summary,
    diagnostics: diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
  if (Object.keys(outputs).length > 0) {
    report.outputs = { ...outputs };
  }
  return report;
}

/** Serializes a report with stable indentation and a final newline. */
export function serializeDiagnosticReport(report: DiagnosticReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

/** Turns a thrown pipeline/export error into the public diagnostic shape. */
export function diagnosticForError(
  error: unknown,
  sourceFile: string,
  code: DiagnosticCode,
  scope: DiagnosticScope,
): BlueprintDiagnostic {
  const diagnostic = toDiagnosticError(error, 'operation failed', { sourceFile });
  return {
    severity: 'error',
    code,
    scope,
    sourceFile: path.resolve(diagnostic.sourceFile ?? sourceFile),
    ...(diagnostic.line === undefined ? {} : { line: diagnostic.line }),
    ...(diagnostic.column === undefined ? {} : { column: diagnostic.column }),
    message: diagnostic.message,
  };
}

/** Rejects a report that resolves to the source or generated output, including symlinks. */
export async function assertReportPathAvailable(
  reportPath: string,
  sourcePath: string,
  outputPath?: string,
  additionalOutputPaths: readonly string[] = [],
): Promise<void> {
  const reportCanonical = await canonicalizePath(reportPath);
  const sourceCanonical = await canonicalizePath(sourcePath);
  if (reportCanonical === sourceCanonical) {
    throw new ReportPathConflictError(reportPath, sourcePath);
  }
  if (outputPath !== undefined) {
    const outputCanonical = await canonicalizePath(outputPath);
    if (reportCanonical === outputCanonical) {
      throw new ReportPathConflictError(reportPath, outputPath);
    }
  }
  for (const candidate of additionalOutputPaths) {
    const candidateCanonical = await canonicalizePath(candidate);
    if (reportCanonical === candidateCanonical) {
      throw new ReportPathConflictError(reportPath, candidate);
    }
  }
}

async function canonicalizePath(filePath: string, visited = new Set<string>()): Promise<string> {
  const absolute = path.resolve(filePath);
  if (visited.has(absolute)) {
    throw new Error(`symbolic link cycle while resolving ${absolute}`);
  }
  const nextVisited = new Set(visited);
  nextVisited.add(absolute);
  try {
    const stats = await lstat(absolute);
    if (stats.isSymbolicLink()) {
      const destination = await readlink(absolute);
      return canonicalizePath(
        path.isAbsolute(destination)
          ? destination
          : path.resolve(path.dirname(absolute), destination),
        nextVisited,
      );
    }
    return await realpath(absolute);
  } catch (error) {
    if (!isPathMissing(error)) {
      throw error;
    }
    const parent = path.dirname(absolute);
    if (parent === absolute) {
      return absolute;
    }
    return path.join(await canonicalizePath(parent, nextVisited), path.basename(absolute));
  }
}

function isPathMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  );
}
