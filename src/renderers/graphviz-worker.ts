import { parentPort } from 'node:worker_threads';

import { instance } from '@viz-js/viz';

import { MAX_GRAPHVIZ_SVG_BYTES } from './graphviz-limits.js';
import type { GraphvizWorkerRequest, GraphvizWorkerResponse } from './graphviz-worker-protocol.js';

const workerPort = getParentPort();

void startWorker();

async function startWorker(): Promise<void> {
  try {
    const viz = await instance();
    const graphvizVersion = viz.graphvizVersion;
    const engines = viz.engines;
    workerPort.postMessage({
      type: 'ready',
      graphvizVersion,
      engines,
    } satisfies GraphvizWorkerResponse);
    workerPort.once('message', (request: GraphvizWorkerRequest) => {
      try {
        const result = viz.render(request.source, {
          format: 'svg_inline',
          engine: request.engine,
        });
        if (result.output !== undefined) {
          const outputBytes = Buffer.byteLength(result.output, 'utf8');
          if (outputBytes > MAX_GRAPHVIZ_SVG_BYTES) {
            postError(
              `Graphviz SVG is too large: ${outputBytes} bytes (limit ${MAX_GRAPHVIZ_SVG_BYTES} bytes)`,
            );
            return;
          }
        }
        workerPort.postMessage({
          type: 'render-result',
          graphvizVersion,
          engines,
          result,
        } satisfies GraphvizWorkerResponse);
      } catch (error) {
        postError(errorMessage(error));
      }
    });
  } catch (error) {
    postError(errorMessage(error));
  }
}

function getParentPort() {
  if (parentPort === null) {
    throw new Error('Graphviz worker must run inside a worker thread');
  }
  return parentPort;
}

function postError(message: string): void {
  workerPort.postMessage({ type: 'worker-error', message } satisfies GraphvizWorkerResponse);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
