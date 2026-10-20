const DIAGRAM_HEADER_PATTERN =
  /^[ \t]*(flowchart|graph|classDiagram|stateDiagram(?:-v2)?|erDiagram|requirementDiagram|usecase-beta|swimlane-beta|timeline|gitGraph|agentflow-beta)(?:[ \t]+(?:TD|TB|BT|LR|RL))?[ \t]*:?[ \t]*(?:%%.*)?$/i;

const DIRECTION_STATEMENT_TYPES = new Set([
  'flowchart',
  'graph',
  'classdiagram',
  'statediagram',
  'statediagram-v2',
  'erdiagram',
  'requirementdiagram',
  'usecase-beta',
]);

/** Makes Mermaid diagrams use a top-to-bottom layout wherever the syntax supports it. */
export function forceVerticalMermaidDirection(source: string): string {
  const lines = source.split(/(\r\n|\r|\n)/);
  let diagramType: string | undefined;
  let headerIndex = -1;

  for (let index = 0; index < lines.length; index += 2) {
    const match = lines[index]?.match(DIAGRAM_HEADER_PATTERN);
    if (match !== null && match !== undefined) {
      diagramType = match[1]?.toLowerCase();
      headerIndex = index;
      break;
    }
  }

  if (diagramType === undefined) {
    return source;
  }

  for (let index = 0; index < lines.length; index += 2) {
    const line = lines[index];
    if (line === undefined) {
      continue;
    }

    if (DIRECTION_STATEMENT_TYPES.has(diagramType)) {
      lines[index] = line.replace(/^(\s*direction\s+)(?:TD|TB|BT|LR|RL)(\s*(?:%%.*)?)$/i, '$1TB$2');
    }

    if (index !== headerIndex) {
      continue;
    }

    lines[index] = normalizeHeaderDirection(line, diagramType);
  }

  return lines.join('');
}

function normalizeHeaderDirection(line: string, diagramType: string): string {
  switch (diagramType) {
    case 'flowchart':
    case 'graph':
      return line.replace(
        /^([ \t]*(?:flowchart|graph))(?:[ \t]+(?:TD|TB|BT|LR|RL))?([ \t]*(?:%%.*)?)$/i,
        '$1 TB$2',
      );
    case 'swimlane-beta':
    case 'agentflow-beta':
      return line.replace(
        /^([ \t]*\S+)(?:[ \t]+(?:TD|TB|BT|LR|RL))?([ \t]*(?:%%.*)?)$/i,
        '$1 TB$2',
      );
    case 'timeline':
      return line.replace(
        /^([ \t]*timeline)(?:[ \t]+(?:TD|TB|BT|LR|RL))?([ \t]*(?:%%.*)?)$/i,
        '$1 TD$2',
      );
    case 'gitgraph':
      return line.replace(
        /^([ \t]*gitGraph)(?:[ \t]+(?:TB|BT|LR))?([ \t]*:?[ \t]*(?:%%.*)?)$/i,
        (_match, prefix: string, suffix: string) => {
          const comment = suffix.match(/%%.*$/)?.[0];
          return `${prefix} TB:${comment === undefined ? '' : ` ${comment}`}`;
        },
      );
    default:
      return line;
  }
}
