import type { CompiledBlueprint } from 'blueprint4llm';

export interface PreviewDocument {
  uri: string;
  fileName: string;
  languageId: string;
  version: number;
  getText(): string;
}

export interface PreviewDisposable {
  dispose(): void;
}

export type CompiledPreview = CompiledBlueprint;

export interface PreviewDiagramCache {
  clear(): void;
}

export interface PreviewCompileOptions {
  sourceFile: string;
  diagramCache: PreviewDiagramCache;
  signal: AbortSignal;
}

export type PreviewCompiler = (
  markdown: string,
  options: PreviewCompileOptions,
) => Promise<CompiledPreview>;

export interface PreviewDiagnostic {
  readonly message: string;
  readonly sourceFile: string | undefined;
  readonly line: number | undefined;
  readonly column: number | undefined;
  format(): string;
}

export class PreviewDiagnosticError extends Error implements PreviewDiagnostic {
  readonly sourceFile: string | undefined;
  readonly line: number | undefined;
  readonly column: number | undefined;

  constructor(
    message: string,
    location: { sourceFile?: string; line?: number; column?: number } = {},
  ) {
    super(message);
    this.name = 'PreviewDiagnosticError';
    this.sourceFile = location.sourceFile;
    this.line = location.line;
    this.column = location.column;
  }

  format(): string {
    const prefix =
      this.sourceFile === undefined
        ? ''
        : this.line === undefined
          ? `${this.sourceFile}: `
          : `${this.sourceFile}:${this.line}:${this.column ?? 1}: `;
    return `${prefix}${this.message}`;
  }
}

export interface PreviewPanel {
  reveal(): void;
  render(compiled: CompiledPreview, isCurrent: () => boolean, generation: number): Promise<void>;
  renderError(diagnostic: PreviewDiagnostic): void;
  onDidDispose(listener: () => void): PreviewDisposable;
  dispose(): void;
  cleanup(): void | Promise<void>;
}

export interface PreviewScheduler {
  schedule(callback: () => void, delayMs: number): unknown;
  cancel(handle: unknown): void;
}

export interface PreviewControllerOptions {
  createPanel(document: PreviewDocument): PreviewPanel;
  createCache(): PreviewDiagramCache;
  output(message: string): void;
  debounceMs?: number;
  compiler: PreviewCompiler;
  scheduler?: PreviewScheduler;
}

interface PreviewSession {
  readonly documentUri: string;
  readonly panel: PreviewPanel;
  readonly cache: PreviewDiagramCache;
  disposeListener: PreviewDisposable | undefined;
  timer: unknown;
  abortController: AbortController | undefined;
  generation: number;
  latestVersion: number;
  displayedCompiled: CompiledPreview | undefined;
  closed: boolean;
}

