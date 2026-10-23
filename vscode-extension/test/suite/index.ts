import * as assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import * as vscode from 'vscode';

import { runPreviewControllerTests } from './preview-controller.test.js';
import { runPdfExportTests } from './pdf-export.test.js';
import { runWebviewHtmlTests } from './webview-html.test.js';

const OPEN_PREVIEW_COMMAND = 'blueprint4llm.openPreview';
const EXPORT_PDF_COMMAND = 'blueprint4llm.exportPdf';

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
  const drawio = await extension.exports.compileMarkdown(
    `\`\`\`drawio\n${JSON.stringify({
      version: '26.0',
      pages: [
        {
          id: 'page-1',
          name: 'Extension preview',
          cells: [
            { id: 'layer', type: 'layer' },
            { id: 'start', type: 'node', parent: 'layer', label: 'Preview start' },
          ],
        },
      ],
    })}\n\`\`\``,
    { sourceFile: '/tmp/blueprint4llm-drawio-host-smoke.md' },
  );
  assert.match(drawio.html, /class="bp-diagram bp-diagram--drawio"/);
  const pencil = await extension.exports.compileMarkdown(
    [
      '```pencil',
      JSON.stringify({
        version: '2.21',
        children: [
          {
            id: 'frame',
            type: 'frame',
            width: 120,
            height: 36,
            layout: 'none',
            children: [
              {
                id: 'label',
                type: 'text',
                x: 4,
                y: 4,
                width: 112,
                height: 28,
                content: 'Extension Pencil preview',
                fill: '#202124',
              },
            ],
          },
        ],
      }),
      '```',
    ].join('\n'),
    { sourceFile: '/tmp/blueprint4llm-pencil-host-smoke.md' },
  );
  assert.match(pencil.html, /class="bp-diagram bp-diagram--pencil"/);
  assert.match(pencil.html, /Extension Pencil preview/);
  const openapi = await extension.exports.compileMarkdown(
    [
      '```openapi',
      'openapi: 3.1.1',
      'info: { title: Extension API, version: "1" }',
      'paths:',
      '  /orders:',
      '    get: { responses: { default: { description: ready } } }',
      '```',
    ].join('\n'),
    { sourceFile: '/tmp/blueprint4llm-openapi-host-smoke.md' },
  );
  assert.match(openapi.html, /class="bp-diagram bp-diagram--openapi"/);
  assert.match(openapi.html, /<tspan[^>]*>GET<\/tspan>/);
  assert.match(openapi.html, /<tspan[^>]*>\/orders<\/tspan>/);
  assert.doesNotMatch(openapi.html, /Document check:/);
  const vegaLite = await extension.exports.compileMarkdown(
    [
      '```vega-lite',
      JSON.stringify({
        data: {
          values: [
            { environment: 'Dev', latency: 85 },
            { environment: 'Prod', latency: 95 },
          ],
        },
        mark: 'bar',
        encoding: {
          x: { field: 'environment', type: 'nominal' },
          y: { field: 'latency', type: 'quantitative' },
        },
      }),
      '```',
    ].join('\n'),
    { sourceFile: '/tmp/blueprint4llm-vega-lite-host-smoke.md' },
  );
  assert.match(vegaLite.html, /class="bp-diagram bp-diagram--vega-lite"/);
  assert.match(vegaLite.html, /<svg[^>]*width="\d+"[^>]*height="\d+"/);
  assert.match(vegaLite.html, /Dev/);
  assert.match(vegaLite.html, /Prod/);
  const echarts = await extension.exports.compileMarkdown(
    [
      '```echarts width=640 height=360',
      JSON.stringify({
        xAxis: { type: 'category', data: ['One', 'Two'] },
        yAxis: { type: 'value' },
        series: [{ type: 'bar', data: [4, 7] }],
      }),
      '```',
    ].join('\n'),
    { sourceFile: '/tmp/blueprint4llm-echarts-host-smoke.md' },
  );
  assert.match(echarts.html, /class="bp-diagram bp-diagram--echarts"/);
  assert.match(echarts.html, /<svg width="640" height="360"/);
  assert.doesNotMatch(echarts.html, /Document check:/);
  const d2 = await extension.exports.compileMarkdown(
    [
      '```d2',
      'direction: right',
      'client: Клиент',
      'service: API заказов',
      'client -> service: создать заказ',
      '```',
    ].join('\n'),
    { sourceFile: '/tmp/blueprint4llm-d2-host-smoke.md' },
  );
  assert.match(d2.html, /class="bp-diagram bp-diagram--d2"/);
  assert.match(d2.html, /<svg[^>]*width="\d+"[^>]*height="\d+"/);
  assert.match(d2.html, /Клиент/);
  assert.doesNotMatch(d2.html, /Document check:/);

  const previewSettings = vscode.workspace.getConfiguration('blueprint4llm.preview');
  await previewSettings.update(
    'includeDiagnosticsSummary',
    true,
    vscode.ConfigurationTarget.Global,
  );
  try {
    const summary = await extension.exports.compileMarkdown('# Summary setting check', {
      sourceFile: '/tmp/blueprint4llm-summary-host-smoke.md',
    });
    assert.match(summary.html, /Document check: 0 errors · 0 warnings/);
  } finally {
    await previewSettings.update(
      'includeDiagnosticsSummary',
      false,
      vscode.ConfigurationTarget.Global,
    );
  }

  const [major, minor] = hostNodeVersion.split('.').map(Number);
  assert.ok(
    major !== undefined && minor !== undefined && (major > 22 || (major === 22 && minor >= 13)),
    `Extension Development Host must run Node.js >=22.13.0; got ${hostNodeVersion}`,
  );

  await runPreviewControllerTests();
  await runPdfExportTests();
  await runWebviewHtmlTests();
  await testPreviewCommand(extension.exports);

  console.log(
    `Extension Development Host Node.js ${hostNodeVersion}: preview and PDF export commands, controller, Webview HTML, and core package passed`,
  );
}

async function testPreviewCommand(extension: { getPreviewCount(): number }): Promise<void> {
  const registeredCommands = await vscode.commands.getCommands(true);
  assert.ok(registeredCommands.includes(OPEN_PREVIEW_COMMAND));
  assert.ok(registeredCommands.includes(EXPORT_PDF_COMMAND));

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
