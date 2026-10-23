# Changelog

## [0.22.4] — 2026-10-23

### Changed

- Remove the legacy text-based UI renderer and its dependency. Use Balsamiq for UI prototypes in examples, exported documents, documentation, and README artwork.

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
