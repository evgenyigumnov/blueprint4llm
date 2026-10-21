import path from 'node:path';

import type { CompiledPreview } from './preview-controller.js';

export interface PdfExportServices {
  chooseDestination(defaultPath: string): Promise<string | undefined>;
  renderPdf(compiled: CompiledPreview): Promise<Uint8Array>;
  writeFile(filePath: string, contents: Uint8Array): Promise<void>;
}

/** Opens the destination picker, renders the displayed compilation, and saves the PDF. */
export async function exportPreviewPdf(
  compiled: CompiledPreview,
  sourceFile: string,
  services: PdfExportServices,
): Promise<string | undefined> {
  const destination = await services.chooseDestination(getDefaultPdfPath(sourceFile));
  if (destination === undefined) {
    return undefined;
  }

  const filePath = ensurePdfExtension(destination);
  const pdf = await services.renderPdf(compiled);
  await services.writeFile(filePath, pdf);
  return filePath;
}

export function getDefaultPdfPath(sourceFile: string): string {
  const parsed = path.parse(sourceFile);
  return path.join(parsed.dir, `${parsed.name || 'blueprint'}.pdf`);
}

export function ensurePdfExtension(filePath: string): string {
  return /\.pdf$/i.test(filePath) ? filePath : `${filePath}.pdf`;
}
