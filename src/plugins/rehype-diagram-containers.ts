import type { Element, Root } from 'hast';

/** Marks the `<pre>` wrapper that remark-rehype adds around rendered diagrams. */
export function rehypeDiagramContainersPlugin() {
  return (tree: Root) => {
    markDiagramContainers(tree);
  };
}

function markDiagramContainers(node: Root | Element): void {
  for (const child of node.children) {
    if (child.type !== 'element') {
      continue;
    }

    if (child.tagName === 'pre' && containsOnlyDiagram(child)) {
      const className = child.properties.className;
      const classes = Array.isArray(className) ? className : [];
      if (!classes.includes('bp-diagram-container')) {
        child.properties.className = [...classes, 'bp-diagram-container'];
      }
      continue;
    }

    markDiagramContainers(child);
  }
}

function containsOnlyDiagram(pre: Element): boolean {
  const content = pre.children.filter(
    (child) => child.type !== 'text' || child.value.trim().length > 0,
  );
  if (content.length !== 1) {
    return false;
  }

  const figure = content[0];
  return figure?.type === 'element' && figure.tagName === 'figure' && hasDiagramClass(figure);
}

function hasDiagramClass(element: Element): boolean {
  const className = element.properties.className;
  return Array.isArray(className) && className.includes('bp-diagram');
}
