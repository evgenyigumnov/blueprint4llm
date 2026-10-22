#!/usr/bin/env node
import { readFileSync, realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parseCliArgs, UsageError, USAGE } from './args.js';
import type { CliInvocation } from './args.js';
import { writeBlueprintOutput, writeSingleOutput } from './build.js';
import { checkMarkdown, compileMarkdown } from './compiler.js';
import type { CompiledBlueprint } from './compiler.js';
import { toDiagnosticError } from './errors.js';
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
  let markdown: string;
  try {
    markdown = await readFile(invocation.input, 'utf8');
  } catch (error) {
    io.err(`blueprint4llm: cannot read ${invocation.input}: ${errorMessage(error)}\n`);
    return EXIT_FAILURE;
  }

  let result: Awaited<ReturnType<typeof checkMarkdown>>;
  try {
    result = await checkMarkdown(markdown, { sourceFile: invocation.input });
  } catch (error) {
    const diagnostic = toDiagnosticError(error, 'Markdown check failed', {
      sourceFile: invocation.input,
    });
    io.err(`blueprint4llm: ${diagnostic.format()}\n`);
    return EXIT_FAILURE;
  }

  for (const warning of result.warnings) {
    io.err(`blueprint4llm: warning: ${warning}\n`);
  }
  for (const error of result.errors) {
    io.err(`blueprint4llm: error: ${error}\n`);
  }
  if (result.errors.length > 0) {
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
  let markdown: string;
  try {
    markdown = await readFile(invocation.input, 'utf8');
  } catch (error) {
    io.err(`blueprint4llm: cannot read ${invocation.input}: ${errorMessage(error)}\n`);
    return EXIT_FAILURE;
  }

  let compiled: CompiledBlueprint;
  try {
    compiled = await compileMarkdown(markdown, {
      sourceFile: invocation.input,
      ...(invocation.format === 'svg' || invocation.format === 'png' || invocation.format === 'jpeg'
        ? { requireSingleDiagram: true }
        : {}),
    });
  } catch (error) {
    const diagnostic = toDiagnosticError(error, 'render failed', {
      sourceFile: invocation.input,
    });
    io.err(`blueprint4llm: ${diagnostic.format()}\n`);
    return EXIT_FAILURE;
  }

  for (const warning of compiled.warnings) {
    io.err(`blueprint4llm: warning: ${warning}\n`);
  }
  for (const error of compiled.errors ?? []) {
    io.err(`blueprint4llm: error: ${error}\n`);
  }

  if (invocation.format === 'svg' || invocation.format === 'png' || invocation.format === 'jpeg') {
    let output: string | Uint8Array;
    try {
      output = await renderDiagramImage(compiled.html, invocation.format);
    } catch (error) {
      const diagnostic = toDiagnosticError(error, 'diagram image render failed', {
        sourceFile: invocation.input,
      });
      io.err(`blueprint4llm: ${diagnostic.format()}\n`);
      return EXIT_FAILURE;
    }

    try {
      const outputPath = await writeSingleOutput(invocation.outputFile, output);
      io.out(`${outputPath}\n`);
      return EXIT_OK;
    } catch (error) {
      io.err(`blueprint4llm: cannot write output: ${errorMessage(error)}\n`);
      return EXIT_FAILURE;
    }
  }

  let pdf: Uint8Array | undefined;
  if (invocation.format === 'pdf') {
    try {
      pdf = await renderPdf(compiled);
    } catch (error) {
      const diagnostic = toDiagnosticError(error, 'PDF render failed', {
        sourceFile: invocation.input,
      });
      io.err(`blueprint4llm: ${diagnostic.format()}\n`);
      return EXIT_FAILURE;
    }
  }

  try {
    const outputs = await writeBlueprintOutput(invocation.outputFile, {
      ...(invocation.format === 'pdf' ? {} : { html: compiled.html, assets: compiled.assets }),
      ...(pdf === undefined ? {} : { pdf }),
    });
    if (outputs.htmlPath !== undefined) {
      io.out(`${outputs.htmlPath}\n`);
    }
    if (outputs.pdfPath !== undefined) {
      io.out(`${outputs.pdfPath}\n`);
    }
    return EXIT_OK;
  } catch (error) {
    io.err(`blueprint4llm: cannot write output: ${errorMessage(error)}\n`);
    return EXIT_FAILURE;
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
