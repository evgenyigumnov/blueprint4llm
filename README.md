# blueprint4llm

**Languages:** [English](README.md) | [Русский](README.ru.md) | [Español](README.es.md) | [中文](README.zh.md) | [हिन्दी](README.hi.md) | [Français](README.fr.md) | [العربية](README.ar.md)

**Markdown plans → diagrams, UI prototypes, charts, HTML, and PDF.**

Write a plan yourself or with an agent. Review the system and screens before implementation.
Markdown stays the source of truth; the CLI renders it without calling an LLM.

![Markdown source beside its rendered Mermaid diagram, Balsamiq screen, and request status chart](https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/markdown-to-visual.png)

## Representative example

Explore a representative [`plan.md`](examples/representative-plan.md) and compare its rendered [HTML](examples/representative-plan.html) and [PDF](examples/representative-plan.pdf) outputs.

## Quick start

### Use with Codex or Claude Code

From your project directory, install the `blueprint4llm` skill with the [skills CLI](https://github.com/vercel-labs/skills):

```bash
# Codex
npx skills add evgenyigumnov/blueprint4llm --skill blueprint4llm --agent codex

# Claude Code
npx skills add evgenyigumnov/blueprint4llm --skill blueprint4llm --agent claude-code
```

The installer requires **Node.js ≥22.20.0** and npm. It installs the skill for the current project by default; add `--global` to use it across projects. Codex stores project skills in `.agents/skills/`; Claude Code uses `.claude/skills/`.

Invoke the skill in your agent:

```text
# Codex
$blueprint4llm Create a visual plan for a task queue.

# Claude Code
/blueprint4llm Create a visual plan for a task queue.
```

The skill guides the agent through writing a visual plan, validating and rendering it, and reviewing each visual. Rendering requires the `blueprint4llm` CLI and Puppeteer's Chrome; the next section shows how to install and run the CLI.

### Use the CLI directly

Requires **Node.js ≥22.13.0**, npm, and Puppeteer's Chrome.

```bash
npm install --global blueprint4llm
```

Save this as `plan.md`:

````markdown
# Request workflow

```d2
form: Request form
api: API validation
queue: Processing queue

form -> api
api -> queue
```
````

```bash
blueprint4llm plan.md --serve
```

Open the printed URL, normally `http://127.0.0.1:8080/`. Saving the Markdown or a referenced
local image refreshes the preview. The toolbar offers dark mode and PDF download. Stop with `Ctrl+C`.

Chrome is normally installed automatically. If install scripts were blocked, install it manually:

```bash
npm exec --yes --package=puppeteer@25.14.0 -- puppeteer browsers install chrome
```

## How it works

![A Markdown plan is validated and rendered into live previews, HTML or PDF documents, or a single SVG, PNG, or JPEG visual](https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/workflow.svg)

## Formats

Use fenced blocks alongside CommonMark and GitHub Flavored Markdown: text, tables, lists,
links, images, and code. Ordinary code blocks receive syntax highlighting.

| Format     | Fence                   | Input and support                                                                                                                                     |
| ---------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| D2         | `d2`                    | Self-contained D2 source rendered offline with bundled WebAssembly. Supports containers, connections, styles, SQL tables, UML classes, and sequences. |
| Mermaid    | `mermaid`               | Flows, sequences, classes, states, and ER diagrams. Uses a vertical layout where supported.                                                           |
| Graphviz   | `graphviz`, `dot`       | One offline DOT graph rendered to SVG in a worker. Supports verified `dot`, `neato`, `circo`, `fdp`, `osage`, `patchwork`, and `twopi` engines.       |
| PlantUML   | `plantuml`              | Standard `@start…` / `@end…` diagrams. Local engine; no Java, external includes, or network requests.                                                 |
| draw.io    | `drawio`, `draw.io`     | Structural JSON with nodes, groups, labels, and edges. Automatic layout; no XML.                                                                      |
| Pencil     | `pencil`, `pen`         | Embedded `.pen` JSONC, schema 2.21. Frames, groups, shapes, paths, and text; no images, components, gradients, or effects.                            |
| Balsamiq   | `balsamiq`              | One Mockups 3 JSON mockup with common controls. Preserves positions and text; no `.bmpr`, `.bmml`, assets, or symbols.                                |
| Figma      | `figma`                 | REST API JSON rendered locally, or a frame URL exported through the Figma API. URL mode needs a token.                                                |
| OpenAPI    | `openapi`               | OpenAPI 3.1.1 YAML or JSON rendered as a static API reference, including operations and component schemas.                                            |
| Excalidraw | `excalidraw`            | Strict `.excalidraw` JSON v2. Keeps positions, rotations, groups, shapes, text, and ordinary arrows; unsupported items get placeholders.              |
| Vega-Lite  | `vega-lite`, `vegalite` | Vega-Lite 6 specifications with embedded data; rendered locally as static SVG.                                                                        |
| ECharts    | `echarts`               | Strict JSON using the supported static chart profile; rendered locally as SVG.                                                                        |

Each supported format has a visual example below. All labels in the images are in English.

| Format                                       |                                                                                                                     Preview                                                                                                                     | Format                                         |                                                                                                               Preview                                                                                                               |
| -------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | ---------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| [D2](examples/blueprint-d2.md)               |          <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/d2.svg" alt="D2 checkout sequence across buyer app, API gateway, order, inventory, payment, event, and email services" width="440">           | [Mermaid](examples/blueprint-mermaid.md)       |    <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/mermaid.svg" alt="Import job state machine with validation, nested execution, retry backoff, and dead-letter handling" width="440">     |
| [Graphviz](examples/blueprint-graphviz.md)   |             <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/graphviz.svg" alt="Clustered event lineage with schema quality gate, quarantine, replay, storage, and consumers" width="440">              | [PlantUML](examples/blueprint-plantuml.md)     |   <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/plantuml.svg" alt="Incident response activity with SLO detection, decision paths, parallel recovery work, and follow-up" width="440">    |
| [draw.io](examples/blueprint-draw.io.md)     |            <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/drawio.svg" alt="Grouped parcel lifecycle map with commerce, payments, fulfillment, tracking, and customer support" width="440">            | [Pencil](examples/blueprint-pencil.md)         |    <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/pencil.svg" alt="Reliability dashboard with navigation, service metrics, a two-series latency chart, and health table" width="440">     |
| [Balsamiq](examples/blueprint-balsamiq.md)   | <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/balsamiq.svg" alt="Support triage dashboard with searchable priority queue, SLA context, selected ticket, assignment, and reply controls" width="440"> | [Figma](examples/blueprint-figma.md)           | <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/figma.svg" alt="Mobile Kyoto itinerary with destination card, stay details, guest count, price breakdown, and booking action" width="440"> |
| [OpenAPI](examples/blueprint-openapi.md)     |        <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/openapi.svg" alt="Parcel operations API reference with shipment, tracking, and pagination operations and reusable schemas" width="440">         | [Excalidraw](examples/blueprint-excalidraw.md) |    <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/excalidraw.svg" alt="Three-stage launch roadmap with discovery, private beta, rollout milestones, and an evidence gate" width="440">    |
| [Vega-Lite](examples/blueprint-vega-lite.md) |        <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/vega-lite.svg" alt="Layered monthly p95 latency trends for two regions with observed ranges and a 200 millisecond SLO line" width="440">        | [ECharts](examples/blueprint-echarts.md)       |                   <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/echarts.svg" alt="Seven-day heatmap comparing p95 API latency across six traffic windows" width="440">                   |

### Figma frames

JSON mode needs a root `DOCUMENT` and works offline without a token. Select a frame with
`node=12:34` in the fence metadata. The local renderer supports containers, basic shapes,
vector paths, text, and solid fills; use URL mode for gradients, effects, masks, and images.

URL mode accepts HTTPS `/design/` or `/file/` frame URLs. Use a personal access token with
`file_content:read` permission. Token lookup order: `CompileOptions.figmaAccessToken`,
`FIGMA_ACCESS_TOKEN`, then `.env` in the current working directory. The token is sent only
to `api.figma.com`; exported SVGs are embedded in the result.

## Commands

| Task                 | Command                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| Live preview         | `blueprint4llm plan.md --serve --port=8080`                            |
| Validate for CI      | `blueprint4llm plan.md --check`                                        |
| Validate with report | `blueprint4llm plan.md --check --report-json=diagnostics.json`         |
| Export with report   | `blueprint4llm plan.md --out=plan.html --report-json=diagnostics.json` |
| Export HTML          | `blueprint4llm plan.md --out=plan.html`                                |
| Export with counts   | `blueprint4llm plan.md --out=plan.html --diagnostics-summary`          |
| Export PDF           | `blueprint4llm plan.md --out=plan.pdf --format=pdf`                    |
| Export SVG           | `blueprint4llm plan.md --out=visual.svg --format=svg`                  |
| Export PNG           | `blueprint4llm plan.md --out=visual.png --format=png`                  |
| Export JPEG          | `blueprint4llm plan.md --out=visual.jpeg --format=jpeg`                |

Image exports require **exactly one supported visual block**; the quick start example qualifies.
`--out` creates parent directories. Each invocation produces one format; HTML is the default.
`--check` validates Markdown, diagrams, and local images without writing HTML or assets. The optional
`--report-json=<file>` writes a UTF-8 JSON report atomically. It works with `--check` and one-shot
exports. The report path must differ from the input and output paths, including symlink aliases.
`--report-json` cannot be used with `--serve`.

Generated documents omit the overall error and warning count by default. Add
`--diagnostics-summary` to HTML or PDF exports and live previews to include it. A failed diagram
still shows its full message at its position; the other Markdown and valid diagrams remain available.
HTML and PDF exports are saved even when a diagram has an error, then the command exits with code
`1`. SVG, PNG, and JPEG exports do not replace an existing file when their diagram has an error.
Warnings alone exit with code `0`. Invalid arguments, including report path conflicts, exit with
code `2`.

The report has `schemaVersion: 1`, a `status` of `ok` or `error`, summary counts, and ordered
diagnostics. Each diagnostic includes `severity`, a stable `code`, `scope`, source path, optional
Markdown coordinates and diagram identity, and the full message. Codes are `diagram.render`,
`diagram.limit`, `diagram.svg`, `renderer.warning`, `document.read`, `document.compile`,
`output.render`, and `output.write`. The optional `outputs` object lists files that the invocation
actually saved. For example, `--check` reports have no `outputs` field.

Fatal document or export failures stop that operation. If a JSON report was requested, it includes a
document or output diagnostic when the report can still be written. An unwritable report is reported
on stderr and exits with code `1`; any HTML or PDF already saved remains available. See
[`examples/blueprint-diagnostics.md`](examples/blueprint-diagnostics.md) for a document with two
independent diagram errors and a valid diagram between them.

In live preview, failed diagrams stay inline and the PDF uses that same compiled document. The
overall count is opt-in through `--diagnostics-summary`. Fixing the source removes the diagnostics on
the next build. A fatal document error still shows a diagnostic page until the source is fixed.

## Output and limits

| Topic            | Behavior                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTML             | Embeds diagram SVGs; local images are copied to an adjacent `assets/` folder. Open the output directly in a browser.                                                |
| PDF              | A4 pages with local Noto Sans fonts and selectable text. Wide D2 diagrams use landscape pages. External images must be saved locally before export.                 |
| Image paths      | Resolve relative to the Markdown file. Paths and symlinks that escape its directory are rejected.                                                                   |
| Offline use      | Local renderers need no network; Figma URL blocks fetch during compilation. HTML still needs a connection for external images.                                      |
| Safety           | Raw HTML is escaped. SVGs are checked for active content and external resources. User scripts and graphical editing are not supported.                              |
| Document limits  | 5 MiB of Markdown, 100 visual blocks, and normally 256 KiB per block.                                                                                               |
| JSON limits      | draw.io, Pencil, and Figma: 1 MiB and 10,000 cells/nodes. Balsamiq: 256 KiB and 3,000 controls.                                                                     |
| Vega-Lite limits | 256 KiB source, 64 levels, 50,000 AST nodes, 10,000 source rows, 100 expanded views and transforms, 50,000 computed rows/items, and 4 MiB SVG.                      |
| OpenAPI limits   | 256 KiB source, 200 operations, 500 named schemas, 2,000 references, 5,000 layout lines, and 4 MiB SVG.                                                             |
| Timeouts         | Mermaid, PlantUML, and Vega-Lite: 30 seconds. draw.io layout: 5 seconds. PDF: 60 seconds.                                                                           |
| Chrome on Linux  | Requires Chrome system libraries. If sandbox startup fails, rendering retries with `--no-sandbox`. Set `BLUEPRINT4LLM_DISABLE_CHROME_SANDBOX=1` to force this mode. |

## Agent and editor workflows

| Workflow     | Setup                                                                                                                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Coding agent | Use the `blueprint4llm` skill; see [Quick start](#quick-start) for Codex and Claude Code installation and invocation.                                                                        |
| VS Code      | Install a built VSIX with `code --install-extension <file.vsix>`. Open a Markdown file and run **Blueprint: Open Preview to the Side**. Use **Blueprint: Export Preview as PDF** to save it. |

The VS Code preview compiles unsaved edits with a 200 ms delay, configurable through
`blueprint4llm.preview.debounceMs`. It requires desktop VS Code ≥1.101.0 and Puppeteer's Chrome.

## Programmatic API

Install locally with `npm install blueprint4llm`, then use the ESM exports:

```js
import { compileMarkdown, writeBlueprintOutput } from 'blueprint4llm';

const compiled = await compileMarkdown('# Plan\n\nReady for review.', {
  sourceFile: './plan.md',
  includeDiagnosticsSummary: true,
});

await writeBlueprintOutput('./plan.html', {
  html: compiled.html,
  assets: compiled.assets,
});
```

| Export                                        | Purpose                                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `compileMarkdown(markdown, options)`          | Returns `html`, `title`, `assets`, legacy `warnings`/`errors`, and structured `diagnostics`. |
| `renderPdf(compiled, { signal }?)`            | Generates PDF bytes; pass them as `pdf` to `writeBlueprintOutput()`.                         |
| `writeBlueprintOutput(path, options)`         | Writes HTML and/or PDF with assets; returns absolute output paths.                           |
| `startPreviewServer({ input, port, signal })` | Returns `url`, `port`, and an asynchronous `close()` method.                                 |

`warnings` and `errors` remain formatted string arrays for existing consumers. `diagnostics` adds
structured records; it is optional in the public result types so older compiler implementations can
continue to provide only the string arrays. The built-in compiler always returns `diagnostics`.
Set `includeDiagnosticsSummary: true` in `CompileOptions` to add an accessible count to generated
HTML. It is disabled by default. `startPreviewServer()` accepts the same option.

## Development

From a repository clone:

```bash
npm ci
npx puppeteer browsers install chrome
npm run build
npm run typecheck
npm run lint
npm run format:check
npm test
```

Run the CLI directly with `node dist/cli.js`, or use `npm link` to expose the command globally.
`npm test` builds the CLI and runs unit and integration tests; Chrome must be installed.
To build the VSIX, run `npm install` and `npm run package` from `vscode-extension/`.
