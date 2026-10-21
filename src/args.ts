import { Command, CommanderError, InvalidArgumentError } from 'commander';

export type OutputFormat = 'html' | 'pdf';

export type CliInvocation =
  | { kind: 'help' }
  | { kind: 'version' }
  | { kind: 'check'; input: string }
  | { kind: 'build'; input: string; outputFile: string; format: OutputFormat }
  | { kind: 'serve'; input: string; port: number };

/** Wrong combination of arguments: usage is shown, process exits with code 2. */
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

export const DEFAULT_PORT = 8080;

/** Usage text shown for `--help` and for usage errors (plan §2.3). */
export const USAGE = `Usage:
  blueprint4llm <input.md> --out=<file> [--format=html|pdf]
  blueprint4llm <input.md> --serve [--port=<1..65535>]
  blueprint4llm <input.md> --check
  blueprint4llm --help
  blueprint4llm --version

Options:
  --out <file>         write output to <file> (required unless --serve or --check)
  --format <format>    html | pdf, default: html; only with --out
  --serve              run a local preview server with live reload (no --out)
  --port <port>        server port 1..65535, default: ${DEFAULT_PORT}; only with --serve
  --check              validate Markdown, diagrams, and local images without writing output
  -h, --help           display help
  -V, --version        display version`;

const FORMATS: readonly OutputFormat[] = ['html', 'pdf'];

/**
 * Parses and validates CLI arguments.
 *
 * Commander is used as a typed parser only: all output (help, errors, usage)
 * is owned by `cli.ts`, which keeps this function silent and testable.
 *
 * @throws {UsageError} on any invalid or conflicting arguments
 */
export function parseCliArgs(argv: readonly string[]): CliInvocation {
  const program = new Command();
  program
    .name('blueprint4llm')
    .description('Generate standalone HTML/PDF blueprints from Markdown with diagrams')
    .version('0.0.0')
    .argument('<input.md>', 'path to the source Markdown file')
    .option('--out <file>', 'write output file to <file>')
    .option('--format <format>', 'html | pdf', parseFormat, 'html')
    .option('--serve', 'run a local preview server with live reload')
    .option('--port <port>', `server port 1..65535 (default: ${DEFAULT_PORT})`, parsePort)
    .option('--check', 'validate Markdown, diagrams, and local images without writing output')
    .showHelpAfterError(false)
    .showSuggestionAfterError(true)
    .configureOutput({ writeOut: () => undefined, writeErr: () => undefined })
    .exitOverride();

  try {
    program.parse([...argv], { from: 'user' });
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.code === 'commander.helpDisplayed' || error.code.startsWith('commander.help')) {
        return { kind: 'help' };
      }
      if (error.code === 'commander.version') {
        return { kind: 'version' };
      }
      throw new UsageError(error.message);
    }
    throw error;
  }

  const options = program.opts<{
    out?: string;
    format: OutputFormat;
    serve?: boolean;
    port?: number;
    check?: boolean;
  }>();
  const args = program.processedArgs as [string | undefined];
  const input = args[0];
  if (input === undefined) {
    throw new UsageError("missing required argument 'input.md'");
  }

  const outSpecified = wasProvided(program, 'out');
  const serveSpecified = wasProvided(program, 'serve');
  const portSpecified = wasProvided(program, 'port');
  const formatSpecified = wasProvided(program, 'format');
  const checkSpecified = wasProvided(program, 'check');

  if (checkSpecified && outSpecified) {
    throw new UsageError('--out and --check are mutually exclusive');
  }
  if (checkSpecified && serveSpecified) {
    throw new UsageError('--check and --serve are mutually exclusive');
  }
  if (checkSpecified && formatSpecified) {
    throw new UsageError('--format cannot be used with --check');
  }
  if (checkSpecified && portSpecified) {
    throw new UsageError('--port cannot be used with --check');
  }

  if (options.serve === true && outSpecified) {
    throw new UsageError('--out and --serve are mutually exclusive');
  }
  if (!serveSpecified && !outSpecified && !checkSpecified) {
    throw new UsageError('one of --out, --serve, or --check is required');
  }
  if (serveSpecified && formatSpecified) {
    throw new UsageError('--format cannot be used with --serve (PDF is served at /document.pdf)');
  }
  if (!serveSpecified && portSpecified) {
    throw new UsageError('--port requires --serve');
  }

  if (serveSpecified) {
    return { kind: 'serve', input, port: options.port ?? DEFAULT_PORT };
  }
  if (checkSpecified) {
    return { kind: 'check', input };
  }
  return { kind: 'build', input, outputFile: options.out ?? '', format: options.format };
}

function wasProvided(program: Command, name: string): boolean {
  return program.getOptionValueSource(name) === 'cli';
}

function parseFormat(value: string): OutputFormat {
  if (!(FORMATS as readonly string[]).includes(value)) {
    throw new InvalidArgumentError(`format must be one of: ${FORMATS.join(', ')}`);
  }
  return value as OutputFormat;
}

function parsePort(value: string): number {
  if (!/^\d{1,5}$/.test(value)) {
    throw new InvalidArgumentError('port must be an integer between 1 and 65535');
  }
  const port = Number(value);
  if (port < 1 || port > 65535) {
    throw new InvalidArgumentError('port must be an integer between 1 and 65535');
  }
  return port;
}
