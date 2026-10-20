import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { compileMarkdown } from '../src/compiler.js';
import { DiagnosticError } from '../src/errors.js';
import {
  isMermaidCliAvailable,
  MAX_MERMAID_SOURCE_BYTES,
  mermaidRenderer,
  parseMermaidErrors,
} from '../src/renderers/mermaid.js';

const diagrams = [
  {
    language: 'mermaid',
    source: 'flowchart LR\n  A[Start] --> B[Finish]',
    text: 'Start',
  },
  {
    language: 'mermaid',
    source:
      'sequenceDiagram\n  participant U as User\n  participant S as Server\n  U->>S: Request\n  S-->>U: Response',
    text: 'Request',
  },
  {
    language: 'mermaid',
    source:
      'classDiagram\n  class User {\n    +String name\n    +login()\n  }\n  class Session\n  User --> Session',
    text: 'User',
  },
  {
    language: 'mermaid',
    source: 'stateDiagram-v2\n  [*] --> Idle\n  Idle --> Ready: start\n  Ready --> [*]',
    text: 'Idle',
  },
  {
    language: 'mermaid',
    source: 'erDiagram\n  USER ||--o{ SESSION : owns\n  USER {\n    int id\n    string email\n  }',
    text: 'SESSION',
  },
];

describe('Mermaid renderer', () => {
  it('extracts a non-fatal syntax diagnostic and its local source location from CLI output', () => {
    expect(
      parseMermaidErrors(
        "Error: Parse error on line 2:\nA -->\n----^\nExpecting 'NEWLINE', got 'EOF'\n    at Parser.parseError (mermaid.js:1:1)",
      ),
    ).toEqual([
      {
        message: "Parse error: Expecting 'NEWLINE', got 'EOF'",
        line: 2,
      },
    ]);
  });

  it('resolves and runs the official local Mermaid CLI', () => {
    expect(isMermaidCliAvailable()).toBe(true);
  });

  it('renders flowchart, sequence, class, state, and ER diagrams as inline SVG', async () => {
    const markdown = diagrams
      .map(({ language, source }) => `\`\`\`${language}\n${source}\n\`\`\``)
      .join('\n\n');
    const compiled = await compileMarkdown(markdown, { sourceFile: 'diagrams.md' });

    expect(compiled.html.match(/<figure class="bp-diagram bp-diagram--mermaid"/g)).toHaveLength(5);
    expect(
      compiled.html.match(
        /<pre class="bp-diagram-container"><figure class="bp-diagram bp-diagram--mermaid"/g,
      ),
    ).toHaveLength(5);
    const svgRoots = [...compiled.html.matchAll(/<svg\b[^>]*>/g)].map((match) => match[0]);
    expect(svgRoots).toHaveLength(5);
    for (const svgRoot of svgRoots) {
      expect(svgRoot).not.toMatch(/\bwidth="[^"]*%/);
      expect(svgRoot).toContain('background-color: transparent');
    }
    for (const diagram of diagrams) {
      expect(compiled.html).toContain(diagram.text);
    }
    expect(compiled.html).not.toContain('<foreignObject');
    expect(compiled.html).not.toContain('<script');
  }, 60_000);

  it('keeps repeated diagram SVG IDs and marker references unique', async () => {
    const source = 'flowchart LR\n  A[One] --> B[Two]';
    const compiled = await compileMarkdown(
      `\`\`\`mermaid\n${source}\n\`\`\`\n\n\`\`\`mermaid\n${source}\n\`\`\``,
      { sourceFile: 'repeated.md' },
    );
    const ids = [...compiled.html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    const markerReferences = [...compiled.html.matchAll(/marker-end="url\(#([^)]*)\)"/g)].map(
      (match) => match[1],
    );

    expect(compiled.html.match(/<svg\b/g)).toHaveLength(2);
    expect(new Set(ids).size).toBe(ids.length);
    expect(markerReferences).toHaveLength(2);
    expect(new Set(markerReferences).size).toBe(2);
    for (const reference of markerReferences) {
      expect(ids).toContain(reference);
    }
  }, 60_000);

  it('uses isolated temporary directories and removes them after rendering', async () => {
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'blueprint4llm-test-'));
    const previousTmpdir = process.env.TMPDIR;
    process.env.TMPDIR = temporaryRoot;

    try {
      await mermaidRenderer.render('flowchart LR\n  A --> B', {
        diagramId: 'bp-diagram-temp-test',
        sourceFile: 'temporary.md',
        line: 1,
      });

      expect(await readdir(temporaryRoot)).toEqual([]);
    } finally {
      if (previousTmpdir === undefined) {
        delete process.env.TMPDIR;
      } else {
        process.env.TMPDIR = previousTmpdir;
      }
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }, 60_000);

  it('reports an invalid Mermaid block at its failing source line', async () => {
    const markdown = '# Broken\n\n```mermaid\nflowchart LR\n  A -->\n```';

    await expect(compileMarkdown(markdown, { sourceFile: 'broken.md' })).rejects.toMatchObject({
      name: 'DiagnosticError',
      sourceFile: 'broken.md',
      line: 5,
      column: 1,
      message: expect.stringContaining('mermaid render failed'),
    } satisfies Partial<DiagnosticError>);
  }, 60_000);

  it('leaves unknown fenced languages as ordinary code and enforces a diagram size limit', async () => {
    const compiled = await compileMarkdown('```mermaid-like\nflowchart LR\n```', {
      sourceFile: 'unknown-language.md',
    });
    expect(compiled.html).toContain('class="language-mermaid-like"');
    expect(compiled.html).not.toContain('bp-diagram--mermaid');

    const tooLarge = 'a'.repeat(MAX_MERMAID_SOURCE_BYTES + 1);
    await expect(
      mermaidRenderer.render(tooLarge, {
        diagramId: 'bp-diagram-large',
        sourceFile: 'large.md',
        line: 1,
      }),
    ).rejects.toThrow(/diagram is too large/);
  });
});
