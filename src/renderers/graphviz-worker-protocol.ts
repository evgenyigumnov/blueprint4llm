export const GRAPHVIZ_PACKAGE_VERSION = '3.31.0';
export const GRAPHVIZ_ENGINE_VERSION = '16.1.0';

/** Engines verified for ordinary graph inputs in the pinned Wasm build. */
export const GRAPHVIZ_ENGINES = [
  'circo',
  'dot',
  'fdp',
  'neato',
  'osage',
  'patchwork',
  'twopi',
] as const;

export type GraphvizEngine = (typeof GRAPHVIZ_ENGINES)[number];

export interface GraphvizEngineMessage {
  message: string;
  level?: 'error' | 'warning';
}

export interface GraphvizRenderOutput {
  status: 'success' | 'failure';
  output: string | undefined;
  errors: GraphvizEngineMessage[];
}

export type GraphvizWorkerRequest = {
  type: 'render';
  source: string;
  engine: GraphvizEngine;
};

export type GraphvizWorkerResponse =
  | {
      type: 'ready';
      graphvizVersion: string;
      engines: string[];
    }
  | {
      type: 'render-result';
      graphvizVersion: string;
      engines: string[];
      result: GraphvizRenderOutput;
    }
  | {
      type: 'worker-error';
      message: string;
    };
