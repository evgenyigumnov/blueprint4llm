import * as assert from 'node:assert/strict';

import * as vscode from 'vscode';

type CompileMarkdown = (
  markdown: string,
  options: { sourceFile: string },
) => Promise<{ html: string }>;

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension<{
    hostNodeVersion: string;
    compileMarkdown: CompileMarkdown;
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
  console.log(
    `Extension Development Host Node.js ${hostNodeVersion}: runtime and core package loaded`,
  );
}
