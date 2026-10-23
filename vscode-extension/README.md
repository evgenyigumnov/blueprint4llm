# Blueprint4llm Preview for VS Code

This package is the desktop VS Code shell for the existing `blueprint4llm` renderer. It opens `.md` documents in a Webview beside the editor, compiles unsaved text, and refreshes the panel as the document changes.

## Requirements

- Visual Studio Code `1.101.0` or newer. Version 1.101 updated the Node.js extension host to `22.15.1`, which meets the renderer's Node.js `>=22.13.0` requirement.
- A supported desktop OS and architecture: Windows x64, macOS x64 or arm64, or Linux x64 or arm64 with the system libraries required by Chrome for Testing. Windows arm64 is not included because Puppeteer's Chrome for Testing download does not list that platform.
- Chrome for Testing installed through Puppeteer. The browser is kept in Puppeteer's user cache and is not included in the VSIX.

If Mermaid reports that Chrome is missing, install the browser from the extension directory:

```bash
npx puppeteer browsers install chrome
```

On Debian or Ubuntu, install Chrome's required system packages as well:

```bash
npx puppeteer browsers install chrome --install-deps
```

## Usage

Open a Markdown file and run **Blueprint: Open Preview to the Side** from the Command Palette, editor title, or editor context menu. The same command focuses the existing preview for that file. Edits refresh the preview after the configured debounce, which defaults to 200 ms. Change it with `blueprint4llm.preview.debounceMs`.

With a successful preview open, run **Blueprint: Export Preview as PDF**. The export uses the exact compiled result currently shown in the panel, opens a save dialog next to the Markdown file, and includes local images. External images cannot be embedded in the PDF; save them beside the Markdown file and use a relative path. PDF generation uses the same Puppeteer-managed Chrome installation described above.

When one diagram has a renderer error, the preview keeps the rest of the document and valid diagrams, then places each full diagnostic beside its diagram. The overall error and warning count is hidden by default. Enable `blueprint4llm.preview.includeDiagnosticsSummary` to show it. The next successful edit removes resolved diagnostics. A document-level failure, such as a missing local image, still shows a diagnostic page. PDF export uses the exact current preview, including inline diagram diagnostics when present.

Local images are copied into per-document Webview resource folders and removed when the panel closes. The Webview has scripts disabled and receives a restrictive Content Security Policy. Mermaid and Wiremark use the same compiler as the CLI.

The preview follows VS Code light, dark, and high contrast themes. Text, links, code blocks, diagnostic cards, and borders use the active theme's Webview color variables; diagrams are adjusted for dark and high contrast backgrounds. Vega-Lite charts keep their data colors and use a light chart surface. Diagnostic severity is stated in text and remains distinguishable in high contrast mode.

Vega-Lite 6 fences (`vega-lite` and `vegalite`) render offline from the bundled Vega runtime and local schema. Charts use strict JSON and embedded `data.values` or `datasets`; the output is static SVG. External data, image marks, interactive selections, tooltip interactions, and automatic container resize are not supported. See the core package README for limits and the Vega-Lite example.

## Development

From the repository root, install and build the core package first. Then install the extension's development dependencies:

```bash
npm install
npm run build
cd vscode-extension
npm install
npm run test:host
npm run test:package
npm run package
```

`npm run test:host` starts an Extension Development Host at the minimum supported VS Code version. On headless Linux, run it under `xvfb-run -a`.

`npm run test:package` builds a VSIX in a temporary directory, checks that the Vega browser bundles and schema are packaged, launches the unpacked package in the Extension Development Host, renders Mermaid and Vega-Lite through the packaged runtime, and checks the missing Chrome diagnostic. Run both checks with `npm test`.

## Installation

After packaging the extension, install the generated VSIX with the VS Code CLI:

```bash
code --install-extension <path-to-file.vsix>
```