const defaultScheduler: PreviewScheduler = {
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Manages one live preview panel and renderer cache per Markdown document URI. */
export class PreviewController {
  private readonly sessions = new Map<string, PreviewSession>();
  private readonly scheduler: PreviewScheduler;
  private readonly debounceMs: number;

  constructor(private readonly options: PreviewControllerOptions) {
    this.scheduler = options.scheduler ?? defaultScheduler;
    this.debounceMs = normalizeDebounce(options.debounceMs ?? 200);
  }

  open(document: PreviewDocument): PreviewPanel {
    const existing = this.sessions.get(document.uri);
    if (existing !== undefined) {
      existing.panel.reveal();
      if (document.version !== existing.latestVersion) {
        this.scheduleBuild(existing, document);
      }
      return existing.panel;
    }

    const panel = this.options.createPanel(document);
    const session: PreviewSession = {
      documentUri: document.uri,
      panel,
      cache: this.options.createCache(),
      disposeListener: undefined,
      timer: undefined,
      abortController: undefined,
      generation: 0,
      latestVersion: document.version,
      displayedCompiled: undefined,
      closed: false,
    };
    this.sessions.set(document.uri, session);
    session.disposeListener = panel.onDidDispose(() => this.closeSession(session));
    this.scheduleBuild(session, document);
    return panel;
  }

  /** Schedules a rebuild only when the changed document has an open preview. */
  documentChanged(document: PreviewDocument): void {
    const session = this.sessions.get(document.uri);
    if (session !== undefined) {
      this.scheduleBuild(session, document);
    }
  }

  /** Closes all preview sessions when the extension is deactivated. */
  dispose(): void {
    for (const session of [...this.sessions.values()]) {
      this.closeSession(session);
      session.panel.dispose();
    }
  }

  get panelCount(): number {
    return this.sessions.size;
  }

  /** Returns the last successful result still shown in an open preview panel. */
  getDisplayedCompilation(documentUri: string): CompiledPreview | undefined {
    return this.sessions.get(documentUri)?.displayedCompiled;
  }

  private scheduleBuild(session: PreviewSession, document: PreviewDocument): void {
    if (session.closed) {
      return;
    }

    session.generation += 1;
    session.latestVersion = document.version;
    session.abortController?.abort(new Error('preview source changed'));
    session.abortController = undefined;
    if (session.timer !== undefined) {
      this.scheduler.cancel(session.timer);
    }

    const generation = session.generation;
    session.timer = this.scheduler.schedule(() => {
      session.timer = undefined;
      void this.build(session, document, generation);
    }, this.debounceMs);
  }

  private async build(
    session: PreviewSession,
    document: PreviewDocument,
    generation: number,
  ): Promise<void> {
    const abortController = new AbortController();
    session.abortController = abortController;
    const isCurrent = () =>
      !session.closed &&
      !abortController.signal.aborted &&
      session.generation === generation &&
      this.sessions.get(session.documentUri) === session;

    try {
      const compiled = await this.options.compiler(document.getText(), {
        sourceFile: document.fileName,
        diagramCache: session.cache,
        signal: abortController.signal,
      });
      if (!isCurrent()) {
        return;
      }

      for (const warning of compiled.warnings) {
        this.options.output(`${document.fileName}: warning: ${warning}`);
      }
      for (const error of compiled.errors ?? []) {
        this.options.output(`${document.fileName}: error: ${error}`);
      }

      await session.panel.render(compiled, isCurrent, generation);
      if (isCurrent()) {
        session.displayedCompiled = compiled;
      }
    } catch (error) {
      if (!isCurrent()) {
        return;
      }
      const diagnostic = createDiagnostic(error, document.fileName);
      this.options.output(diagnostic.format());
      session.displayedCompiled = undefined;
      session.panel.renderError(diagnostic);
    } finally {
      if (session.abortController === abortController) {
        session.abortController = undefined;
      }
    }
  }

  private closeSession(session: PreviewSession): void {
    if (session.closed) {
      return;
    }
    session.closed = true;
    session.displayedCompiled = undefined;
    this.sessions.delete(session.documentUri);
    if (session.timer !== undefined) {
      this.scheduler.cancel(session.timer);
      session.timer = undefined;
    }
    session.abortController?.abort(new Error('preview panel closed'));
    session.abortController = undefined;
    session.cache.clear();
    session.disposeListener?.dispose();
    session.disposeListener = undefined;
    void Promise.resolve(session.panel.cleanup()).catch((error: unknown) => {
      this.options.output(
        `Could not clean preview resources for ${session.documentUri}: ${errorMessage(error)}`,
      );
    });
  }
}

export function isSupportedMarkdownDocument(document: PreviewDocument): boolean {
  return document.languageId === 'markdown' && /\.md$/i.test(document.fileName);
}

function normalizeDebounce(value: number): number {
  return Number.isFinite(value) ? Math.min(2000, Math.max(0, Math.round(value))) : 200;
}

function createDiagnostic(error: unknown, fallbackSourceFile: string): PreviewDiagnosticError {
  if (error instanceof PreviewDiagnosticError) {
    return error;
  }
  const candidate = typeof error === 'object' && error !== null ? error : undefined;
  const message = error instanceof Error ? error.message : String(error);
  const sourceFile = stringProperty(candidate, 'sourceFile') ?? fallbackSourceFile;
  const line = numberProperty(candidate, 'line') ?? nestedPosition(candidate, 'line');
  const column = numberProperty(candidate, 'column') ?? nestedPosition(candidate, 'column');
  return new PreviewDiagnosticError(message || 'Preview compilation failed', {
    sourceFile,
    ...(line === undefined ? {} : { line }),
    ...(column === undefined ? {} : { column }),
  });
}

function stringProperty(value: object | undefined, key: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const property = (value as Record<string, unknown>)[key];
  return typeof property === 'string' ? property : undefined;
}

function numberProperty(value: object | undefined, key: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const property = (value as Record<string, unknown>)[key];
  return typeof property === 'number' ? property : undefined;
}

function nestedPosition(value: object | undefined, key: 'line' | 'column'): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const position = (value as { position?: { start?: Record<string, unknown> } }).position?.start;
  const property = position?.[key];
  return typeof property === 'number' ? property : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
