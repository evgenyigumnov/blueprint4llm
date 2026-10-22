# Reference

[Back to the overview](../README.md)

| Topic        | Jump to                                                                 |
| ------------ | ----------------------------------------------------------------------- |
| Setup        | [Installation and building from source](#requirements-and-installation) |
| CLI          | [Preview, validation, and export](#usage)                               |
| Formats      | [Supported blocks and renderer details](#markdown-format)               |
| Rendering    | [HTML, images, and PDF](#html-images-and-pdf)                           |
| Constraints  | [Limits and diagnostics](#limits)                                       |
| Library      | [Programmatic API](#programmatic-api)                                   |
| Contributing | [Development and checks](#development-and-checks)                       |

## Requirements and installation

- Node.js `>=22.13.0`.
- npm.
- Chrome managed by Puppeteer.

Install the CLI globally:

```bash
npm install --global blueprint4llm
blueprint4llm --help
```

Puppeteer downloads a compatible Chrome during installation. If your package manager blocks install scripts, install Chrome manually:

```bash
npm exec --yes --package=puppeteer@25.14.0 -- puppeteer browsers install chrome
```

Build from a repository clone:

```bash
npm ci
npx puppeteer browsers install chrome
npm run build
```

To make the `blueprint4llm` command available globally, run this from the project directory:

```bash
npm link
blueprint4llm --help
```

You can also run the CLI with `node dist/cli.js`.

## Usage

From a repository clone, preview the [overview example](../examples/blueprint-overview.md):

```bash
blueprint4llm examples/blueprint-overview.md --serve
```

Open the URL printed in the terminal. The preview updates when you save the Markdown.

Build HTML (the default format):

```bash
blueprint4llm examples/blueprint.md --out=./dist-preview/blueprint.html
```

Export to PDF:

```bash
blueprint4llm examples/blueprint.md --out=./dist-pdf/blueprint.pdf --format=pdf
```

Export one diagram or UI prototype as an image:

```bash
blueprint4llm examples/blueprint-pencil.md --out=./diagram.svg --format=svg
blueprint4llm examples/blueprint-pencil.md --out=./diagram.png --format=png
blueprint4llm examples/blueprint-pencil.md --out=./diagram.jpeg --format=jpeg
```

SVG, PNG, and JPEG exports require exactly one supported diagram code block in the Markdown. Text and headings are allowed. The command reports an error when it finds zero or multiple diagrams. PNG and JPEG use local Chromium to rasterize the rendered SVG.

`--out` specifies the output file path. Parent directories are created automatically. The CLI produces one format per run. HTML embeds diagram SVGs, and local Markdown images are saved in `assets/` next to the HTML. You can open the generated HTML directly with `file://`.

Validate a document before review or publication, for example in CI:

```bash
blueprint4llm examples/blueprint.md --check
```

`--check` parses Markdown, runs the diagram renderers, and checks local images without creating HTML or PDF. Warnings go to stderr. Validation errors exit with code `1`.

Start a local preview with automatic updates:

```bash
blueprint4llm examples/blueprint.md --serve
blueprint4llm examples/blueprint.md --serve --port=8081
```

The server listens on `127.0.0.1` only. It watches the Markdown and referenced local images. Press `Ctrl+C` to stop it. The preview fills the browser window width. A **Dark mode** switch sits next to **Download PDF**, and the browser remembers the selected theme. The PDF is generated on the first request and cached until the document changes. The browser does not open automatically.

### Visual Studio Code preview

The extension package is in `vscode-extension/`. Install a built VSIX with `code --install-extension <path-to-file.vsix>`, open a `.md` file, and run **Blueprint: Open Preview to the Side** from the Command Palette or editor title bar. The preview compiles the current editor buffer, updates 200 ms after edits, and shows compilation errors without closing the panel. Change the delay with `blueprint4llm.preview.debounceMs`.

See the [extension instructions](../vscode-extension/README.md) for VSIX build steps and Chrome requirements.

## Markdown format

CommonMark and GitHub Flavored Markdown are supported: headings, lists, tables, task lists, links, images, quotes, and code blocks. Use fenced code blocks for diagrams:

| Block language          | Renderer                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `mermaid`               | Official Mermaid CLI, run locally.                                                                                    |
| `plantuml`              | Local JavaScript/Wasm engine, [`@plantuml/core`](https://github.com/plantuml/plantuml/blob/master/PUBLISHING_NPM.md). |
| `wireframe`, `wiremark` | Blackburn-Labs Wiremark UI prototypes. `wireframe` is the canonical identifier.                                       |
| `drawio`, `draw.io`     | Structural draw.io JSON export with automatic local layout.                                                           |
| `pencil`, `pen`         | Embedded Pencil `2.21` JSONC document rendered as local SVG.                                                          |
| `balsamiq`              | A single Balsamiq Mockups 3 mockup in JSON, rendered as local SVG.                                                    |
| `figma`                 | Figma REST API JSON rendered locally, or a frame URL exported through the Figma API.                                  |

The Mermaid renderer sets a vertical direction (`TB`/`TD`) for diagram types that support it. Types with a fixed layout, such as `sequenceDiagram`, keep their native layout.

Each PlantUML block contains one diagram with standard `@start...` and `@end...` directives. `@plantuml/core@1.2026.9` runs locally in Chromium, which is also used for PDF and preview. Java is not required. Rendering works offline and does not send the source to a server. External requests, local `!include`, `!includeurl`, and standard libraries are disabled. SVG dimensions are limited to 8192 px per side. Up to two PlantUML renders can run at once.

Code blocks with a recognized Shiki language label receive syntax highlighting during compilation. Color tokens are embedded in the HTML, so standalone HTML works without JavaScript or a network connection. Code colors follow the dark theme in local preview; PDF uses the light palette. Blocks with no language label or an unknown label stay as escaped plain code. Inline code is unchanged. Blocks larger than 64 KiB in UTF-8 also stay as plain code to limit compilation time. Diagram blocks are rendered as SVG.

### Pencil layouts

Paste JSONC from a `.pen` file into a `pencil` or `pen` fenced block. The initial implementation supports embedded schema `2.21` documents without network requests. It renders frames, groups, rectangles, ellipses, polygons, SVG paths, and text. Supported properties include solid fills and strokes, opacity, rotation, rounded corners, frame clipping, and basic layout. Text with `textGrowth: "fixed-width"` wraps using approximate character widths, so line breaks can differ from pen.dev.

Imports, component references, variables, themes, images, gradients, effects, and scripts are not supported. These properties, and unknown visual properties, stop rendering with a diagnostic. Limits: 1 MiB of JSONC, 10,000 nodes, depth 100, 256 sides per polygon, 10,000 text lines, and an output SVG of 4 MiB with up to 16,384 px per side. See [`../examples/blueprint-pencil.md`](../examples/blueprint-pencil.md).

### Balsamiq mockups

Paste the JSON for one Balsamiq Mockups 3 mockup into a `balsamiq` block. The renderer preserves coordinates, layer order, and text, then builds a local inline SVG. See [`../examples/blueprint-balsamiq.md`](../examples/blueprint-balsamiq.md).

Supported controls: `Canvas`, `Label`, `Title`, `SubTitle`, `Paragraph`, `TextInput`, `TextArea`, `Button`, `CheckBox`, `RadioButton`, `ComboBox`, `List`, `Rectangle`, and `Line`. Layout dimensions come from `measuredW`/`measuredH`, with `mockupW`/`mockupH` and the `Canvas` control dimensions as fallbacks. Limits: 256 KiB of JSON, 3,000 controls, depth 100, 4,056 px per side, and 4 MiB of SVG. `.bmpr`, `.bmml`, external assets, symbols, and exact reproduction of the Balsamiq skin are not supported. The canvas limit follows the [Mockups 3 documentation](https://balsamiq.com/assets/product/mockups3fordesktop/balsamiq-mockups-3-for-desktop-documentation.pdf).

### draw.io diagrams

Copy JSON from **File → Export as → JSON** into a `drawio` or `draw.io` fenced block. See [`../examples/blueprint-draw.io.md`](../examples/blueprint-draw.io.md) for nodes, a group, and connections.

For a single page, the renderer selects it automatically. For multiple pages, set `page=<id>`. Set `direction=TB` for top to bottom (the default), or `direction=LR` for left to right. For example: `page=release direction=LR`.

The JSON preserves connections, labels, and groups. The renderer creates a new layout with standard rectangles and directed arrows; it does not preserve the original geometry or styles. The `html` and `data` fields are not displayed. Labels remain plain text. `.drawio` XML is not yet supported. Rendering runs locally without network requests. The inline SVG works in HTML, `--serve`, VS Code preview, and PDF. Markdown edits rebuild the preview automatically.

### Figma frames

A `figma` block accepts a Figma REST API JSON response or an HTTPS frame URL from `/design/` or `/file/`. JSON must contain a `document` of type `DOCUMENT`. Local rendering needs no token or network connection. If the document has multiple top-level frames, select a frame in the block metadata: ` ```figma node=12:34 `.

The local renderer supports `FRAME`, `GROUP`, `COMPONENT`, and `INSTANCE` containers; `RECTANGLE`, `ELLIPSE`, and `LINE` shapes; `TEXT`; and `VECTOR` paths with `geometry=paths`. It renders solid fills and strokes, opacity, rounded corners, and rotation. Gradients, effects, masks, raster data from JSON, and complex text overrides are not supported. For these layouts, use URL mode or export the frame as a regular Markdown image. JSON limits: 1 MiB, 10,000 nodes, and depth 100.

URL mode requires a Figma personal access token with `file_content:read` permission. The compiler checks `CompileOptions.figmaAccessToken`, then `FIGMA_ACCESS_TOKEN`, then `.env` in the current working directory. For example:

```ts
const compiled = await compileMarkdown(markdown, {
  sourceFile: '/project/blueprint.md',
  figmaAccessToken: process.env.FIGMA_ACCESS_TOKEN,
});
```

The token is sent only to `api.figma.com`. API requests and temporary SVG downloads occur only for URL blocks. The compiler validates the SVG and embeds it in the HTML. The resulting HTML and PDF work offline. Other URL query parameters, including `t`, are not sent to the API. Diagnostics include the source file and block line, but omit the token, source JSON, and temporary URL. See [`../examples/blueprint-figma.md`](../examples/blueprint-figma.md) for JSON and URL examples.

### HTML, images, and PDF

Raw HTML in Markdown is escaped. All diagram SVGs are checked for active elements, event handlers, and external resources. Unsafe link URLs are removed.

Local image paths are resolved relative to the Markdown directory. Images are copied into `assets/` next to the output HTML. Paths that escape the project directory through `..` or a symlink are rejected. External HTTP(S) images remain external in HTML. PDF does not allow them: save the image locally and use a relative path. PDF uses A4 pages and local Noto Sans fonts. Text and links remain accessible in the PDF.

## Limits

- Markdown source: up to 5 MiB, 100 diagrams, and 256 KiB of source per diagram, unless a renderer defines its own limit.
- draw.io: 1 MiB per JSON block, 10,000 cells per page, and 100 pages per document. SVG output is limited to 4 MiB and 16,384 px per side. Layout times out after 5 seconds.
- Mermaid and PlantUML rendering time out after 30 seconds. PDF generation times out after 60 seconds.
- PDF uses Puppeteer's installed Chrome/Chromium and requires the appropriate system libraries on Linux. Install the browser with `npx puppeteer browsers install chrome`.
- The Chromium sandbox is enabled by default. If the OS blocks sandbox startup, Mermaid, PDF, PNG, and JPEG rendering automatically retry with `--no-sandbox`. Set `BLUEPRINT4LLM_DISABLE_CHROME_SANDBOX=1` to force a launch without the sandbox.
- Raw HTML, user JavaScript execution, and graphical editing are not supported.
- Standalone diagram image formats are SVG, PNG, and JPEG. They require exactly one supported diagram block.

Mermaid, PlantUML, and Wiremark errors include the source file and block line. If PlantUML returns an SVG with a syntax error, it stays visible in the preview, and the diagnostic points to the line within the diagram. A failed build in `--serve` mode shows diagnostics while the server keeps running. Fix the file to update the preview.

## Programmatic API

The package exports the Markdown compiler, PDF renderer, output writers, and preview server:

```ts
import { compileMarkdown, renderPdf, writeBlueprintOutput } from 'blueprint4llm';

const compiled = await compileMarkdown(markdown, {
  sourceFile: '/project/blueprint.md',
});
const pdf = await renderPdf(compiled);

await writeBlueprintOutput('/project/output.html', {
  html: compiled.html,
  assets: compiled.assets,
  pdf,
});
```

`compileMarkdown()` returns a `CompiledBlueprint` with `html`, `title`, `assets`, and warnings. `renderPdf()` accepts this result and an optional `{ signal: AbortSignal }`. `writeBlueprintOutput(outputFile, options)` writes to the given path. If both formats are supplied, it also creates a neighboring file for the second format. It returns absolute output paths.

`startPreviewServer({ input, port, signal })` starts the preview and returns a handle with `url`, the selected `port`, and an asynchronous `close()` method. Public types `CompiledBlueprint`, `CompileOptions`, `RenderPdfOptions`, `PreviewServerOptions`, and `PreviewServerHandle` are available from the package root.

## Development and checks

```bash
npm run build
npm run typecheck
npm run lint
npm run format:check
npm test
```

`npm test` builds `dist/cli.js`, then runs unit and integration tests. Chrome must be installed for PDF/CLI smoke tests. In the Linux test container, an environment variable explicitly disables the sandbox for test processes only.
