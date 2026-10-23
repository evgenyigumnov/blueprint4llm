/** Formats finite coordinates without rounding saved positions. */
export function formatExcalidrawNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error('Excalidraw SVG contains a non-finite coordinate');
  }
  return Object.is(value, -0) ? '0' : String(value);
}

export function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
