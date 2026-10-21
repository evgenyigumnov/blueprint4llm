import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** Resolves the first non-empty token from options, process environment, and the current `.env`. */
export async function resolveFigmaAccessToken(
  optionToken?: string,
  environment: NodeJS.ProcessEnv = process.env,
  workingDirectory = process.cwd(),
): Promise<string | undefined> {
  const explicitToken = normalizeToken(optionToken);
  if (explicitToken !== undefined) {
    return explicitToken;
  }

  const environmentToken = normalizeToken(environment.FIGMA_ACCESS_TOKEN);
  if (environmentToken !== undefined) {
    return environmentToken;
  }

  try {
    const envFile = await readFile(path.join(workingDirectory, '.env'), 'utf8');
    return readTokenFromEnvFile(envFile);
  } catch {
    return undefined;
  }
}

function readTokenFromEnvFile(contents: string): string | undefined {
  let token: string | undefined;

  for (const sourceLine of contents.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?FIGMA_ACCESS_TOKEN\s*=\s*(.*?)\s*$/.exec(sourceLine);
    if (match?.[1] === undefined) {
      continue;
    }

    token = normalizeToken(parseEnvValue(match[1]));
  }

  return token;
}

function parseEnvValue(source: string): string {
  const value = source.trim();
  const doubleQuoted = /^"([\s\S]*)"(?:\s*#.*)?$/.exec(value);
  if (doubleQuoted?.[1] !== undefined) {
    return unescapeDoubleQuotedValue(doubleQuoted[1]);
  }

  const singleQuoted = /^'([\s\S]*)'(?:\s*#.*)?$/.exec(value);
  if (singleQuoted?.[1] !== undefined) {
    return singleQuoted[1];
  }

  return value.replace(/\s+#.*$/, '').trim();
}

function unescapeDoubleQuotedValue(value: string): string {
  return value.replace(/\\([\\"nrt])/g, (_match, escape: string) => {
    switch (escape) {
      case 'n':
        return '\n';
      case 'r':
        return '\r';
      case 't':
        return '\t';
      default:
        return escape;
    }
  });
}

function normalizeToken(token: string | undefined): string | undefined {
  const normalized = token?.trim();
  return normalized === undefined || normalized.length === 0 ? undefined : normalized;
}
