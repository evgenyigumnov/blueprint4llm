import { describe, expect, it } from 'vitest';

import { escapeHtml, renderHtmlPage } from '../src/template.js';

describe('HTML template', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml(`&< >"'`)).toBe('&amp;&lt; &gt;&quot;&#39;');
  });

  it('creates a complete page and escapes metadata', () => {
    const html = renderHtmlPage({
      lang: 'en" onload="bad',
      title: '<title & value>',
      bodyHtml: '<p>Safe rendered body</p>',
    });

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<html lang="en&quot; onload=&quot;bad">');
    expect(html).toContain('<title>&lt;title &amp; value&gt;</title>');
    expect(html).toContain('<p>Safe rendered body</p>');
    expect(html).toContain('@media print');
    expect(html).toContain('@media screen and (max-width: 640px)');
    expect(html).toContain('overflow-x: auto');
    expect(html).toMatch(/\.bp-diagram > svg \{[^}]*margin: 0;/);
    expect(html).toMatch(/\.bp-diagnostic \{[^}]*white-space: normal;/);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<link');
    expect(html).not.toContain('cdn.');
  });

  it('adds an optional serve-mode tail before the closing body tag', () => {
    const html = renderHtmlPage({
      lang: 'en',
      title: 'Document',
      bodyHtml: '<p>Body</p>',
      tailHtml: '<script>liveReload()</script>',
    });
    expect(html.indexOf('<script>liveReload()</script>')).toBeLessThan(html.indexOf('</body>'));
  });
});
