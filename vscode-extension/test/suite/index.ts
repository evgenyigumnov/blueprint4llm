import * as assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import * as vscode from 'vscode';

import { runPreviewControllerTests } from './preview-controller.test.js';
import { runWebviewHtmlTests } from './webview-html.test.js';

const OPEN_PREVIEW_COMMAND = 'blueprint4llm.openPreview';

type CompileMarkdown = (
  markdown: string,
  options: { sourceFile: string },
) => Promise<{ html: string }>;

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension<{
    hostNodeVersion: string;
    compileMarkdown: CompileMarkdown;
    getPreviewCount(): number;
  }>('blueprint4llm.blueprint4llm-vscode');
  assert.ok(extension, 'extension is available in the Extension Development Host');

  const { hostNodeVersion } = await extension.activate();
  assert.equal(hostNodeVersion, process.versions.node);
  const compiled = await extension.exports.compileMarkdown('# Host smoke check', {
    sourceFile: '/tmp/blueprint4llm-host-smoke.md',
  });
  assert.match(compiled.html, /<h1>Host smoke check<\/h1>/);

  const [major, minor] = hostNodeVersion.split('.').map(Number);
  assert.ok(
    major !== undefined && minor !== undefined && (major > 22 || (major === 22 && minor >= 13)),
    `Extension Development Host must run Node.js >=22.13.0; got ${hostNodeVersion}`,
  );

  await runPreviewControllerTests();
  await runWebviewHtmlTests();
  await testPreviewCommand(extension.exports);

  console.log(
    `Extension Development Host Node.js ${hostNodeVersion}: preview command, controller, Webview HTML, and core package passed`,
  );
}

async function testPreviewCommand(extension: { getPreviewCount(): number }): Promise<void> {
  const registeredCommands = await vscode.commands.getCommands(true);
  assert.ok(registeredCommands.includes(OPEN_PREVIEW_COMMAND));

  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'blueprint-extension-test-'));
  const sourceFile = path.join(temporaryDirectory, 'preview.md');
  try {
    await writeFile(sourceFile, '# Command smoke check\n');
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(sourceFile));
    await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
    await vscode.commands.executeCommand(OPEN_PREVIEW_COMMAND);
    assert.equal(extension.getPreviewCount(), 1);
    await vscode.commands.executeCommand(OPEN_PREVIEW_COMMAND);
    assert.equal(extension.getPreviewCount(), 1, 'repeated command reuses the existing panel');

    await new Promise<void>((resolve) => setTimeout(resolve, 300));
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
