const CSS_GENERIC_FONT_FAMILIES = new Set([
  'cursive',
  'emoji',
  'fangsong',
  'fantasy',
  'math',
  'monospace',
  'sans-serif',
  'serif',
  'system-ui',
  'ui-monospace',
  'ui-rounded',
  'ui-sans-serif',
  'ui-serif',
]);

/** Keeps Figma fonts first and adds a predictable generic fallback for offline browsers. */
export function addSvgSansSerifFallback(svg: string): string {
  return svg.replace(
    /(\bfont-family\s*=\s*)(["'])(.*?)\2/gi,
    (attribute, prefix: string, quote: string, fontFamilies: string) => {
      const names = fontFamilies.split(',').map((name) => name.trim().toLowerCase());
      if (names.some((name) => CSS_GENERIC_FONT_FAMILIES.has(name))) {
        return attribute;
      }
      return `${prefix}${quote}${fontFamilies.trim()}, sans-serif${quote}`;
    },
  );
}
