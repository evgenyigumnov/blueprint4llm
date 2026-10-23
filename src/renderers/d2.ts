import { readFile } from 'node:fs/promises';
import type { CompileOptions, CompileResponse, RenderOptions } from '@d2lang/d2';

import { D2Error } from './d2-error.js';
import { toD2Error } from './d2-diagnostics.js';
import { D2JobRunner } from './d2-runner.js';
import { validateD2Profile } from './d2-policy.js';
import { adaptD2Svg } from './d2-svg.js';
import type { DiagramRenderer, DiagramRenderContext, DiagramResult } from './types.js';

export const MAX_D2_SOURCE_BYTES = 256 * 1024;
const D2_PROFILE_REVISION = 'd2-profile-v1;theme=0;layout=dagre,elk;svg-adapter-v1';
const runner = new D2JobRunner();
let fontsPromise: Promise<D2Fonts> | undefined;

interface D2Fonts {
  regular: number[];
  bold: number[];
}

/** Compiles one local D2 document to a validated static SVG. */
export const d2Renderer: DiagramRenderer = {
  name: 'd2',
  languages: ['d2'],
  cacheKey: `@d2lang/d2@0.1.34;postcss@8.5.31;${D2_PROFILE_REVISION};NotoSans-regular-bold-v1`,
  maxSourceBytes: MAX_D2_SOURCE_BYTES,

  async render(source: string, context: DiagramRenderContext): Promise<DiagramResult> {
    const sourceBytes = Buffer.byteLength(source, 'utf8');
    if (sourceBytes > MAX_D2_SOURCE_BYTES) {
      throw new D2Error(
        `D2 source is too large: ${sourceBytes} bytes (limit ${MAX_D2_SOURCE_BYTES} bytes)`,
      );
    }
    if (source.trim().length === 0) throw new D2Error('D2 block is empty');
    if (context.metadata?.trim()) {
      throw new D2Error('D2 block metadata is not supported; use `vars.d2-config` in the source');
    }

    return runner.run(async (engine, signal) => {
      try {
        throwIfAborted(signal);
        const fonts = await loadFonts();
        throwIfAborted(signal);
        const input = { fs: { 'index.d2': source }, inputPath: 'index.d2' };
        const baseOptions = createCompileOptions(fonts, 'dagre');
        let compiled = await engine.compile(input, baseOptions);
        throwIfAborted(signal);
        const layout = validateD2Profile(compiled);

        if (compiled.diagram.shapes.length === 0 && compiled.diagram.connections.length === 0) {
          throw new D2Error('D2 block has no visible objects');
        }
        if (layout === 'elk') {
          compiled = await engine.compile(input, createCompileOptions(fonts, 'elk'));
          throwIfAborted(signal);
          validateD2Profile(compiled);
        }

        const svg = await engine.render(compiled.diagram, createRenderOptions(compiled));
        throwIfAborted(signal);
        return { svg: adaptD2Svg(svg), warnings: [] };
      } catch (error) {
        throw toD2Error(error);
      }
    }, context.signal);
  },
};

function createCompileOptions(fonts: D2Fonts, layout: 'dagre' | 'elk'): CompileOptions {
  return {
    layout,
    themeID: 0,
    noXMLTag: true,
    pad: 100,
    center: false,
    sketch: false,
    fontRegular: fonts.regular as unknown as Uint8Array,
    fontItalic: fonts.regular as unknown as Uint8Array,
    fontBold: fonts.bold as unknown as Uint8Array,
    fontSemibold: fonts.bold as unknown as Uint8Array,
  };
}

function createRenderOptions(compiled: CompileResponse): RenderOptions {
  return {
    ...compiled.renderOptions,
    themeID: 0,
    pad: 100,
    center: false,
    sketch: false,
    noXMLTag: true,
    forceAppendix: false,
    salt: 'blueprint4llm-d2',
  };
}

function loadFonts(): Promise<D2Fonts> {
  fontsPromise ??= Promise.all([
    readFile(new URL('../../fonts/NotoSans-Regular.ttf', import.meta.url)),
    readFile(new URL('../../fonts/NotoSans-Bold.ttf', import.meta.url)),
  ]).then(([regular, bold]) => ({ regular: Array.from(regular), bold: Array.from(bold) }));
  return fontsPromise;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new D2Error('D2 rendering was cancelled');
  }
}
