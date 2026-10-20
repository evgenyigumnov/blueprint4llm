import type { Element, Root as HastRoot } from 'hast';

const SAFE_PROTOCOLS = new Set(['http', 'https', 'mailto', 'tel']);

/** Removes link targets whose URL scheme can execute or embed active content. */
export function remarkSafeLinksPlugin() {
  return (tree: HastRoot): void => {
    sanitizeLinks(tree);
  };
}

function sanitizeLinks(node: HastRoot | Element): void {
  for (const child of node.children) {
    if (child.type !== 'element') {
      continue;
    }

    if (child.tagName === 'a') {
      const href = child.properties.href;
      if (typeof href === 'string' && !isSafeHref(href)) {
        delete child.properties.href;
      }
    }

    sanitizeLinks(child);
  }
}

function isSafeHref(href: string): boolean {
  const value = href.trim();
  const colon = value.indexOf(':');
  const boundary = [value.indexOf('/'), value.indexOf('?'), value.indexOf('#')]
    .filter((index) => index >= 0)
    .reduce((first, index) => Math.min(first, index), value.length);

  if (colon < 0 || colon > boundary) {
    return true;
  }

  return SAFE_PROTOCOLS.has(value.slice(0, colon).toLowerCase());
}
