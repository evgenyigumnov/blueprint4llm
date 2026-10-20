import type { Element, RootContent } from 'hast';

/** Gives IDs in one inline SVG a document-unique prefix and updates references. */
export function scopeSvgIds(svg: Element, prefix: string): void {
  const firstScopedIdBySourceId = new Map<string, string>();
  const scopedIdsByElement = new WeakMap<Element, string>();
  const usedIds = new Set<string>();

  visit(svg, (element) => {
    const id = element.properties.id;
    if (typeof id === 'string') {
      const scopedId = uniqueId(`${prefix}-${id}`, usedIds);
      scopedIdsByElement.set(element, scopedId);
      if (!firstScopedIdBySourceId.has(id)) {
        firstScopedIdBySourceId.set(id, scopedId);
      }
    }
  });

  visit(
    svg,
    (element) => {
      for (const [name, value] of Object.entries(element.properties)) {
        if (name === 'id' && typeof value === 'string') {
          element.properties[name] = scopedIdsByElement.get(element) ?? `${prefix}-${value}`;
        } else if (typeof value === 'string') {
          element.properties[name] = rewriteReferences(value, name, firstScopedIdBySourceId);
        }
      }
    },
    firstScopedIdBySourceId,
  );
}

function uniqueId(base: string, usedIds: Set<string>): string {
  let candidate = base;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

function rewriteReferences(value: string, propertyName: string, ids: Map<string, string>): string {
  let rewritten = value.replace(/url\(#([^\s)]+)\)/g, (reference, id: string) => {
    const scopedId = ids.get(id);
    return scopedId === undefined ? reference : `url(#${scopedId})`;
  });

  if ((propertyName === 'href' || propertyName === 'xLinkHref') && rewritten.startsWith('#')) {
    rewritten = `#${ids.get(rewritten.slice(1)) ?? rewritten.slice(1)}`;
  }
  return rewritten;
}

function visit(
  node: RootContent | Element,
  action: (element: Element) => void,
  ids?: Map<string, string>,
  insideStyle = false,
): void {
  if (node.type === 'text') {
    if (insideStyle && ids !== undefined) {
      node.value = rewriteStylesheetReferences(node.value, ids);
    }
    return;
  }
  if (node.type !== 'element') {
    return;
  }

  action(node);
  for (const child of node.children) {
    visit(child, action, ids, insideStyle || node.tagName.toLowerCase() === 'style');
  }
}

function rewriteStylesheetReferences(value: string, ids: Map<string, string>): string {
  const withFragments = rewriteReferences(value, 'style', ids);
  return withFragments.replace(
    /(^|[{}])([^{}]*)\{/gm,
    (match, boundary: string, selector: string) => {
      if (selector.trimStart().startsWith('@')) {
        return match;
      }
      const rewrittenSelector = selector.replace(
        /#([A-Za-z_][\w:.-]*)/g,
        (reference, id: string) => {
          const scopedId = ids.get(id);
          return scopedId === undefined ? reference : `#${scopedId}`;
        },
      );
      return `${boundary}${rewrittenSelector}{`;
    },
  );
}
