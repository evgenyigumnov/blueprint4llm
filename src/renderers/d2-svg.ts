import postcss from 'postcss';
import type { Element, RootContent } from 'hast';

import { D2Error } from './d2-error.js';

export const D2_MAX_SVG_BYTES = 4 * 1024 * 1024;
export const D2_MAX_SVG_SIDE = 8192;
const D2_SCOPE_PLACEHOLDER = 'bp-d2-scope';
const D2_FONT_FAMILY = '"Noto Sans", Arial, sans-serif';
const D2_MONO_FONT_FAMILY = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** Removes only D2's known embedded font faces and normalizes its static SVG envelope. */
export function adaptD2Svg(svg: string): string {
  const size = Buffer.byteLength(svg, 'utf8');
  if (size > D2_MAX_SVG_BYTES) {
    throw new D2Error(`D2 SVG is too large: ${size} bytes (limit ${D2_MAX_SVG_BYTES} bytes)`);
  }

  const rootClass = readD2RootClass(svg);
  const normalized = normalizeRootDimensions(svg);
  const adapted = adaptStyles(normalized, rootClass);
  const adaptedSize = Buffer.byteLength(adapted, 'utf8');
  if (adaptedSize > D2_MAX_SVG_BYTES) {
    throw new D2Error(
      `adapted D2 SVG is too large: ${adaptedSize} bytes (limit ${D2_MAX_SVG_BYTES} bytes)`,
    );
  }
  return adapted;
}

/** Scopes D2's root CSS class after cache lookup so identical blocks remain cacheable. */
export function scopeD2SvgStyles(svg: Element, diagramId: string): void {
  const scopedClass = `bp-d2-${diagramId}`;
  let foundScope = false;

  const visit = (node: Element | RootContent, insideStyle = false): void => {
    if (node.type !== 'element') {
      if (insideStyle && node.type === 'text') {
        node.value = node.value.replaceAll(`.${D2_SCOPE_PLACEHOLDER}`, `.${scopedClass}`);
      }
      return;
    }

    const classes = node.properties.className;
    if (Array.isArray(classes) && classes.includes(D2_SCOPE_PLACEHOLDER)) {
      node.properties.className = classes.map((name) =>
        name === D2_SCOPE_PLACEHOLDER ? scopedClass : name,
      );
      foundScope = true;
    }

    for (const child of node.children) {
      visit(child, insideStyle || node.tagName.toLowerCase() === 'style');
    }
  };

  visit(svg);
  if (!foundScope) throw new D2Error('D2 SVG did not contain its expected scoped root class');
}

function normalizeRootDimensions(svg: string): string {
  const openingTag = /^\s*<svg\b[^>]*>/i.exec(svg)?.[0];
  if (openingTag === undefined) throw new D2Error('D2 output did not contain an SVG root element');

  const viewBox = readAttribute(openingTag, 'viewBox');
  if (viewBox === undefined) throw new D2Error('D2 SVG must define a viewBox');
  const dimensions = viewBox
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (
    dimensions.length !== 4 ||
    dimensions.some((value) => !Number.isFinite(value)) ||
    dimensions[2] === undefined ||
    dimensions[3] === undefined ||
    dimensions[2] <= 0 ||
    dimensions[3] <= 0
  ) {
    throw new D2Error('D2 SVG has an invalid viewBox');
  }
  const [width, height] = dimensions.slice(2);
  if (
    width === undefined ||
    height === undefined ||
    width > D2_MAX_SVG_SIDE ||
    height > D2_MAX_SVG_SIDE
  ) {
    throw new D2Error(`D2 SVG dimensions exceed ${D2_MAX_SVG_SIDE} px per side`);
  }

  const existingWidth = readAttribute(openingTag, 'width');
  const existingHeight = readAttribute(openingTag, 'height');
  if (existingWidth !== undefined && parseLength(existingWidth) === undefined) {
    throw new D2Error('D2 SVG has an invalid width');
  }
  if (existingHeight !== undefined && parseLength(existingHeight) === undefined) {
    throw new D2Error('D2 SVG has an invalid height');
  }

  const updated = setAttribute(
    setAttribute(openingTag, 'width', existingWidth ?? String(width)),
    'height',
    existingHeight ?? String(height),
  );
  return svg.replace(openingTag, updated);
}

