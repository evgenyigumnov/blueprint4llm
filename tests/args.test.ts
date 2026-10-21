import { describe, expect, it } from 'vitest';

import { DEFAULT_PORT, parseCliArgs, UsageError } from '../src/args.js';

describe('parseCliArgs', () => {
  it('parses the default HTML build command with paths containing spaces', () => {
    expect(parseCliArgs(['проект/blue print.md', '--out=готовый документ'])).toEqual({
      kind: 'build',
      input: 'проект/blue print.md',
      outputFile: 'готовый документ',
      format: 'html',
    });
  });

  it.each(['html', 'pdf'] as const)('accepts the %s output format', (format) => {
    expect(parseCliArgs(['input.md', '--out', 'out', '--format', format])).toMatchObject({
      kind: 'build',
      format,
    });
  });

  it('parses serve mode with the default and explicit valid ports', () => {
    expect(parseCliArgs(['input.md', '--serve'])).toEqual({
      kind: 'serve',
      input: 'input.md',
      port: DEFAULT_PORT,
    });
    expect(parseCliArgs(['input.md', '--serve', '--port', '65535'])).toEqual({
      kind: 'serve',
      input: 'input.md',
      port: 65535,
    });
    expect(parseCliArgs(['input.md', '--serve', '--port', '1'])).toMatchObject({ port: 1 });
  });

  it('parses check mode without an output path', () => {
    expect(parseCliArgs(['input.md', '--check'])).toEqual({ kind: 'check', input: 'input.md' });
  });

  it('handles help and version without requiring an input file', () => {
    expect(parseCliArgs(['--help'])).toEqual({ kind: 'help' });
    expect(parseCliArgs(['--version'])).toEqual({ kind: 'version' });
  });

  it.each(
    [
      [],
      ['input.md'],
      ['input.md', '--check', '--out', 'out'],
      ['input.md', '--check', '--serve'],
      ['input.md', '--check', '--format', 'html'],
      ['input.md', '--check', '--port', '8080'],
      ['input.md', '--out', 'out', '--serve'],
      ['input.md', '--serve', '--format', 'html'],
      ['input.md', '--out', 'out', '--port', '8080'],
      ['input.md', '--out', 'out', '--format', 'xml'],
      ['input.md', '--out', 'out', '--format', 'both'],
      ['input.md', '--serve', '--port', '0'],
      ['input.md', '--serve', '--port', '65536'],
      ['input.md', '--serve', '--port', '1.5'],
      ['input.md', '--serve', '--port', 'abc'],
      ['input.md', '--out', 'out', '--unknown'],
    ].map((argv) => ({ argv })),
  )('rejects invalid arguments: %j', ({ argv }) => {
    expect(() => parseCliArgs(argv)).toThrow(UsageError);
  });
});
