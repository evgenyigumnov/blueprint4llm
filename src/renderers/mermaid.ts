import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

import { ConcurrencyLimiter } from './concurrency-limiter.js';
import { forceVerticalMermaidDirection } from './mermaid-direction.js';
import { withChromeSandboxFallback } from '../chrome-sandbox.js';
import { runCommandWithOutput } from './run-command.js';
import type { DiagramError, DiagramRenderer } from './types.js';

export const MERMAID_RENDER_TIMEOUT_MS = 30_000;
export const MAX_MERMAID_SOURCE_BYTES = 256 * 1024;
export const MAX_CONCURRENT_MERMAID_RENDERINGS = 2;

const limiter = new ConcurrencyLimiter(MAX_CONCURRENT_MERMAID_RENDERINGS);
const require = createRequire(import.meta.url);

interface MermaidRenderResult {
  svg: string;
  errors: DiagramError[];
}

/** Renders Mermaid fences with the project's local official Mermaid CLI. */
export const mermaidRenderer: DiagramRenderer = {
  name: 'mermaid',
  languages: ['mermaid'],
  cacheKey:
    'mermaid-cli@12.0.0;theme=default;background=transparent;security=strict;htmlLabels=false;direction=vertical-v1',

  async render(source, context) {
    const sourceBytes = Buffer.byteLength(source, 'utf8');
    if (sourceBytes > MAX_MERMAID_SOURCE_BYTES) {
      throw new Error(
        `diagram is too large: ${sourceBytes} bytes (limit ${MAX_MERMAID_SOURCE_BYTES} bytes)`,
      );
    }

    const result = await limiter.run(() =>
      renderInTemporaryDirectory(
        forceVerticalMermaidDirection(source),
        context.diagramId,
        context.signal,
      ),
    );
    return { svg: result.svg, warnings: [], errors: result.errors };
  },
};

async function renderInTemporaryDirectory(
  source: string,
  diagramId: string,
  signal?: AbortSignal,
): Promise<MermaidRenderResult> {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'blueprint4llm-mermaid-'));
  const inputPath = path.join(temporaryDirectory, 'diagram.mmd');
  const outputPath = path.join(temporaryDirectory, 'diagram.svg');
  const configPath = path.join(temporaryDirectory, 'mermaid-config.json');
  const puppeteerConfigPath = path.join(temporaryDirectory, 'puppeteer-config.json');
  const disableSandboxInitially = process.env.BLUEPRINT4LLM_DISABLE_CHROME_SANDBOX === '1';

  try {
    await Promise.all([
      writeFile(inputPath, source, 'utf8'),
      writeFile(
        configPath,
        JSON.stringify({
          theme: 'default',
          securityLevel: 'strict',
          htmlLabels: false,
          startOnLoad: false,
          er: { layoutDirection: 'TB' },
        }),
        'utf8',
      ),
    ]);

    const cliPath = resolveMermaidCliPath();
    const args = [
      cliPath,
      '--input',
      inputPath,
      '--output',
      outputPath,
      '--outputFormat',
      'svg',
      '--backgroundColor',
      'transparent',
      '--no-font-embed',
      '--quiet',
      '--configFile',
      configPath,
      '--svgId',
      diagramId,
    ];
    try {
      const output = await withChromeSandboxFallback(async (disableSandbox) => {
        if (disableSandbox) {
          await writeFile(puppeteerConfigPath, JSON.stringify({ args: ['--no-sandbox'] }), 'utf8');
        }
        return await runCommandWithOutput(
          process.execPath,
          disableSandbox ? [...args, '--puppeteerConfigFile', puppeteerConfigPath] : args,
          {
            cwd: temporaryDirectory,
            timeoutMs: MERMAID_RENDER_TIMEOUT_MS,
            ...(signal === undefined ? {} : { signal }),
          },
        );
      }, disableSandboxInitially);
      const svg = await readFile(outputPath, 'utf8');
      return { svg, errors: parseMermaidErrors(output.stderr) };
    } catch (error) {
      throw new Error(formatMermaidCliError(error, temporaryDirectory), { cause: error });
    }
  } catch (error) {
    if (isMissingBrowserError(error)) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}. Install the compatible browser with: npx puppeteer browsers install chrome`,
        { cause: error },
      );
    }
    throw error;
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

/** Parses syntax diagnostics written by the Mermaid CLI when it still emits an SVG. */
export function parseMermaidErrors(output: string): DiagramError[] {
  const text = output.trim();
  if (text.length === 0) {
    return [];
  }

  const errors: DiagramError[] = [];
  const parserErrorPattern = /(?:Parse|Lexical) error on line (\d+)(?:, column (\d+))?/gi;
  for (const match of text.matchAll(parserErrorPattern)) {
    const start = match.index;
    if (start === undefined) {
      continue;
    }
    const nextStackFrame = text.indexOf('\n    at ', start);
    const excerpt = text.slice(start, nextStackFrame < 0 ? undefined : nextStackFrame);
    const kind = /^Lexical/i.test(match[0]) ? 'Lexical' : 'Parse';
    const reason = excerpt.match(
      /(?:Expecting .+?got .+|Unexpected [^\r\n]+|Unrecognized text\.?)/i,
    )?.[0];
    const message =
      reason === undefined
        ? `${kind} error`
        : `${kind} error: ${reason.replaceAll(/\s+/g, ' ').trim()}`;
    errors.push({
      message,
      line: Number(match[1]),
      ...(match[2] === undefined ? {} : { column: Number(match[2]) }),
    });
  }
  if (errors.length > 0) {
    return errors;
  }

  for (const line of text.split(/\r?\n/)) {
    const message = line.trim();
    if (!/^(?:Error:|UnknownDiagramError:|Syntax error\b|Mermaid error:)/i.test(message)) {
      continue;
    }
    const location = message.match(/\bline (\d+)(?:, column (\d+))?/i);
    errors.push({
      message: message.replace(/^Error:\s*/i, ''),
      ...(location === null ? {} : { line: Number(location[1]) }),
      ...(location?.[2] === undefined ? {} : { column: Number(location[2]) }),
    });
  }
  return errors;
}

function resolveMermaidCliPath(): string {
  let packageEntryPath: string;
  try {
    packageEntryPath = require.resolve('@mermaid-js/mermaid-cli');
  } catch (error) {
    throw new Error('the local @mermaid-js/mermaid-cli package could not be resolved', {
      cause: error,
    });
  }
  return path.join(path.dirname(packageEntryPath), 'cli.js');
}

function formatMermaidCliError(error: unknown, temporaryDirectory: string): string {
  const message = (error instanceof Error ? error.message : String(error)).replaceAll(
    temporaryDirectory,
    '<temporary diagram directory>',
  );
  if (/no usable sandbox|without --no-sandbox/i.test(message)) {
    return `${message}. Chromium could not start even after an automatic retry with --no-sandbox`;
  }
  return message;
}

function isMissingBrowserError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return /could not find (?:chrome|chromium)|browser .*was not found/i.test(error.message);
}

/** Exposed for focused process diagnostics tests; runtime selection stays local. */
export function isMermaidCliAvailable(): boolean {
  const result = spawnSync(process.execPath, [resolveMermaidCliPath(), '--version'], {
    encoding: 'utf8',
    timeout: 5_000,
  });
  return result.status === 0;
}
