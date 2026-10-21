import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { CompiledPreview, PreviewDiagnostic } from './preview-controller.js';

export interface PreviewWebview {
  readonly cspSource: string;
  asWebviewUri(filePath: string): string;
}

/** Writes compiled local images into an isolated render directory and returns CSP-protected HTML. */
export async function createPreviewHtml(
  compiled: CompiledPreview,
  webview: PreviewWebview,
  assetRoot: string,
  generation: number,
  isCurrent: () => boolean,
): Promise<{ html: string; assetDirectory: string } | undefined> {
  const assetDirectory = path.join(assetRoot, `render-${generation}`);
  if (!isCurrent()) {
    return undefined;
  }

  await rm(assetDirectory, { recursive: true, force: true });
  await mkdir(assetDirectory, { recursive: true });
  let html = compiled.html;

  for (const asset of compiled.assets) {
    if (!isCurrent()) {
      await rm(assetDirectory, { recursive: true, force: true });
      return undefined;
    }
    const filePath = path.join(assetDirectory, path.basename(asset.outputName));
    await writeFile(filePath, asset.bytes);
    const suffixIndex = [asset.outputUrl.indexOf('?'), asset.outputUrl.indexOf('#')]
      .filter((index) => index >= 0)
      .reduce((minimum, index) => Math.min(minimum, index), asset.outputUrl.length);
    const suffix = asset.outputUrl.slice(suffixIndex);
    const resourceUri = webview.asWebviewUri(filePath);
    html = html.split(asset.outputUrl).join(escapeHtml(`${resourceUri}${suffix}`));
  }

  if (!isCurrent()) {
    await rm(assetDirectory, { recursive: true, force: true });
    return undefined;
  }

  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} data: http: https:`,
    "style-src 'unsafe-inline'",
    "script-src 'none'",
    "connect-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
  const policyTag = `<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">`;
  html = html.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}\n${policyTag}`);
  return { html, assetDirectory };
}

/** Produces an escaped compile-error page that preserves the preview panel. */
export function createDiagnosticHtml(diagnostic: PreviewDiagnostic, cspSource: string): string {
  const csp = `default-src 'none'; style-src 'unsafe-inline'; img-src ${cspSource} data:; script-src 'none'; connect-src 'none';`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">
<title>Blueprint Preview Error</title>
<style>
body { margin: 0; padding: 2rem; color: var(--vscode-foreground); background: var(--vscode-editor-background); font: 14px/1.6 var(--vscode-font-family); }
h1 { font-size: 1.25rem; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; color: var(--vscode-errorForeground); }
</style>
</head>
<body>
<main>
<h1>Не удалось построить предпросмотр</h1>
<pre>${escapeHtml(diagnostic.format())}</pre>
<p>Исправьте документ. Предпросмотр обновится после следующего изменения.</p>
</main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return character;
    }
  });
}