function adaptStyles(svg: string, rootClass: string): string {
  let styleCount = 0;
  const stylePattern = /(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi;
  const adapted = svg.replace(
    stylePattern,
    (_match, opening: string, content: string, closing: string) => {
      styleCount += 1;
      const cdata = /^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/.exec(content);
      const cssText = cdata?.[1] ?? content;
      const root = postcss.parse(cssText);
      root.walkAtRules((rule) => {
        if (rule.name !== 'font-face' || !isD2EmbeddedFont(rule, rootClass)) {
          throw new D2Error(`D2 SVG contains unsupported CSS at-rule \`@${rule.name}\``);
        }
        rule.remove();
      });
      root.walkRules((rule) => {
        const selectors = postcss.list.comma(rule.selector ?? '');
        rule.selector = selectors
          .map((selector) =>
            containsClass(selector, rootClass)
              ? replaceClass(selector, rootClass, D2_SCOPE_PLACEHOLDER)
              : `.${D2_SCOPE_PLACEHOLDER} ${selector.trim()}`,
          )
          .join(',');
        replaceD2FontDeclarations(rule, rootClass);
      });
      return `${opening}${cdata === null ? '' : '<![CDATA['}${root.toString()}${cdata === null ? '' : ']]>'}${closing}`;
    },
  );

  if (styleCount === 0) throw new D2Error('D2 SVG did not contain its expected CSS style block');
  return replaceClassAttribute(adapted, rootClass, D2_SCOPE_PLACEHOLDER);
}

function isD2EmbeddedFont(rule: postcss.AtRule, rootClass: string): boolean {
  const declarations = new Map<string, string>();
  rule.walkDecls((declaration) => {
    declarations.set(declaration.prop.toLowerCase(), declaration.value);
  });
  const family = declarations.get('font-family')?.replace(/^['"]|['"]$/g, '');
  const source = declarations.get('src') ?? '';
  return (
    family !== undefined &&
    new RegExp(`^${escapeRegExp(rootClass)}-font-(regular|bold|italic|semibold|mono)$`).test(
      family,
    ) &&
    /^url\(["']?data:application\/font-woff;base64,[A-Za-z0-9+/=]+["']?\)$/i.test(source)
  );
}

function replaceD2FontDeclarations(rule: postcss.Rule, rootClass: string): void {
  rule.walkDecls('font-family', (declaration) => {
    const family = declaration.value.replace(/^['"]|['"]$/g, '');
    const match = new RegExp(
      `^${escapeRegExp(rootClass)}-font-(regular|bold|italic|semibold|mono)$`,
    ).exec(family);
    if (match === null) throw new D2Error('D2 SVG requested an unsupported font family');
    declaration.value = match[1] === 'mono' ? D2_MONO_FONT_FAMILY : D2_FONT_FAMILY;
    if (match[1] === 'bold' || match[1] === 'semibold') {
      rule.append({ prop: 'font-weight', value: match[1] === 'bold' ? '700' : '600' });
    }
    if (match[1] === 'italic') rule.append({ prop: 'font-style', value: 'italic' });
  });
}

function readD2RootClass(svg: string): string {
  const candidates = [...svg.matchAll(/<svg\b[^>]*\bclass\s*=\s*(['"])(.*?)\1[^>]*>/gi)]
    .flatMap((match) => match[2]?.split(/\s+/) ?? [])
    .filter((name) => /^d2-\d+$/.test(name));
  const unique = [...new Set(candidates)];
  if (unique.length !== 1) throw new D2Error('D2 SVG did not contain one generated root class');
  return unique[0]!;
}

function replaceClassAttribute(svg: string, sourceClass: string, targetClass: string): string {
  const pattern = /(<svg\b[^>]*\bclass\s*=\s*)(['"])(.*?)\2([^>]*>)/gi;
  return svg.replace(
    pattern,
    (_match, before: string, quote: string, value: string, after: string) => {
      const classes = value.split(/\s+/).map((name) => (name === sourceClass ? targetClass : name));
      return `${before}${quote}${classes.join(' ')}${quote}${after}`;
    },
  );
}

function readAttribute(tag: string, name: string): string | undefined {
  const escapedName = escapeRegExp(name);
  const match = new RegExp(`(?:^|\\s)${escapedName}\\s*=\\s*(["'])(.*?)\\1`, 'i').exec(tag);
  return match?.[2];
}

function setAttribute(tag: string, name: string, value: string): string {
  if (readAttribute(tag, name) !== undefined) {
    const pattern = new RegExp(`((?:^|\\s)${escapeRegExp(name)}\\s*=\\s*)(["']).*?\\2`, 'i');
    return tag.replace(
      pattern,
      (_match, prefix: string, quote: string) => `${prefix}${quote}${value}${quote}`,
    );
  }
  return tag.replace(/>$/, ` ${name}="${value}">`);
}

function parseLength(value: string): number | undefined {
  const match = /^(\d+(?:\.\d+)?|\.\d+)\s*(?:px)?$/i.exec(value.trim());
  if (match?.[1] === undefined) return undefined;
  const length = Number(match[1]);
  return Number.isFinite(length) && length > 0 && length <= D2_MAX_SVG_SIDE ? length : undefined;
}

function containsClass(selector: string, className: string): boolean {
  return new RegExp(`\\.${escapeRegExp(className)}(?=$|[^\\w-])`).test(selector);
}

function replaceClass(selector: string, sourceClass: string, targetClass: string): string {
  return selector.replace(
    new RegExp(`\\.${escapeRegExp(sourceClass)}(?=$|[^\\w-])`, 'g'),
    `.${targetClass}`,
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
