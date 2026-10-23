---
name: blueprint4llm
description: Create or revise visual software plans in Markdown with supported blueprint4llm formats, validate them, and visually inspect every diagram and UI prototype. Offer HTML or PDF export when the plan is complete. Use when a user requests a development plan, architecture diagram, UI prototype, or rendered blueprint.
license: MIT
---

# Create and review a blueprint

Use this skill to create or revise a technical plan that people can review as a visual document. `blueprint4llm` validates and renders Markdown; it does not generate plans or call an LLM. Keep Markdown as the source of truth. HTML and PDF exports are optional and require the user's choice.

Rendering requires the blueprint4llm CLI, Node.js >=22.13.0, npm, and Puppeteer's Chrome. Visual review requires an image viewing tool or a browser tool that can show screenshots.

## Choose the plan content

- When a plan creates or changes a GUI, include UI prototypes of the affected screens and important states. Put them before implementation diagrams. This applies to desktop, web, and mobile apps, regardless of programming language or UI framework.
- Show layout, visible content, controls, and feedback in the prototypes. Flowcharts, state diagrams, component maps, and lists of controls do not replace screen prototypes.
- Keep narrower requests within scope. A backend, CLI, library, algorithm, or architecture-only task does not need unrelated UI prototypes. Follow explicit requests to omit UI.

For example, a GUI calculator plan in Rust needs a prototype of the calculator window and relevant result or error states. Module and calculation diagrams can support these prototypes.

## Workflow

1. Read the relevant `AGENTS.md`, `CLAUDE.md`, `README.md`, and existing plan files. Use current source code and tests when the plan describes an existing project.
2. Use the path requested by the user. If the user gives no path, follow the repository's plan convention or use `plan.md`.
3. Preserve existing decisions and structure when you edit a plan. Mark assumptions and open questions. Do not invent product behavior or implementation status.
4. Make the plan visual first. Prefer diagrams for architecture and flows, separate UI prototypes for screens, and Markdown tables for comparisons, requirements, or concise inventories. Use short prose only for assumptions, rationale, open questions, and details that visuals cannot show. Avoid long text blocks. Choose the simplest supported format that fits, and preserve formats the user already uses.
5. Put each UI screen or separately illustrated state in its own fenced block. For GUI plans, check that the prototypes show the main user task and relevant feedback before rendering. Use only syntax supported by the selected renderer.
6. Check that the CLI is available with `blueprint4llm --version`. If the command is missing, install it globally with `npm install --global blueprint4llm`, then check `blueprint4llm --version` again. If installation fails, tell the user that validation and rendering need the CLI and report the installation error.
7. Validate the Markdown after edits:

   ```bash
   blueprint4llm ./plan.md --check
   ```

   Replace `./plan.md` with the actual path. Fix renderer errors, then run the check again.

