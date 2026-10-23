import type { Element, ElementContent, Root } from 'hast';

import { summarizeDiagnostics } from './diagnostics.js';
import type { BlueprintDiagnostic } from './diagnostics.js';

export interface DiagnosticHtmlOptions {
  diagnostics: readonly BlueprintDiagnostic[];
  language: 'ru' | 'en';
  enabled: boolean;
}

/** Adds a readable document summary before the Markdown content. */
export function rehypeDiagnosticSummaryPlugin(options: DiagnosticHtmlOptions) {
  return (tree: Root): void => {
    if (options.enabled) {
      tree.children.unshift(createDiagnosticSummary(options.diagnostics, options.language));
    }
  };
}

/** Creates an escaped-by-serialization diagnostic card from text nodes. */
export function createDiagnosticCard(
  diagnostic: BlueprintDiagnostic,
  language: 'ru' | 'en',
): Element {
  const heading =
    language === 'ru'
      ? diagnostic.severity === 'error'
        ? 'Ошибка при построении схемы'
        : 'Предупреждение renderer'
      : diagnostic.severity === 'error'
        ? 'Diagram rendering error'
        : 'Renderer warning';
  const location = [
    diagnostic.line === undefined
      ? diagnostic.sourceFile
      : `${diagnostic.sourceFile}:${diagnostic.line}:${diagnostic.column ?? 1}`,
    diagnostic.renderer,
    diagnostic.code,
  ]
    .filter((part): part is string => part !== undefined)
    .join(' · ');
  const severity = diagnostic.severity;

  return element(
    'section',
    {
      className: ['bp-diagnostic', `bp-diagnostic--${severity}`],
      role: severity === 'error' ? 'alert' : 'status',
      'aria-label': heading,
    },
    [
      element('h3', { className: ['bp-diagnostic__title'] }, [text(heading)]),
      element('p', { className: ['bp-diagnostic__location'] }, [text(location)]),
      element('pre', { className: ['bp-diagnostic__message'] }, [text(diagnostic.message)]),
    ],
  );
}

function createDiagnosticSummary(
  diagnostics: readonly BlueprintDiagnostic[],
  language: 'ru' | 'en',
): Element {
  const summary = summarizeDiagnostics(diagnostics);
  const severity = summary.errors > 0 ? 'error' : summary.warnings > 0 ? 'warning' : 'success';
  const message =
    language === 'ru'
      ? `Проверка документа: ошибок ${summary.errors} · предупреждений ${summary.warnings}`
      : `Document check: ${summary.errors} errors · ${summary.warnings} warnings`;

  return element(
    'section',
    {
      className: ['bp-diagnostics-summary', `bp-diagnostics-summary--${severity}`],
      role: summary.errors > 0 ? 'alert' : 'status',
      'aria-live': summary.errors > 0 ? 'assertive' : 'polite',
      'aria-atomic': 'true',
    },
    [text(message)],
  );
}

function element(
  tagName: string,
  properties: Element['properties'],
  children: ElementContent[],
): Element {
  return { type: 'element', tagName, properties, children };
}

function text(value: string): ElementContent {
  return { type: 'text', value };
}
