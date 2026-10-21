import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runTests } from '@vscode/test-electron';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(testDirectory, '../..');
const extensionTestsPath = path.resolve(testDirectory, './suite/index.js');
const minimumHostVersion = process.env.BLUEPRINT4LLM_VSCODE_TEST_VERSION ?? '1.101.0';

void runTests({
  version: minimumHostVersion,
  extensionDevelopmentPath: extensionRoot,
  extensionTestsPath,
  launchArgs: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
}).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
