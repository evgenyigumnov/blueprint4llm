import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';

import type { CompiledBlueprint } from '../compiler.js';
import { createBuildingHtml, createDiagnosticHtml, createPreviewHtml } from './html.js';

export interface PreviewHttpState {
  compiled: CompiledBlueprint | undefined;
  version: string | undefined;
  diagnostic: string | undefined;
  includeDiagnosticsSummary: boolean;
  dirty: boolean;
  building: boolean;
}

export type PreviewPdfProvider = (
  version: string,
  compiled: CompiledBlueprint,
) => Promise<Uint8Array>;

export interface PreviewHttpServer {
  server: Server;
  broadcastReload: () => void;
  closeEvents: () => void;
}

const SSE_PATH = '/_blueprint4llm/events';

/** Creates the local HTTP routes and manages connected SSE clients. */
export function createPreviewHttpServer(
  state: PreviewHttpState,
  getPdf: PreviewPdfProvider,
): PreviewHttpServer {
  const clients = new Set<ServerResponse>();
  const server = createServer((request, response) => {
    void routeRequest(request, response).catch((error: unknown) => {
      if (!response.headersSent) {
        sendText(response, 500, `Preview server error: ${errorMessage(error)}\n`);
      } else {
        response.destroy(error instanceof Error ? error : undefined);
      }
    });
  });

  async function routeRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET');
      sendText(response, 405, 'Method not allowed\n');
      return;
    }

    let pathname: string;
    try {
      pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    } catch {
      sendText(response, 400, 'Bad request\n');
      return;
    }

    if (pathname === '/') {
      if (state.diagnostic !== undefined) {
        sendHtml(
          response,
          200,
          createDiagnosticHtml(
            state.diagnostic,
            state.version ?? '',
            state.includeDiagnosticsSummary,
          ),
        );
      } else if (state.compiled !== undefined) {
        sendHtml(response, 200, createPreviewHtml(state.compiled, state.version ?? ''));
      } else {
        sendHtml(response, 503, createBuildingHtml(state.version ?? ''));
      }
      return;
    }

    if (pathname === SSE_PATH) {
      openEventStream(response, clients);
      const requestedVersion = new URL(request.url ?? '/', 'http://127.0.0.1').searchParams.get(
        'version',
      );
      if (requestedVersion !== null && requestedVersion !== (state.version ?? '')) {
        response.write('event: reload\ndata: {}\n\n');
      }
      return;
    }

    if (pathname === '/document.pdf') {
      await servePdf(response, state, getPdf);
      return;
    }

    if (pathname.startsWith('/assets/')) {
      serveAsset(pathname.slice('/assets/'.length), response, state.compiled);
      return;
    }

    sendText(response, 404, 'Not found\n');
  }

  return {
    server,
    broadcastReload: () => {
      for (const client of clients) {
        try {
          if (client.destroyed || !client.write('event: reload\ndata: {}\n\n')) {
            client.end();
            clients.delete(client);
          }
        } catch {
          clients.delete(client);
        }
      }
    },
    closeEvents: () => {
      for (const client of clients) {
        client.end();
      }
      clients.clear();
    },
  };
}

function openEventStream(response: ServerResponse, clients: Set<ServerResponse>): void {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  if (!response.write('retry: 1000\n\n')) {
    response.end();
    return;
  }
  clients.add(response);

  const heartbeat = setInterval(() => {
    try {
      if (response.destroyed || !response.write(': heartbeat\n\n')) {
        response.end();
        clients.delete(response);
        clearInterval(heartbeat);
      }
    } catch {
      clients.delete(response);
      clearInterval(heartbeat);
    }
  }, 15_000);
  heartbeat.unref();
  response.once('close', () => {
    clearInterval(heartbeat);
    clients.delete(response);
  });
}

async function servePdf(
  response: ServerResponse,
  state: PreviewHttpState,
  getPdf: PreviewPdfProvider,
): Promise<void> {
  if (state.dirty || state.building) {
    sendText(
      response,
      503,
      'A newer document version is being built; retry after the preview reloads.\n',
    );
    return;
  }
  if (state.diagnostic !== undefined) {
    sendText(response, 422, `The current source has a build error:\n${state.diagnostic}\n`);
    return;
  }
  const compiled = state.compiled;
  const version = state.version;
  if (compiled === undefined || version === undefined) {
    sendText(response, 503, 'The preview has not finished its initial build.\n');
    return;
  }

  let pdf: Uint8Array;
  try {
    pdf = await getPdf(version, compiled);
  } catch (error) {
    if (state.dirty || state.building || state.version !== version) {
      sendText(
        response,
        503,
        'The document changed while the PDF was being prepared. Retry shortly.\n',
      );
    } else {
      sendText(response, 422, `Could not create PDF:\n${errorMessage(error)}\n`);
    }
    return;
  }

  if (
    state.dirty ||
    state.building ||
    state.diagnostic !== undefined ||
    state.version !== version
  ) {
    sendText(
      response,
      503,
      'The document changed while the PDF was being prepared. Retry shortly.\n',
    );
    return;
  }

  response.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'attachment; filename="index.pdf"',
    'Content-Length': pdf.byteLength,
    'Cache-Control': 'no-store',
  });
  response.end(Buffer.from(pdf));
}

function serveAsset(
  encodedName: string,
  response: ServerResponse,
  compiled: CompiledBlueprint | undefined,
): void {
  let name: string;
  try {
    name = decodeURIComponent(encodedName);
  } catch {
    sendText(response, 404, 'Not found\n');
    return;
  }
  if (name.length === 0 || name.includes('/') || name.includes('\\') || name.includes('\0')) {
    sendText(response, 404, 'Not found\n');
    return;
  }
  const asset = compiled?.assets.find((candidate) => candidate.outputName === name);
  if (asset === undefined) {
    sendText(response, 404, 'Not found\n');
    return;
  }

  response.writeHead(200, {
    'Content-Type': asset.mimeType,
    'Content-Length': asset.bytes.byteLength,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  });
  response.end(Buffer.from(asset.bytes));
}

function sendHtml(response: ServerResponse, status: number, html: string): void {
  response.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(html);
}

function sendText(response: ServerResponse, status: number, text: string): void {
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(text);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
