import { createHash } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

import * as vscode from 'vscode';

import { isSupportedMarkdownDocument, PreviewController } from './preview-controller.js';
import type { PreviewDocument, PreviewPanel, PreviewCompiler } from './preview-controller.js';
import { exportPreviewPdf } from './pdf-export.js';
import { createDiagnosticHtml, createPreviewHtml } from './webview-html.js';

export const OPEN_PREVIEW_COMMAND = 'blueprint4llm.openPreview';
export const EXPORT_PDF_COMMAND = 'blueprint4llm.exportPdf';

/** Activates the VS Code preview command and its per-document controller. */
export async function activate(context: vscode.ExtensionContext): Promise<{
  hostNodeVersion: string;
  compileMarkdown: PreviewCompiler;
  getPreviewCount(): number;
  getDisplayedCompilation(
    documentUri: string,
  ): ReturnType<PreviewController['getDisplayedCompilation']>;
}> {
  const blueprint = await import('blueprint4llm');
  const compile: PreviewCompiler = (markdown, options) =>
    blueprint.compileMarkdown(markdown, {
      sourceFile: options.sourceFile,
      diagramCache: options.diagramCache as InstanceType<typeof blueprint.DiagramRenderCache>,
      signal: options.signal,
      includeDiagnosticsSummary: vscode.workspace
        .getConfiguration('blueprint4llm.preview')
        .get<boolean>('includeDiagnosticsSummary', false),
    });
  const output = vscode.window.createOutputChannel('Blueprint4llm');
  output.appendLine(`Extension host Node.js ${process.versions.node}`);

  const controller = new PreviewController({
    compiler: compile,
    createCache: () => new blueprint.DiagramRenderCache(),
    debounceMs: vscode.workspace
      .getConfiguration('blueprint4llm.preview')
      .get<number>('debounceMs', 200),
    output: (message) => output.appendLine(message),
    createPanel: (document) => createPreviewPanel(context, output, document),
  });
  let lastPreviewUri: string | undefined;

  context.subscriptions.push(
    output,
    controller,
    vscode.workspace.onDidChangeTextDocument((event) => {
      controller.documentChanged(toPreviewDocument(event.document));
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('blueprint4llm.preview.includeDiagnosticsSummary')) {
        return;
      }
      for (const document of vscode.workspace.textDocuments) {
        controller.documentChanged(toPreviewDocument(document));
      }
    }),
    vscode.commands.registerCommand(OPEN_PREVIEW_COMMAND, async () => {
      const activeDocument = vscode.window.activeTextEditor?.document;
      const document =
        activeDocument === undefined
          ? findDocument(lastPreviewUri)
          : isSupportedMarkdownDocument(toPreviewDocument(activeDocument))
            ? activeDocument
            : undefined;

      if (document === undefined || document.uri.scheme !== 'file') {
        void vscode.window.showWarningMessage(
          'Откройте Markdown-файл с расширением .md, чтобы построить предпросмотр Blueprint.',
        );
        return;
      }

      const previewDocument = toPreviewDocument(document);
      if (!isSupportedMarkdownDocument(previewDocument)) {
        void vscode.window.showWarningMessage(
          'Предпросмотр Blueprint доступен только для файлов .md.',
        );
        return;
      }
      lastPreviewUri = document.uri.toString();
      controller.open(previewDocument);
    }),
    vscode.commands.registerCommand(EXPORT_PDF_COMMAND, async () => {
      const activeDocument = vscode.window.activeTextEditor?.document;
      const document =
        activeDocument !== undefined &&
        isSupportedMarkdownDocument(toPreviewDocument(activeDocument))
          ? activeDocument
          : findDocument(lastPreviewUri);

      if (document === undefined || !isSupportedMarkdownDocument(toPreviewDocument(document))) {
        void vscode.window.showWarningMessage(
          'Откройте предпросмотр Markdown-файла перед экспортом Blueprint в PDF.',
        );
        return;
      }

      const compiled = controller.getDisplayedCompilation(document.uri.toString());
      if (compiled === undefined) {
        void vscode.window.showWarningMessage(
          'Для этого файла нет готового предпросмотра. Сначала откройте предпросмотр и дождитесь его сборки.',
        );
        return;
      }

      try {
        const savedPath = await exportPreviewPdf(compiled, document.uri.fsPath, {
          chooseDestination: async (defaultPath) => {
            const destination = await vscode.window.showSaveDialog({
              defaultUri: vscode.Uri.file(defaultPath),
              filters: { PDF: ['pdf'] },
              saveLabel: 'Export PDF',
            });
            if (destination === undefined) {
              return undefined;
            }
            if (destination.scheme !== 'file') {
              throw new Error('PDF export currently supports local file destinations only');
            }
            return destination.fsPath;
          },
          renderPdf: async (result) =>
            await vscode.window.withProgress(
              {
                location: vscode.ProgressLocation.Notification,
                title: 'Exporting Blueprint PDF…',
                cancellable: false,
              },
              () => blueprint.renderPdf(result),
            ),
          writeFile: async (filePath, contents) => {
            await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), contents);
          },
        });
        if (savedPath !== undefined) {
          void vscode.window.showInformationMessage(`PDF сохранён: ${savedPath}`);
        }
      } catch (error) {
        const message = errorMessage(error);
        output.appendLine(`${document.uri.fsPath}: PDF export failed: ${message}`);
        void vscode.window.showErrorMessage(`Не удалось экспортировать PDF: ${message}`);
      }
    }),
  );

  return {
    hostNodeVersion: process.versions.node,
    compileMarkdown: compile,
    getPreviewCount: () => controller.panelCount,
    getDisplayedCompilation: (documentUri) => controller.getDisplayedCompilation(documentUri),
  };
}

