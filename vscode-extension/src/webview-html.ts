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
  html = html.replace(
    /<head(?:\s[^>]*)?>/i,
    (head) => `${head}\n${policyTag}\n<style>${PREVIEW_THEME_CSS}</style>`,
  );
  return { html, assetDirectory };
}

/** Produces an escaped compile-error page that preserves the preview panel. */
export function createDiagnosticHtml(
  diagnostic: PreviewDiagnostic,
  cspSource: string,
  includeDiagnosticsSummary = false,
): string {
  const csp = `default-src 'none'; style-src 'unsafe-inline'; img-src ${cspSource} data:; script-src 'none'; connect-src 'none';`;
  const summary = includeDiagnosticsSummary
    ? '<section class="bp-diagnostics-summary" role="status" aria-live="polite" aria-atomic="true">Document check: 1 error · 0 warnings</section>'
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">
<title>Blueprint Preview Error</title>
<style>
body { margin: 0; min-height: 100vh; padding: 2rem; color: var(--vscode-editor-foreground, var(--vscode-foreground, #1f2328)); background: var(--vscode-editor-background, #fff); font: 14px/1.6 var(--vscode-font-family, system-ui, sans-serif); }
h1 { font-size: 1.25rem; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; color: var(--vscode-editor-foreground, #1f2328); background: var(--vscode-editor-background, #fff); border: 1px solid var(--vscode-contrastBorder, var(--vscode-editorWidget-border, currentColor)); padding: 1rem; }
.bp-diagnostics-summary { padding: .75rem 1rem; border: 2px solid var(--vscode-errorForeground, #b42318); border-inline-start-width: 6px; font-weight: 600; }
body.vscode-high-contrast { border: 1px solid var(--vscode-contrastBorder, currentColor); }
</style>
</head>
<body>
<main>
${summary}
<h1>Не удалось построить предпросмотр</h1>
<pre>${escapeHtml(diagnostic.format())}</pre>
<p>Исправьте документ. Предпросмотр обновится после следующего изменения.</p>
</main>
</body>
</html>`;
}

const PREVIEW_THEME_CSS = `
body.vscode-light,
body.vscode-dark,
body.vscode-high-contrast {
  --bp-text: var(--vscode-editor-foreground, #1f2328);
  --bp-muted: var(--vscode-descriptionForeground, var(--vscode-editor-foreground, #656d76));
  --bp-border: var(--vscode-editorWidget-border, var(--vscode-contrastBorder, #d0d7de));
  --bp-surface: var(--vscode-editor-background, #ffffff);
  --bp-page-bg: var(--vscode-editor-background, #f6f8fa);
  --bp-accent: var(--vscode-textLink-foreground, #0a5bd3);
  --bp-code-bg: var(--vscode-textCodeBlock-background, var(--vscode-editor-background, #f6f8fa));
  --bp-diagnostic-error: var(--vscode-errorForeground, #b42318);
  --bp-diagnostic-warning: var(--vscode-editorWarning-foreground, var(--vscode-editor-foreground, #7a4b00));
  --bp-diagnostic-error-bg: var(--vscode-editor-background, #ffffff);
  --bp-diagnostic-warning-bg: var(--vscode-editor-background, #ffffff);
  font-family: var(--vscode-font-family, system-ui, sans-serif);
}

body.vscode-light {
  color-scheme: light;
}

body.vscode-dark,
body.vscode-high-contrast {
  color-scheme: dark;
}

body.vscode-high-contrast {
  --bp-border: var(--vscode-contrastBorder, var(--vscode-editorWidget-border, currentColor));
}

a:focus-visible {
  outline: 1px solid var(--vscode-focusBorder, var(--vscode-contrastActiveBorder, currentColor));
  outline-offset: 2px;
}

body.vscode-dark .bp-diagram > svg,
body.vscode-high-contrast .bp-diagram > svg {
  filter: invert(1) hue-rotate(180deg);
}
`;

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
