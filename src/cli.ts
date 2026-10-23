#!/usr/bin/env node
import { readFileSync, realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parseCliArgs, UsageError, USAGE } from './args.js';
import type { CliInvocation } from './args.js';
import { writeBlueprintOutput, writeSingleOutput } from './build.js';
import { checkMarkdown, compileMarkdown } from './compiler.js';
import type { CompiledBlueprint } from './compiler.js';
import { formatDiagnostic, summarizeDiagnostics } from './diagnostics.js';
import type { BlueprintDiagnostic } from './diagnostics.js';
import {
  assertReportPathAvailable,
  createDiagnosticReport,
  diagnosticForError,
  ReportPathConflictError,
  serializeDiagnosticReport,
} from './diagnostic-report.js';
import { renderDiagramImage } from './image-export.js';
import { renderPdf } from './pdf.js';
import { startPreviewServer } from './server.js';

export interface CliIo {
  out: (text: string) => void;
  err: (text: string) => void;
}

const DEFAULT_IO: CliIo = {
  out: (text) => process.stdout.write(text),
  err: (text) => process.stderr.write(text),
};

export const EXIT_OK = 0;
export const EXIT_FAILURE = 1;
export const EXIT_USAGE = 2;

/**
 * Runs the CLI. Returns the process exit code instead of exiting,
 * so the flow is unit-testable and embeddable.
 */
export async function main(argv: readonly string[], io: CliIo = DEFAULT_IO): Promise<number> {
  let invocation: CliInvocation;
  try {
    invocation = parseCliArgs(argv);
  } catch (error) {
    if (error instanceof UsageError) {
      io.err(`blueprint4llm: ${error.message}\n\n${USAGE}\n`);
      return EXIT_USAGE;
    }
    throw error;
  }

  if (invocation.kind !== 'serve' && invocation.kind !== 'help' && invocation.kind !== 'version') {
    const reportJson = invocation.reportJson;
    if (reportJson !== undefined) {
      try {
        await assertReportPathAvailable(
          reportJson,
          invocation.input,
          invocation.kind === 'build' ? invocation.outputFile : undefined,
        );
      } catch (error) {
        const message =
          error instanceof ReportPathConflictError
            ? error.message
            : `cannot validate --report-json path ${reportJson}: ${errorMessage(error)}`;
        io.err(`blueprint4llm: ${message}\n\n${USAGE}\n`);
        return EXIT_USAGE;
      }
    }
  }

  switch (invocation.kind) {
    case 'help':
      io.out(`${USAGE}\n`);
      return EXIT_OK;
    case 'version':
      io.out(`${readPackageVersion()}\n`);
      return EXIT_OK;
    case 'check':
      return runCheck(invocation, io);
    case 'serve':
      return runServe(invocation, io);
    case 'build':
      return runBuild(invocation, io);
  }
}

async function runCheck(
  invocation: Extract<CliInvocation, { kind: 'check' }>,
  io: CliIo,
): Promise<number> {
  const sourceFile = path.resolve(invocation.input);
  let diagnostics: BlueprintDiagnostic[];
  let result: Awaited<ReturnType<typeof checkMarkdown>>;
  let markdown: string;
  try {
    markdown = await readFile(invocation.input, 'utf8');
  } catch (error) {
    const diagnostic = diagnosticForError(
      new Error(`cannot read ${invocation.input}: ${errorMessage(error)}`),
      sourceFile,
      'document.read',
      'document',
    );
    diagnostics = [diagnostic];
    return finishCheck(invocation, diagnostics, io);
  }

  try {
    result = await checkMarkdown(markdown, { sourceFile });
  } catch (error) {
    diagnostics = [diagnosticForError(error, sourceFile, 'document.compile', 'document')];
    return finishCheck(invocation, diagnostics, io);
  }

  diagnostics = compilationDiagnostics(result, sourceFile);
  return finishCheck(
    invocation,
    diagnostics,
    io,
    result.diagnostics === undefined ? result : undefined,
  );
}

async function finishCheck(
  invocation: Extract<CliInvocation, { kind: 'check' }>,
  diagnostics: BlueprintDiagnostic[],
  io: CliIo,
  legacy?: { warnings: string[]; errors: string[] },
): Promise<number> {
  const reportFailure = await writeReportIfRequested(
    invocation.reportJson,
    invocation.input,
    diagnostics,
  );
  if (reportFailure !== undefined) {
    diagnostics.push(reportFailure);
  }
  printDiagnostics(diagnostics, io, legacy);
  if (summarizeDiagnostics(diagnostics).errors > 0) {
    return EXIT_FAILURE;
  }
  io.out(`${invocation.input}: OK\n`);
  return EXIT_OK;
}

