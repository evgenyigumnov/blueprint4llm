import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

import { compileMarkdown } from '../src/compiler.js';
import { renderPdf } from '../src/pdf.js';

const wireframe = `Wireframe #login mobile
  Stack column gap=2 padding=2
    Typography h4 "Wiremark screen"
    TextField "Email address"
    Button "Continue" contained`;

describe('PDF renderer', () => {
  it('prints selectable Cyrillic and all three inline SVG diagram types on readable A4 pages', async () => {
    const longContent = Array.from(
      { length: 100 },
      (_, index) =>
        `Paragraph ${index + 1}: проверяем перенос строк и текст документа на странице.`,
    ).join('\n\n');
    const markdown = `# Проверка кириллицы

Текст документа: русский и English text.

| Раздел | Значение |
| --- | --- |
| Таблица | читаемая |

\`\`\`mermaid
flowchart LR
  A[Mermaid Start] --> B[Mermaid Finish]
\`\`\`

\`\`\`wireframe
${wireframe}
\`\`\`

\`\`\`plantuml
@startuml
Browser -> API: PlantUML Start
API --> Browser: PlantUML Finish
@enduml
\`\`\`

${longContent}`;

    const compiled = await compileMarkdown(markdown, { sourceFile: 'pdf-test.md' });
    const pdf = await renderPdf(compiled);
    const loadingTask = getDocument({ data: Uint8Array.from(pdf) });
    const document = await loadingTask.promise;
    const pages: string[] = [];

    try {
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const text = await page.getTextContent();
        pages.push(
          text.items
            .map((item) => ('str' in item ? item.str : ''))
            .filter(Boolean)
            .join(' '),
        );
        if (pageNumber === 1) {
          const viewport = page.getViewport({ scale: 1 });
          expect(viewport.width).toBeGreaterThan(590);
          expect(viewport.width).toBeLessThan(600);
          expect(viewport.height).toBeGreaterThan(835);
          expect(viewport.height).toBeLessThan(850);
        }
      }
    } finally {
      await loadingTask.destroy();
    }

    expect(Buffer.from(pdf.subarray(0, 5)).toString()).toBe('%PDF-');
    expect(pages.length).toBeGreaterThanOrEqual(3);
    const fullText = pages.join('\n');
    expect(fullText).toContain('Проверка кириллицы');
    expect(fullText).toContain('русский');
    expect(fullText).toContain('Таблица');
    expect(fullText).toMatch(/Mermaid\s+Start/);
    expect(fullText).toMatch(/Mermaid\s+Finish/);
    expect(fullText).toContain('Wiremark screen');
    expect(fullText).toContain('Email address');
    expect(fullText).toMatch(/PlantUML\s+Start/);
    expect(fullText).toMatch(/PlantUML\s+Finish/);
    for (let pageNumber = 1; pageNumber <= pages.length; pageNumber += 1) {
      expect(pages[pageNumber - 1]).toMatch(new RegExp(`${pageNumber}\\s*[/|]\\s*${pages.length}`));
    }
  }, 120_000);

  it('honors an already-aborted signal without launching Chromium', async () => {
    const compiled = await compileMarkdown('# Aborted', { sourceFile: 'aborted.md' });
    const controller = new AbortController();
    controller.abort(new Error('cancelled by caller'));

    await expect(renderPdf(compiled, { signal: controller.signal })).rejects.toThrow(
      'cancelled by caller',
    );
  });

  it('loads local images from data URLs and rejects external image URLs', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'blueprint4llm-pdf-assets-'));
    const imageDirectory = path.join(root, 'images');
    await mkdir(imageDirectory);
    await writeFile(
      path.join(imageDirectory, 'sample.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="32"><rect width="48" height="32" fill="blue"/></svg>',
    );

    try {
      const compiled = await compileMarkdown('# Image\n\n![Sample](./images/sample.svg)', {
        sourceFile: path.join(root, 'blueprint.md'),
      });
      const pdf = await renderPdf(compiled);
      expect(Buffer.from(pdf.subarray(0, 5)).toString()).toBe('%PDF-');

      const remote = await compileMarkdown('![Remote](https://images.example/sample.png)', {
        sourceFile: path.join(root, 'blueprint.md'),
      });
      await expect(renderPdf(remote)).rejects.toThrow(
        'cannot include external image "https://images.example/sample.png" in a PDF',
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 60_000);

  it('renders a Figma JSON frame offline in standalone HTML and PDF', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const figmaJson = JSON.stringify({
      name: 'Offline fixture',
      sourceOnly: 'FIGMA_JSON_SOURCE_MUST_NOT_APPEAR',
      document: {
        id: '0:0',
        name: 'Document',
        type: 'DOCUMENT',
        children: [
          {
            id: '1:1',
            name: 'Page 1',
            type: 'CANVAS',
            children: [
              {
                id: '12:34',
                name: 'Offline frame',
                type: 'FRAME',
                absoluteBoundingBox: { x: 0, y: 0, width: 360, height: 100 },
                children: [
                  {
                    id: '12:35',
                    name: 'Label',
                    type: 'TEXT',
                    absoluteBoundingBox: { x: 24, y: 24, width: 300, height: 32 },
                    characters: 'Searchable offline Figma text',
                    style: { fontFamily: 'Inter', fontSize: 20, fontWeight: 600 },
                    fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 } }],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    let compiled: Awaited<ReturnType<typeof compileMarkdown>>;
    try {
      compiled = await compileMarkdown(
        ['# Offline Figma', '', '```figma node=12:34', figmaJson, '```'].join('\n'),
        { sourceFile: 'offline-figma.md' },
      );
    } finally {
      vi.unstubAllGlobals();
    }

    expect(fetch).not.toHaveBeenCalled();
    expect(compiled.html).toContain('bp-diagram--figma');
    expect(compiled.html).toContain('Searchable offline Figma text');
    expect(compiled.html).not.toContain('FIGMA_JSON_SOURCE_MUST_NOT_APPEAR');

    const pdf = await renderPdf(compiled);
    const loadingTask = getDocument({ data: Uint8Array.from(pdf) });
    const document = await loadingTask.promise;
    let text: string;
    try {
      const page = await document.getPage(1);
      const content = await page.getTextContent();
      text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .filter(Boolean)
        .join(' ');
    } finally {
      await loadingTask.destroy();
    }

    expect(Buffer.from(pdf.subarray(0, 5)).toString()).toBe('%PDF-');
    expect(text.replaceAll(/\s+/g, '').toLowerCase()).toContain('searchableofflinefigmatext');
    expect(text).not.toContain('FIGMA_JSON_SOURCE_MUST_NOT_APPEAR');
  }, 60_000);
});
