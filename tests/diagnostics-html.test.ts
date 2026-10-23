import type { Root } from 'hast';
import { describe, expect, it } from 'vitest';

import { createDiagnosticCard, rehypeDiagnosticSummaryPlugin } from '../src/diagnostics-html.js';
import type { BlueprintDiagnostic } from '../src/diagnostics.js';

describe('diagnostics HTML helpers', () => {
  it('inserts an accessible summary when enabled', () => {
    const tree: Root = {
      type: 'root',
      children: [{ type: 'text', value: 'document text' }],
    };

    rehypeDiagnosticSummaryPlugin({ diagnostics: [], language: 'en', enabled: true })(tree);

    expect(tree.children[0]).toMatchObject({
      type: 'element',
      tagName: 'section',
      properties: {
        className: ['bp-diagnostics-summary', 'bp-diagnostics-summary--success'],
        role: 'status',
      },
      children: [{ type: 'text', value: 'Document check: 0 errors · 0 warnings' }],
    });
    expect(tree.children[1]).toMatchObject({ type: 'text', value: 'document text' });
  });

  it('leaves the document tree unchanged when the summary is disabled', () => {
    const tree: Root = {
      type: 'root',
      children: [{ type: 'text', value: 'document text' }],
    };

    rehypeDiagnosticSummaryPlugin({ diagnostics: [], language: 'en', enabled: false })(tree);

    expect(tree.children).toEqual([{ type: 'text', value: 'document text' }]);
  });

  it('creates a diagnostic card from text nodes so messages remain escaped at serialization', () => {
    const card = createDiagnosticCard(
      makeDiagnostic({ message: '<script>alert("x")</script>\ncontinued' }),
      'ru',
    );

    expect(card.properties).toMatchObject({
      className: ['bp-diagnostic', 'bp-diagnostic--error'],
      role: 'alert',
    });
    expect(card.children[0]).toMatchObject({
      type: 'element',
      tagName: 'h3',
      children: [{ type: 'text', value: 'Ошибка при построении схемы' }],
    });
    expect(card.children[2]).toMatchObject({
      type: 'element',
      tagName: 'pre',
      children: [{ type: 'text', value: '<script>alert("x")</script>\ncontinued' }],
    });
  });
});

function makeDiagnostic(overrides: Partial<BlueprintDiagnostic> = {}): BlueprintDiagnostic {
  return {
    severity: 'error',
    code: 'diagram.render',
    scope: 'diagram',
    sourceFile: 'plan.md',
    line: 12,
    column: 4,
    renderer: 'mermaid',
    diagramId: 'bp-diagram-001',
    message: 'failed',
    ...overrides,
  };
}
