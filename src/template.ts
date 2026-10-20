const HTML_ESCAPES = new Map<string, string>([
  ['&', '&amp;'],
  ['<', '&lt;'],
  ['>', '&gt;'],
  ['"', '&quot;'],
  ["'", '&#39;'],
]);

const ESCAPE_RE = /[&<>"']/g;

/** Escapes text so it can be embedded safely in HTML text or attribute values. */
export function escapeHtml(value: string): string {
  return value.replace(ESCAPE_RE, (char) => HTML_ESCAPES.get(char) ?? char);
}

export interface PageOptions {
  lang: string;
  title: string;
  /** HTML fragment produced by the Markdown pipeline (already escaped by rehype). */
  bodyHtml: string;
  /** Extra HTML injected right before `</body>` (used by `--serve` live reload). */
  tailHtml?: string;
}

/**
 * Wraps a compiled body fragment into a complete, self-contained HTML5 document.
 * No scripts, no CDN, no external stylesheets by default.
 */
export function renderHtmlPage(options: PageOptions): string {
  const tail = options.tailHtml ?? '';
  return `<!doctype html>
<html lang="${escapeHtml(options.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.title)}</title>
<style>
${BASE_CSS}
</style>
</head>
<body>
<main class="bp-document">
${options.bodyHtml.trim()}
</main>
${tail}
</body>
</html>
`;
}

const BASE_CSS = `:root {
  color-scheme: light;
  --bp-text: #1f2328;
  --bp-muted: #656d76;
  --bp-border: #d0d7de;
  --bp-surface: #ffffff;
  --bp-page-bg: #f6f8fa;
  --bp-accent: #0a5bd3;
  --bp-code-bg: #f6f8fa;
}

* {
  box-sizing: border-box;
}

html {
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  background: var(--bp-page-bg);
  color: var(--bp-text);
  font-family:
    system-ui,
    -apple-system,
    'Segoe UI',
    Roboto,
    'Helvetica Neue',
    Arial,
    'Noto Sans',
    sans-serif;
  font-size: 16px;
  line-height: 1.65;
}

.bp-document {
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 2.5rem 1.5rem 4rem;
  background: var(--bp-surface);
  border: none;
}

h1,
h2,
h3,
h4,
h5,
h6 {
  line-height: 1.3;
  margin: 1.8em 0 0.7em;
  break-after: avoid;
  page-break-after: avoid;
}

h1 {
  font-size: 2rem;
  margin-top: 0;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--bp-border);
}

h2 {
  font-size: 1.5rem;
}

h3 {
  font-size: 1.25rem;
}

h4,
h5,
h6 {
  font-size: 1.05rem;
}

p,
li {
  orphans: 3;
  widows: 3;
}

a {
  color: var(--bp-accent);
  text-decoration: none;
  overflow-wrap: break-word;
}

a:hover {
  text-decoration: underline;
}

img {
  max-width: 100%;
  height: auto;
}

blockquote {
  margin: 1em 0;
  padding: 0.2em 1em;
  color: var(--bp-muted);
  border-left: 4px solid var(--bp-border);
}

code {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 0.9em;
  background: var(--bp-code-bg);
  padding: 0.15em 0.35em;
  border-radius: 4px;
  overflow-wrap: break-word;
}

pre {
  margin: 1em 0;
  padding: 0.9em 1em;
  background: var(--bp-code-bg);
  border: 1px solid var(--bp-border);
  border-radius: 6px;
  overflow-x: auto;
}

pre.bp-diagram-container {
  margin: 0;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0;
  overflow: visible;
}

pre code {
  background: none;
  padding: 0;
  font-size: 0.875em;
  line-height: 1.5;
}

.bp-table {
  margin: 1em 0;
  overflow-x: auto;
  overscroll-behavior-x: contain;
}

table {
  border-collapse: collapse;
  font-size: 0.95em;
}

th,
td {
  border: 1px solid var(--bp-border);
  padding: 0.4em 0.8em;
  text-align: left;
  vertical-align: top;
}

thead th {
  background: var(--bp-code-bg);
}

hr {
  border: none;
  border-top: 1px solid var(--bp-border);
  margin: 2em 0;
}

ul[data-task-list] li,
li > input[type='checkbox'] {
  margin-right: 0.4em;
}

.bp-diagram {
  max-width: 100%;
  margin: 1.5rem 0;
  padding: 0;
  background: transparent;
  border: none;
  overflow-x: auto;
  overscroll-behavior-x: contain;
}

.bp-diagram > svg {
  display: block;
  max-width: none;
  width: auto;
  height: auto;
  margin: 0 auto;
}

@media screen and (max-width: 640px) {
  .bp-document {
    padding: 1.25rem 1rem 3rem;
    border: none;
  }

  body {
    font-size: 15px;
  }
}

@media print {
  :root {
    --bp-page-bg: #ffffff;
  }

  body {
    background: #ffffff;
    font-size: 11pt;
    line-height: 1.5;
  }

  .bp-document {
    max-width: none;
    margin: 0;
    padding: 0;
    border: none;
  }

  pre {
    white-space: pre-wrap;
    overflow-wrap: break-word;
    overflow: visible;
  }

  code {
    overflow-wrap: break-word;
  }

  .bp-table {
    overflow: visible;
  }

  .bp-diagram {
    overflow: visible;
  }

  .bp-diagram > svg {
    max-width: 100% !important;
  }

  table {
    width: 100%;
    table-layout: fixed;
  }

  thead {
    display: table-header-group;
  }

  tr,
  img,
  figure,
  .bp-diagram,
  blockquote {
    break-inside: avoid;
    page-break-inside: avoid;
  }
}
`;
