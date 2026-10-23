import * as assert from 'node:assert/strict';

import { ensurePdfExtension, exportPreviewPdf, getDefaultPdfPath } from '../../src/pdf-export.js';
import type { CompiledPreview } from '../../src/preview-controller.js';

export async function runPdfExportTests(): Promise<void> {
  await testExportsTheDisplayedCompilation();
  await testCancellingDestinationDoesNotRenderOrWrite();
  testPdfPathHelpers();
}

async function testExportsTheDisplayedCompilation(): Promise<void> {
  const compiled = compiledPreview();
  const calls: string[] = [];
  const pdf = new Uint8Array([37, 80, 68, 70]);
  let renderedCompilation: CompiledPreview | undefined;
  let writtenBytes: Uint8Array | undefined;
  const savedPath = await exportPreviewPdf(compiled, '/docs/blueprint.md', {
    chooseDestination: async (defaultPath) => {
      calls.push(`choose:${defaultPath}`);
      return '/exports/architecture';
    },
    renderPdf: async (result) => {
      calls.push('render');
      renderedCompilation = result;
      assert.match(result.html, /class="bp-diagram bp-diagram--openapi"/);
      assert.match(result.html, /GET \/orders/);
      return pdf;
    },
    writeFile: async (filePath, contents) => {
      calls.push(`write:${filePath}`);
      writtenBytes = contents;
    },
  });

  assert.equal(savedPath, '/exports/architecture.pdf');
  assert.equal(renderedCompilation, compiled, 'PDF rendering uses the exact preview result');
  assert.equal(writtenBytes, pdf);
  assert.deepEqual(calls, [
    'choose:/docs/blueprint.pdf',
    'render',
    'write:/exports/architecture.pdf',
  ]);
}

async function testCancellingDestinationDoesNotRenderOrWrite(): Promise<void> {
  let renderCalled = false;
  let writeCalled = false;
  const result = await exportPreviewPdf(compiledPreview(), '/docs/notes.md', {
    chooseDestination: async () => undefined,
    renderPdf: async () => {
      renderCalled = true;
      return new Uint8Array();
    },
    writeFile: async () => {
      writeCalled = true;
    },
  });

  assert.equal(result, undefined);
  assert.equal(renderCalled, false);
  assert.equal(writeCalled, false);
}

function testPdfPathHelpers(): void {
  assert.equal(getDefaultPdfPath('/docs/blueprint.md'), '/docs/blueprint.pdf');
  assert.equal(getDefaultPdfPath('/docs/README'), '/docs/README.pdf');
  assert.equal(ensurePdfExtension('/exports/report.pdf'), '/exports/report.pdf');
  assert.equal(ensurePdfExtension('/exports/report.PDF'), '/exports/report.PDF');
  assert.equal(ensurePdfExtension('/exports/report'), '/exports/report.pdf');
}

function compiledPreview(): CompiledPreview {
  return {
    html: '<!doctype html><html><head></head><body><svg class="bp-diagram bp-diagram--openapi">GET /orders</svg></body></html>',
    title: 'Orders API',
    assets: [],
    warnings: [],
    errors: [],
  };
}