8. Visually inspect every diagram and UI prototype as described in [Visual review](#visual-review). Do this for every new or edited visual plan, including Markdown-only output. A successful `--check` does not prove that content fits or is readable. Fix failed blocks and inspect them again before continuing.

9. Do not export the complete plan to HTML or PDF by default. If the user requested an export, use their output path when provided; otherwise use the Markdown path with the selected extension. Do not overwrite an existing file; choose a new filename and report it.

10. Export only the format the user requests:

    ```bash
    blueprint4llm ./plan.md --out=./plan.html
    blueprint4llm ./plan.md --out=./plan.pdf --format=pdf
    ```

11. After creating or changing a visual plan, start a live preview in a separate, persistent terminal session:

    ```bash
    blueprint4llm ./plan.md --serve --port=8811
    ```

    Wait for the preview URL. Keep the server running while you inspect the page. If port `8811` is in use by an earlier `blueprint4llm` preview, stop that preview before starting this one. If another service owns the port, use a free port and report it.

12. Open the local preview in an available browser, for example:

    ```bash
    chromium http://127.0.0.1:8811/
    ```

    Use another installed browser or a browser tool if Chromium is unavailable and it can access the local server. Confirm that the browser displays the correct plan; a running server or URL alone is not enough. Inspect every visual in the final page, including its bottom edge. If this reveals a defect, fix the Markdown, repeat visual review, and regenerate the outputs. If no browser can access the local server, say so and provide the preview URL without claiming that you viewed it.

13. Leave the server running while the user reviews the preview. Stop it when the user is done.

## Visual review

1. List every supported visual block by heading or source line. Track which ones you have inspected. Review all blocks, not a sample.
2. Export each block to PNG in a temporary directory. Each export input must contain exactly one supported visual block. Copy the complete fence, including its language and metadata, without changing the block. Headings and text are allowed. Keep relative asset paths valid.

   ```bash
   blueprint4llm /tmp/blueprint-review/block-01.md --out=/tmp/blueprint-review/block-01.png --format=png
   ```

3. Open each PNG with an available image viewing tool. A browser screenshot of the complete rendered block is also acceptable. Inspect the full height and width at a readable scale. For large visuals, inspect overlapping sections. A screenshot of only the visible browser viewport is insufficient if the block extends below it.
4. Compare the image with the source. Confirm that all intended content is visible, especially the last row, bottom controls, footer, and frame border. Check for clipping, overlap, unreadable labels, missing content, and cut-off arrows. An SVG can contain text that is outside its visible frame, so source or text checks alone are insufficient.
5. Fix defects in the source Markdown. Re-render and inspect each corrected block. Continue until every block passes. Do not edit generated SVG or HTML to hide a source layout problem.

If no image viewing or screenshot tool is available, complete the checks you can and report that visual review is incomplete. Do not mark unviewed blocks as passed.

## Supported visual formats

Use these criteria when the user leaves format choice open or asks for a recommendation. A file's format alone does not determine the format for unrelated new content. Preserve it when the task is to edit or extend that artifact.

### Diagrams

| Format       | Fence                 | Best fit and trade-off                                                                                                                                                                                                           |
| ------------ | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mermaid      | `mermaid`             | Use for concise process flows, simple sequences, and architecture maps. It is easy to scan and edit as text. It works best when relationships matter more than exact placement.                                                  |
| draw.io JSON | `drawio` or `draw.io` | Use for graphs where explicit nodes, groups, and connections matter. The renderer creates an automatic layout with basic shapes; it does not preserve source positions or styles. It accepts structural JSON, not `.drawio` XML. |
| PlantUML     | `plantuml`            | Use when UML structure or semantics matter, such as class, component, state, deployment, detailed sequence, or activity diagrams. This renderer runs locally but disables network access and external includes.                  |
| OpenAPI      | `openapi`             | Use for an embedded OpenAPI 3.1.1 contract. The local renderer shows operations and schemas in a static SVG; it supports local JSON Pointer references and warns about fields outside its displayed subset.                      |

Choose by the information and visual control the diagram needs. A short flowchart is usually Mermaid. Use draw.io JSON when groups and explicit graph structure matter more than exact placement and styling. A flow with UML activity semantics or a UML model is usually PlantUML. Do not choose a format only because it is first in the table or because its syntax is shorter. If the request needs exact draw.io positions or styles, explain that this renderer does not preserve them.

draw.io JSON is a project-specific subset. Read the [draw.io renderer documentation](https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/README.md#drawio-diagrams) before authoring it.

OpenAPI supports only version 3.1.1 and local `#/...` references. It does not fetch external
resources or validate the full OpenAPI specification. See the [OpenAPI contract example](https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/examples/blueprint-openapi.md)
and the renderer limits in the README before using less common OpenAPI fields.

### UI prototypes

| Format             | Fence                                 | Best fit and trade-off                                                                                                                                                                                                   |
| ------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Figma              | `figma`                               | Use to show a more detailed design from Figma frame data. JSON rendering supports a subset of Figma objects; URL mode needs a configured access token.                                                                   |
| Balsamiq Mockups 3 | `balsamiq`                            | Use for rough screen layouts built from common UI controls. It preserves positions and text, but supports a limited control set and does not reproduce the Balsamiq skin exactly. `.bmpr` and `.bmml` are not supported. |
| Pencil             | `pencil` or `pen`                     | Use when custom frame geometry and vector shapes need more control than a text-first prototype. The renderer supports embedded schema 2.21 and common shapes, but not images, gradients, effects, or components.         |
| Wiremark           | `wireframe` (canonical) or `wiremark` | Use for low-fidelity screens and screen states that are easy to describe as text. It is fast to review, but does not give pixel-level visual control.                                                                    |

Choose by fidelity and the kind of information the screen must show: Figma for detailed design data, Balsamiq for rough control layouts, Pencil for custom vector geometry, and Wiremark for structure and content. If the requested fidelity exceeds the renderer's supported subset, explain the limitation.

**Wiremark rule:** If you choose `wireframe` or `wiremark`, read the full [Wiremark guide](https://docs.wiremark.dev/wiremark-llm.md) before writing or editing a block. Follow its syntax and component rules. Do not draft a Wiremark block before reading the guide.

Fetch linked documentation directly from the internet; a local blueprint4llm checkout is not required. Do not read external documentation by default for common formats such as Mermaid or PlantUML; consult it only when syntax or renderer support is unclear. Do not invent Figma credentials or convert source files unless asked.

## Prose style

When prose is needed, follow ASD-STE100 (STE) principles: use short, clear sentences; keep one topic in each sentence; prefer active voice and simple, consistent terms. Preserve technical meaning and the requested document language. Do not claim formal STE compliance unless you apply its full rules and vocabulary.

## Output

- Keep the Markdown file as the source of truth.
- Report the path of the Markdown file and any files the user requested you to generate.
- State how many visual blocks you inspected and whether any visual defects remain. Report inspection limits explicitly.
- Mention validation warnings. Do not claim the plan is implemented or verified in code unless you checked the project.
- If the user did not request an export, end by offering to create an HTML or PDF version. Do not create one until the user chooses a format.
