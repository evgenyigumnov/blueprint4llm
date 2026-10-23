import * as assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { PreviewDiagnosticError } from '../../src/preview-controller.js';
import { createDiagnosticHtml, createPreviewHtml } from '../../src/webview-html.js';

export async function runWebviewHtmlTests(): Promise<void> {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'blueprint-webview-test-'));
  try {
    await testLocalAssetsAndContentSecurityPolicy(temporaryRoot);
    await testStaleRenderIsDiscarded(temporaryRoot);
    testDiagnosticTextIsEscaped();
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function testLocalAssetsAndContentSecurityPolicy(temporaryRoot: string): Promise<void> {
  const assetRoot = path.join(temporaryRoot, 'assets');
  const outputUrl = 'assets/image.png?width=2';
  const result = await createPreviewHtml(
    {
      html: `<!doctype html><html><head></head><body><img src="${outputUrl}"></body></html>`,
      title: 'Preview',
      assets: [
        {
          originalUrl: 'image.png',
          outputUrl,
          outputName: 'image.png',
          sourcePath: '/docs/image.png',
          bytes: Buffer.from('image bytes'),
          mimeType: 'image/png',
        },
      ],
      warnings: [],
    },
    {
      cspSource: 'vscode-webview://test',
      asWebviewUri: (filePath) => `vscode-webview://test/${path.basename(filePath)}`,
    },
    assetRoot,
    1,
    () => true,
  );

  assert.ok(result);
  assert.match(result.html, /Content-Security-Policy/);
  assert.match(result.html, /script-src &#39;none&#39;/);
  assert.match(result.html, /vscode-webview:\/\/test\/image\.png\?width=2/);
  assert.match(
    result.html,
    /body\.vscode-light[\s\S]*body\.vscode-dark[\s\S]*body\.vscode-high-contrast/,
  );
  assert.match(result.html, /--bp-text: var\(--vscode-editor-foreground/);
  assert.match(result.html, /--bp-muted: var\(--vscode-descriptionForeground/);
  assert.match(result.html, /--vscode-contrastBorder/);
  assert.match(result.html, /--bp-surface: var\(--vscode-editor-background/);
  assert.match(result.html, /--bp-page-bg: var\(--vscode-editor-background/);
  assert.match(result.html, /--bp-accent: var\(--vscode-textLink-foreground/);
  assert.match(result.html, /--bp-code-bg: var\(--vscode-textCodeBlock-background/);
  assert.match(result.html, /--bp-diagnostic-error: var\(--vscode-errorForeground/);
  assert.match(result.html, /--bp-diagnostic-warning: var\(--vscode-editorWarning-foreground/);
  assert.match(result.html, /body\.vscode-light \{\s*color-scheme: light;/);
  assert.match(result.html, /body\.vscode-dark,[\s\S]*color-scheme: dark;/);
  assert.match(result.html, /filter: invert\(1\) hue-rotate\(180deg\)/);
  assert.match(
    result.html,
    /\.bp-diagram:not\(\.bp-diagram--vega-lite\):not\(\.bp-diagram--echarts\):not\(\.bp-diagram--d2\):not\(\.bp-diagram--excalidraw\) > svg/,
  );
  assert.doesNotMatch(result.html, new RegExp(outputUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(
    await readFile(path.join(result.assetDirectory, 'image.png'), 'utf8'),
    'image bytes',
  );
}

async function testStaleRenderIsDiscarded(temporaryRoot: string): Promise<void> {
  const assetRoot = path.join(temporaryRoot, 'stale-assets');
  const result = await createPreviewHtml(
    { html: '<html><head></head><body></body></html>', title: 'Preview', assets: [], warnings: [] },
    { cspSource: 'vscode-webview://test', asWebviewUri: (filePath) => filePath },
    assetRoot,
    2,
    () => false,
  );
  assert.equal(result, undefined);
  await assert.rejects(stat(assetRoot));
}

function testDiagnosticTextIsEscaped(): void {
  const diagnostic = new PreviewDiagnosticError('<script>alert("x")</script>', {
    sourceFile: '/docs/<bad>.md',
    line: 4,
  });
  const defaultHtml = createDiagnosticHtml(diagnostic, 'vscode-webview://test');
  const html = createDiagnosticHtml(diagnostic, 'vscode-webview://test', true);

  assert.doesNotMatch(defaultHtml, /Document check:/);
  assert.match(html, /script-src &#39;none&#39;/);
  assert.match(html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;bad&gt;\.md:4:1/);
  assert.match(html, /Document check: 1 error · 0 warnings/);
  assert.match(html, /body\.vscode-high-contrast/);
  assert.match(html, /var\(--vscode-editor-foreground/);
}