async function runServe(
  invocation: Extract<CliInvocation, { kind: 'serve' }>,
  io: CliIo,
): Promise<number> {
  const controller = new AbortController();
  let resolveTermination: (() => void) | undefined;
  const terminated = new Promise<void>((resolve) => {
    resolveTermination = resolve;
  });
  const handleSignal = (): void => {
    controller.abort(new Error('preview server received a shutdown signal'));
    resolveTermination?.();
  };
  process.once('SIGINT', handleSignal);
  process.once('SIGTERM', handleSignal);

  let preview: Awaited<ReturnType<typeof startPreviewServer>> | undefined;
  try {
    preview = await startPreviewServer({
      input: invocation.input,
      port: invocation.port,
      includeDiagnosticsSummary: invocation.includeDiagnosticsSummary === true,
      out: io.out,
      err: io.err,
      signal: controller.signal,
    });
    if (!controller.signal.aborted) {
      await terminated;
    }
    await preview.close();
    return EXIT_OK;
  } catch (error) {
    if (controller.signal.aborted) {
      return EXIT_OK;
    }
    io.err(`blueprint4llm: ${previewStartError(error, invocation.port)}\n`);
    return EXIT_FAILURE;
  } finally {
    process.off('SIGINT', handleSignal);
    process.off('SIGTERM', handleSignal);
    await preview?.close();
  }
}

function previewStartError(error: unknown, port: number): string {
  if (isErrorCode(error, 'EADDRINUSE')) {
    return `port ${port} is already in use on 127.0.0.1`;
  }
  return `cannot start preview server: ${errorMessage(error)}`;
}

function isErrorCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

async function runBuild(
  invocation: Extract<CliInvocation, { kind: 'build' }>,
  io: CliIo,
): Promise<number> {
  const sourceFile = path.resolve(invocation.input);
  const diagnostics: BlueprintDiagnostic[] = [];
  const outputs: Partial<Record<'html' | 'pdf' | 'svg' | 'png' | 'jpeg', string>> = {};
  const stdout: string[] = [];
  let legacy: { warnings: string[]; errors: string[] } | undefined;
  let markdown: string;
  try {
    markdown = await readFile(invocation.input, 'utf8');
  } catch (error) {
    diagnostics.push(
      diagnosticForError(
        new Error(`cannot read ${invocation.input}: ${errorMessage(error)}`),
        sourceFile,
        'document.read',
        'document',
      ),
    );
    return finishBuild(invocation, diagnostics, outputs, stdout, io);
  }

  let compiled: CompiledBlueprint;
  try {
    compiled = await compileMarkdown(markdown, {
      sourceFile,
      includeDiagnosticsSummary: invocation.includeDiagnosticsSummary === true,
      ...(invocation.format === 'svg' || invocation.format === 'png' || invocation.format === 'jpeg'
        ? { requireSingleDiagram: true }
        : {}),
    });
  } catch (error) {
    diagnostics.push(diagnosticForError(error, sourceFile, 'document.compile', 'document'));
    return finishBuild(invocation, diagnostics, outputs, stdout, io);
  }

  if (invocation.reportJson !== undefined && invocation.format === 'html') {
    const assetDirectory = path.join(path.dirname(path.resolve(invocation.outputFile)), 'assets');
    const assetPaths = compiled.assets.map((asset) => path.join(assetDirectory, asset.outputName));
    try {
      await assertReportPathAvailable(invocation.reportJson, sourceFile, invocation.outputFile, [
        assetDirectory,
        ...assetPaths,
      ]);
    } catch (error) {
      const message =
        error instanceof ReportPathConflictError
          ? error.message
          : `cannot validate --report-json path ${invocation.reportJson}: ${errorMessage(error)}`;
      io.err(`blueprint4llm: ${message}\n\n${USAGE}\n`);
      return EXIT_USAGE;
    }
  }

  diagnostics.push(...compilationDiagnostics(compiled, sourceFile));
  if (compiled.diagnostics === undefined) {
    legacy = { warnings: compiled.warnings, errors: compiled.errors ?? [] };
  }

  if (invocation.format === 'svg' || invocation.format === 'png' || invocation.format === 'jpeg') {
    if (summarizeDiagnostics(diagnostics).errors > 0) {
      return finishBuild(invocation, diagnostics, outputs, stdout, io, legacy);
    }
    let output: string | Uint8Array;
    try {
      output = await renderDiagramImage(compiled.html, invocation.format);
    } catch (error) {
      diagnostics.push(diagnosticForError(error, sourceFile, 'output.render', 'output'));
      return finishBuild(invocation, diagnostics, outputs, stdout, io, legacy);
    }

    try {
      const outputPath = await writeSingleOutput(invocation.outputFile, output);
      outputs[invocation.format] = outputPath;
      stdout.push(outputPath);
    } catch (error) {
      diagnostics.push(
        diagnosticForError(
          new Error(`cannot write output: ${errorMessage(error)}`),
          sourceFile,
          'output.write',
          'output',
        ),
      );
    }
    return finishBuild(invocation, diagnostics, outputs, stdout, io, legacy);
  }

  let pdf: Uint8Array | undefined;
  if (invocation.format === 'pdf') {
    try {
      pdf = await renderPdf(compiled);
    } catch (error) {
      diagnostics.push(diagnosticForError(error, sourceFile, 'output.render', 'output'));
      return finishBuild(invocation, diagnostics, outputs, stdout, io, legacy);
    }
  }

  try {
    const savedPaths = await writeBlueprintOutput(invocation.outputFile, {
      ...(invocation.format === 'pdf' ? {} : { html: compiled.html, assets: compiled.assets }),
      ...(pdf === undefined ? {} : { pdf }),
    });
    if (savedPaths.htmlPath !== undefined) {
      outputs.html = savedPaths.htmlPath;
      stdout.push(savedPaths.htmlPath);
    }
    if (savedPaths.pdfPath !== undefined) {
      outputs.pdf = savedPaths.pdfPath;
      stdout.push(savedPaths.pdfPath);
    }
  } catch (error) {
    diagnostics.push(
      diagnosticForError(
        new Error(`cannot write output: ${errorMessage(error)}`),
        sourceFile,
        'output.write',
        'output',
      ),
    );
  }
  return finishBuild(invocation, diagnostics, outputs, stdout, io, legacy);
}

