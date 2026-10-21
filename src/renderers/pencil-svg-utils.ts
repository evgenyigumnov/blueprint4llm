export function formatPencilSvgNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error('Pencil layout produced a non-finite SVG coordinate');
  }
  return String(Math.round(value * 1000) / 1000);
}

export function escapePencilXml(value: string): string {
  let result = '';
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    const isXmlCharacter =
      codePoint === 0x9 ||
      codePoint === 0xa ||
      codePoint === 0xd ||
      (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
      (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
      (codePoint >= 0x10000 && codePoint <= 0x10ffff);
    const safeCharacter = isXmlCharacter ? character : '\uFFFD';
    if (safeCharacter === '&') {
      result += '&amp;';
    } else if (safeCharacter === '<') {
      result += '&lt;';
    } else if (safeCharacter === '>') {
      result += '&gt;';
    } else if (safeCharacter === '"') {
      result += '&quot;';
    } else if (safeCharacter === "'") {
      result += '&apos;';
    } else {
      result += safeCharacter;
    }
  }
  return result;
}
