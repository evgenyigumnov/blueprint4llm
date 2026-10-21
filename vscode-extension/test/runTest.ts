import * as path from 'node:path';

import { runTests } from '@vscode/test-electron';

const extensionRoot = path.resolve(__dirname, '../..');
const extensionTestsPath = path.resolve(__dirname, './suite');
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
