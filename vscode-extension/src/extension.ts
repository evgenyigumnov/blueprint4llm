import * as vscode from 'vscode';

type CompileMarkdown = (
  markdown: string,
  options: { sourceFile: string },
) => Promise<{ html: string }>;

/** Minimal activation entry used to validate the Node-based desktop host. */
export async function activate(
  context: vscode.ExtensionContext,
): Promise<{ hostNodeVersion: string; compileMarkdown: CompileMarkdown }> {
  const { compileMarkdown } = await import('blueprint4llm');
  const output = vscode.window.createOutputChannel('Blueprint4llm');
  output.appendLine(`Extension host Node.js ${process.versions.node}`);
  context.subscriptions.push(output);

  return { hostNodeVersion: process.versions.node, compileMarkdown };
}

export function deactivate(): void {}