async function finishBuild(
  invocation: Extract<CliInvocation, { kind: 'build' }>,
  diagnostics: BlueprintDiagnostic[],
  outputs: Partial<Record<'html' | 'pdf' | 'svg' | 'png' | 'jpeg', string>>,
  stdout: readonly string[],
  io: CliIo,
  legacy?: { warnings: string[]; errors: string[] },
): Promise<number> {
  for (const line of stdout) {
    io.out(`${line}\n`);
  }
  const reportFailure = await writeReportIfRequested(
    invocation.reportJson,
    invocation.input,
    diagnostics,
    outputs,
  );
  if (reportFailure !== undefined) {
    diagnostics.push(reportFailure);
  }
  printDiagnostics(diagnostics, io, legacy);
  return summarizeDiagnostics(diagnostics).errors > 0 ? EXIT_FAILURE : EXIT_OK;
}

function compilationDiagnostics(
  result: Pick<CompiledBlueprint, 'warnings' | 'errors' | 'diagnostics'>,
  sourceFile: string,
): BlueprintDiagnostic[] {
  if (result.diagnostics !== undefined) {
    return result.diagnostics.map((diagnostic) => ({ ...diagnostic }));
  }
  return [
    ...result.warnings.map((message): BlueprintDiagnostic => ({
      severity: 'warning',
      code: 'renderer.warning',
      scope: 'diagram',
      sourceFile,
      message,
    })),
    ...(result.errors ?? []).map((message): BlueprintDiagnostic => ({
      severity: 'error',
      code: 'diagram.render',
      scope: 'diagram',
      sourceFile,
      message,
    })),
  ];
}

function printDiagnostics(
  diagnostics: readonly BlueprintDiagnostic[],
  io: CliIo,
  legacy?: { warnings: string[]; errors: string[] },
): void {
  const legacyCount = legacy === undefined ? 0 : legacy.warnings.length + legacy.errors.length;
  if (legacy !== undefined) {
    for (const warning of legacy.warnings) {
      io.err(`blueprint4llm: warning: ${warning}\n`);
    }
    for (const error of legacy.errors) {
      io.err(`blueprint4llm: error: ${error}\n`);
    }
  }
  for (const diagnostic of diagnostics.slice(legacyCount)) {
    io.err(`blueprint4llm: ${formatDiagnostic(diagnostic)}\n`);
  }
  const summary = summarizeDiagnostics(diagnostics);
  io.err(`blueprint4llm: summary: ${summary.errors} error(s), ${summary.warnings} warning(s)\n`);
}

async function writeReportIfRequested(
  reportPath: string | undefined,
  sourceFile: string,
  diagnostics: readonly BlueprintDiagnostic[],
  outputs: Partial<Record<'html' | 'pdf' | 'svg' | 'png' | 'jpeg', string>> = {},
): Promise<BlueprintDiagnostic | undefined> {
  if (reportPath === undefined) {
    return undefined;
  }
  try {
    const report = createDiagnosticReport(sourceFile, diagnostics, outputs);
    await writeSingleOutput(reportPath, serializeDiagnosticReport(report));
    return undefined;
  } catch (error) {
    return diagnosticForError(
      new Error(`cannot write JSON report ${reportPath}: ${errorMessage(error)}`),
      sourceFile,
      'output.write',
      'output',
    );
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readPackageVersion(): string {
  try {
    const packageJsonPath = fileURLToPath(new URL('../package.json', import.meta.url));
    const json = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: string };
    return json.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }
  try {
    return pathToFileURL(realpathSync(entry)).href === import.meta.url;
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  process.exitCode = await main(process.argv.slice(2));
}
