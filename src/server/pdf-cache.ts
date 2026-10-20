export type PdfFactory = (signal: AbortSignal) => Promise<Uint8Array>;

/** Shares one PDF render per compiled version and cancels obsolete work. */
export class VersionedPdfCache {
  private version: string | undefined;
  private bytes: Uint8Array | undefined;
  private pending: Promise<Uint8Array> | undefined;
  private controller: AbortController | undefined;

  get(version: string, createPdf: PdfFactory): Promise<Uint8Array> {
    if (this.version === version && this.bytes !== undefined) {
      return Promise.resolve(this.bytes);
    }
    if (this.version === version && this.pending !== undefined) {
      return this.pending;
    }

    this.invalidate();
    this.version = version;
    const controller = new AbortController();
    this.controller = controller;
    const pending = Promise.resolve()
      .then(() => createPdf(controller.signal))
      .then(
        (bytes) => {
          if (this.version === version && this.pending === pending) {
            this.bytes = bytes;
            this.pending = undefined;
            this.controller = undefined;
          }
          return bytes;
        },
        (error: unknown) => {
          if (this.version === version && this.pending === pending) {
            this.pending = undefined;
            this.controller = undefined;
          }
          throw error;
        },
      );
    this.pending = pending;
    return pending;
  }

  async close(): Promise<void> {
    const pending = this.pending;
    this.invalidate();
    await pending?.catch(() => undefined);
  }

  invalidate(): void {
    this.controller?.abort(new Error('PDF render was superseded by a newer document version'));
    this.controller = undefined;
    this.version = undefined;
    this.bytes = undefined;
    this.pending = undefined;
  }
}