export function deactivate(): void {}

function createPreviewPanel(
  context: vscode.ExtensionContext,
  output: vscode.OutputChannel,
  document: PreviewDocument,
): PreviewPanel {
  const documentHash = createHash('sha256').update(document.uri).digest('hex');
  const assetRoot = path.join(context.globalStorageUri.fsPath, 'previews', documentHash);
  const panel = vscode.window.createWebviewPanel(
    'blueprint4llm.preview',
    `${path.basename(document.fileName)} · Blueprint Preview`,
    vscode.ViewColumn.Beside,
    {
      enableScripts: false,
      localResourceRoots: [vscode.Uri.file(assetRoot)],
    },
  );

  return new VSCodePreviewPanel(panel, assetRoot, output, () =>
    vscode.workspace
      .getConfiguration('blueprint4llm.preview')
      .get<boolean>('includeDiagnosticsSummary', false),
  );
}

class VSCodePreviewPanel implements PreviewPanel {
  private closed = false;
  private currentAssetDirectory: string | undefined;

  constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly assetRoot: string,
    private readonly output: vscode.OutputChannel,
    private readonly includeDiagnosticsSummary: () => boolean,
  ) {}

  reveal(): void {
    this.panel.reveal(vscode.ViewColumn.Beside, true);
  }

  async render(
    compiled: Parameters<PreviewPanel['render']>[0],
    isCurrent: () => boolean,
    generation: number,
  ): Promise<void> {
    if (this.closed || !isCurrent()) {
      return;
    }
    await mkdir(this.assetRoot, { recursive: true });
    const result = await createPreviewHtml(
      compiled,
      {
        cspSource: this.panel.webview.cspSource,
        asWebviewUri: (filePath) =>
          this.panel.webview.asWebviewUri(vscode.Uri.file(filePath)).toString(),
      },
      this.assetRoot,
      generation,
      () => !this.closed && isCurrent(),
    );
    if (result === undefined || this.closed || !isCurrent()) {
      return;
    }

    this.panel.webview.html = result.html;
    const previousAssetDirectory = this.currentAssetDirectory;
    this.currentAssetDirectory = result.assetDirectory;
    if (previousAssetDirectory !== undefined && previousAssetDirectory !== result.assetDirectory) {
      void rm(previousAssetDirectory, { recursive: true, force: true }).catch((error: unknown) => {
        this.output.appendLine(`Could not remove stale preview images: ${errorMessage(error)}`);
      });
    }
  }

  renderError(diagnostic: Parameters<PreviewPanel['renderError']>[0]): void {
    if (this.closed) {
      return;
    }
    this.panel.webview.html = createDiagnosticHtml(
      diagnostic,
      this.panel.webview.cspSource,
      this.includeDiagnosticsSummary(),
    );
    const previousAssetDirectory = this.currentAssetDirectory;
    this.currentAssetDirectory = undefined;
    if (previousAssetDirectory !== undefined) {
      void rm(previousAssetDirectory, { recursive: true, force: true }).catch((error: unknown) => {
        this.output.appendLine(`Could not remove preview images: ${errorMessage(error)}`);
      });
    }
  }

  onDidDispose(listener: () => void): vscode.Disposable {
    return this.panel.onDidDispose(() => {
      this.closed = true;
      listener();
    });
  }

  dispose(): void {
    this.panel.dispose();
  }

  async cleanup(): Promise<void> {
    this.closed = true;
    this.currentAssetDirectory = undefined;
    await rm(this.assetRoot, { recursive: true, force: true });
  }
}

function toPreviewDocument(document: vscode.TextDocument): PreviewDocument {
  return {
    uri: document.uri.toString(),
    fileName: document.uri.fsPath,
    languageId: document.languageId,
    version: document.version,
    getText: () => document.getText(),
  };
}

function findDocument(uri: string | undefined): vscode.TextDocument | undefined {
  if (uri === undefined) {
    return undefined;
  }
  return vscode.workspace.textDocuments.find((document) => document.uri.toString() === uri);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
