# Changelog

## [0.22.7] — 2026-10-24

### Changed

- Restore release notes for versions recorded in the Git history.

## [0.22.6] — 2026-10-23

### Fixed

- Load ECharts modules from file URLs in the rendering worker and reject font-family values that could break generated SVG styles.

## [0.22.5] — 2026-10-23

### Improved

- Refresh format examples, preview artwork, and README documentation.

## [0.22.4] — 2026-10-23

### Changed

- Remove the legacy text-based UI renderer and its dependency. Use Balsamiq for UI prototypes in examples, exported documents, documentation, and README artwork.

## [0.22.2] — 2026-10-23

### Added

- Add README instructions for installing and using the `blueprint4llm` skill with Codex and Claude Code.

## [0.22.1] — 2026-10-23

### Added

- Support D2 and Graphviz diagrams, Excalidraw scenes, and Apache ECharts charts, rendered locally as SVG.

## [0.21.0] — 2026-10-23

### Added

- Render Vega-Lite 6 specifications with embedded data as static SVG, with schema validation and local rendering.

## [0.20.0] — 2026-10-23

### Added

- Add structured diagnostics, JSON diagnostic reports, and the `--diagnostics-summary` option for CLI exports and previews.

## [0.18.0] — 2026-10-23

### Improved

- Refactor OpenAPI layout generation into dedicated modules and expand its layout tests.

## [0.17.0] — 2026-10-23

### Added

- Render OpenAPI 3.1.1 JSON or YAML contracts as static SVG references, including operations, parameters, request and response bodies, component schemas, and local references.

## [0.16.15] — 2026-10-22

### Changed

- Refresh the README and examples, and add reference documentation for supported formats.

## [0.16.7] — 2026-10-22

No functional changes. This version updates package metadata and removes an obsolete development checklist.

## [0.16.3] — 2026-10-22

No functional changes. This version updates package metadata and repository instructions.

## [0.16.1] — 2026-10-22

### Changed

- Clarify the project overview and installation instructions in the README.

## [0.16.0] — 2026-10-22

### Added

- Export one supported diagram or UI prototype as a standalone SVG, PNG, or JPEG file. Image export fails when Markdown contains zero or multiple supported diagram blocks.

## [0.15.0] — 2026-10-22

### Added

- Support for fenced `balsamiq` blocks containing Balsamiq Mockups 3 JSON. Supported controls are converted to inline SVG locally; coordinates, layer order, and text are preserved.
- Diagnostics for unsupported controls and limits on input size, nesting depth, control count, canvas dimensions, and SVG output size.

## [0.14.0] — 2026-10-22

### Added

- Support for fenced `pencil` and `pen` blocks containing Pencil JSONC 2.21 documents. The renderer converts supported shapes, text, fills, strokes, and layouts to SVG locally.
- Diagnostics for unsupported Pencil properties and limits on document size and complexity.

## [0.12.0] — 2026-10-21

### Added

- Support for fenced `drawio` and `draw.io` blocks containing draw.io JSON exports. Nodes and edges are laid out locally and converted to inline SVG.
- Page selection and layout direction through block metadata.

## [0.9.5] — 2026-10-21

### Added

- Support for fenced `figma` blocks containing a Figma REST API JSON response or an HTTPS link to a frame. JSON can be rendered locally without a token or network access; URL mode requires a Figma token.
- Local conversion of supported Figma nodes to SVG and SVG validation before embedding in the output.

## [0.8.0] — 2026-10-21

### Added

- Syntax highlighting for fenced code blocks with a recognized Shiki language label. Colors are embedded in the HTML, so highlighting works without JavaScript or network access; the preview supports light and dark themes.
- Blocks larger than 64 KiB remain escaped plain code without highlighting.

## [0.7.0] — 2026-10-21

No functional changes. This version only updates `package.json` in the project history.

## [0.6.0] — 2026-10-21

### Added

- The `blueprint4llm <input.md> --check` command to validate Markdown, diagrams, and local images without creating HTML or PDF files. Errors exit with code `1`; warnings are reported separately.

## [0.5.0] — 2026-10-21

### Improved

- Added a PlantUML diagram example and checks for compilation and PDF export. Documentation now describes local rendering and PlantUML limitations.

## [0.4.0] — 2026-10-21

### Added

- Support for fenced `plantuml` blocks in the Markdown compiler. Diagrams are rendered locally by `@plantuml/core` in Chromium; Java installation and sending source to a server are not required.
- PlantUML error diagnostics, source and SVG size limits, a timeout, and a concurrent rendering limit. External network access and `!include` directives are disabled.

## [0.3.0] — 2026-10-21

### Added

- The local PlantUML renderer and its unit tests.

## [0.2.0] — 2026-10-21

### Added

- A Visual Studio Code extension with a Markdown preview beside the editor. It compiles unsaved text, updates the preview after edits, and displays errors without closing the panel.
- A configurable refresh delay, local image display, a secure Webview, and support for light, dark, and high-contrast VS Code themes.
- PDF export of the current preview with local images.

## [0.1.1] — 2026-10-20

### Fixed

- Corrected SVG diagram alignment in HTML and PDF output.

## [0.1.0] — 2026-10-20

### Added

- A basic CLI and programmatic API for converting Markdown to standalone HTML and PDF, plus a local preview server with automatic refresh.
- Support for Mermaid, GitHub Flavored Markdown, and local images; fonts are embedded for PDF output.
- SVG validation and sanitization, safe link handling, source-file diagnostics, and tests for core components.
