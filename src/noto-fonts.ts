import { readFile } from 'node:fs/promises';

const FONT_URLS = [
  new URL('../fonts/NotoSans-Regular.ttf', import.meta.url),
  new URL('../fonts/NotoSans-Bold.ttf', import.meta.url),
] as const;
const MAX_FONT_BYTES = 20 * 1024 * 1024;
let fontCssPromise: Promise<string> | undefined;

/** Returns the bundled regular and bold Noto Sans faces as self-contained CSS. */
export function getNotoSansFontCss(): Promise<string> {
  fontCssPromise ??= Promise.all(FONT_URLS.map((url) => readFile(url))).then((fonts) => {
    for (const font of fonts) {
      if (font.byteLength > MAX_FONT_BYTES) {
        throw new Error('the bundled Noto Sans font exceeds the supported 20 MiB size limit');
      }
    }

    const [regular, bold] = fonts;
    if (regular === undefined || bold === undefined) {
      throw new Error('the bundled Noto Sans font files are unavailable');
    }
    return createFontFaceCss(regular.toString('base64'), bold.toString('base64'));
  });
  return fontCssPromise;
}

function createFontFaceCss(regular: string, bold: string): string {
  return `@font-face {
  font-family: 'Noto Sans';
  src: url(data:font/ttf;base64,${regular}) format('truetype');
  font-style: normal;
  font-weight: 400;
}
@font-face {
  font-family: 'Noto Sans';
  src: url(data:font/ttf;base64,${bold}) format('truetype');
  font-style: normal;
  font-weight: 700;
}`;
}
