import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveFigmaAccessToken } from '../src/renderers/figma-token.js';

describe('resolveFigmaAccessToken', () => {
  it('uses the option before the environment and `.env` values', async () => {
    const workingDirectory = await createEnvDirectory('FIGMA_ACCESS_TOKEN=file-token\n');
    try {
      await expect(
        resolveFigmaAccessToken(
          ' option-token ',
          { FIGMA_ACCESS_TOKEN: 'environment-token' },
          workingDirectory,
        ),
      ).resolves.toBe('option-token');
      await expect(
        resolveFigmaAccessToken(
          undefined,
          { FIGMA_ACCESS_TOKEN: ' environment-token ' },
          workingDirectory,
        ),
      ).resolves.toBe('environment-token');
      await expect(resolveFigmaAccessToken(undefined, {}, workingDirectory)).resolves.toBe(
        'file-token',
      );
    } finally {
      await rm(workingDirectory, { recursive: true, force: true });
    }
  });

  it('reads exported, quoted `.env` values and ignores trailing comments', async () => {
    const workingDirectory = await createEnvDirectory(
      '\uFEFF# local credentials\nexport FIGMA_ACCESS_TOKEN=" file-token # retained " # comment\n',
    );
    try {
      await expect(resolveFigmaAccessToken(undefined, {}, workingDirectory)).resolves.toBe(
        'file-token # retained',
      );
    } finally {
      await rm(workingDirectory, { recursive: true, force: true });
    }
  });

  it('returns no token for blank values or a missing `.env` file', async () => {
    const workingDirectory = await mkdtemp(path.join(os.tmpdir(), 'blueprint-figma-token-'));
    try {
      await expect(
        resolveFigmaAccessToken('  ', { FIGMA_ACCESS_TOKEN: '  ' }, workingDirectory),
      ).resolves.toBeUndefined();
    } finally {
      await rm(workingDirectory, { recursive: true, force: true });
    }
  });
});

async function createEnvDirectory(contents: string): Promise<string> {
  const workingDirectory = await mkdtemp(path.join(os.tmpdir(), 'blueprint-figma-token-'));
  await writeFile(path.join(workingDirectory, '.env'), contents, 'utf8');
  return workingDirectory;
}
