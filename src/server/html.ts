import type { CompiledBlueprint } from '../compiler.js';
import { escapeHtml } from '../template.js';

function reloadScript(version: string): string {
  const encodedVersion = encodeURIComponent(version);
  return `<script>(() => {
  const events = new EventSource('/_blueprint4llm/events?version=${encodedVersion}');
  events.addEventListener('reload', () => location.reload());
})();</script>`;
}

/** Adds the server-only download control and live-reload client to compiled HTML. */
export function createPreviewHtml(compiled: CompiledBlueprint, version: string): string {
  return compiled.html.replace(
    '</body>',
    `<style>
:root[data-bp-theme="dark"]{color-scheme:dark;--bp-text:#e6edf3;--bp-muted:#8b949e;--bp-border:#30363d;--bp-surface:#161b22;--bp-page-bg:#0d1117;--bp-accent:#58a6ff;--bp-code-bg:#21262d;--bp-diagnostic-error:#ff7b72;--bp-diagnostic-warning:#e3b341;--bp-diagnostic-error-bg:#2d1618;--bp-diagnostic-warning-bg:#2b2416}
:root[data-bp-theme="dark"] .bp-diagram:not(.bp-diagram--vega-lite)>svg{filter:invert(1) hue-rotate(180deg)}
.bp-diagram--vega-lite{background:#fff}
.bp-preview-tools{position:fixed;right:1rem;top:1rem;z-index:10;display:flex;gap:.5rem}
.bp-preview-tools a,.bp-preview-tools button{display:inline-block;padding:.55rem .8rem;border:1px solid var(--bp-border);border-radius:6px;background:var(--bp-surface);color:var(--bp-accent);box-shadow:0 2px 8px #0002;font:inherit;cursor:pointer}
.bp-preview-tools a:hover,.bp-preview-tools button:hover{text-decoration:underline}
.bp-preview-tools a:focus-visible,.bp-preview-tools button:focus-visible{outline:2px solid var(--bp-accent);outline-offset:2px}
</style>
<aside class="bp-preview-tools"><a href="/document.pdf" download="index.pdf">Download PDF</a><button id="bp-preview-theme-toggle" type="button" aria-pressed="false">Dark mode</button></aside>
<script>(() => {
  const root = document.documentElement;
  const button = document.getElementById('bp-preview-theme-toggle');
  if (!button) return;
  const storageKey = 'blueprint4llm-theme';
  try {
    if (localStorage.getItem(storageKey) === 'dark') root.dataset.bpTheme = 'dark';
  } catch {}
  const updateButton = () => {
    const isDark = root.dataset.bpTheme === 'dark';
    button.textContent = isDark ? 'Light mode' : 'Dark mode';
    button.setAttribute('aria-pressed', String(isDark));
  };
  updateButton();
  button.addEventListener('click', () => {
    const isDark = root.dataset.bpTheme !== 'dark';
    if (isDark) root.dataset.bpTheme = 'dark';
    else delete root.dataset.bpTheme;
    try {
      if (isDark) localStorage.setItem(storageKey, 'dark');
      else localStorage.removeItem(storageKey);
    } catch {}
    updateButton();
  });
})();</script>
${reloadScript(version)}
</body>`,
  );
}

/** Renders an escaped diagnostic page when the latest preview build has failed. */
export function createDiagnosticHtml(
  message: string,
  version: string,
  includeDiagnosticsSummary = false,
): string {
  const summary = includeDiagnosticsSummary
    ? '<section class="bp-diagnostics-summary" role="alert">Document check: 1 error · 0 warnings</section>'
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Blueprint preview error</title>
<style>
body{margin:0;padding:2rem;background:#f6f8fa;color:#1f2328;font:16px/1.6 system-ui,sans-serif}
main{max-width:54rem;margin:0 auto;padding:2rem;background:#fff;border:1px solid #d0d7de;border-radius:8px}
h1{margin-top:0}.bp-diagnostics-summary{margin:1rem 0;padding:.75rem 1rem;border:1px solid #b42318;border-inline-start-width:5px;font-weight:650}pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:1rem;background:#fff;border:1px solid #d0d7de;border-radius:6px}
</style>
</head>
<body><main><h1>Blueprint preview build failed</h1>${summary}<p>Fix the source file and save it to rebuild the preview.</p><pre>${escapeHtml(message)}</pre></main>
${reloadScript(version)}
</body>
</html>
`;
}

/** A useful initial response before the first source read has finished. */
export function createBuildingHtml(version: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Building preview</title></head><body><p>Building blueprint preview…</p>${reloadScript(version)}</body></html>`;
}
