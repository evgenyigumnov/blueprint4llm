---
name: blueprint4llm
description: Create or revise visual software plans in Markdown with any supported blueprint4llm diagram or UI prototype format, then validate and render them. Use when a user requests a development plan, architecture diagram, UI prototype, or rendered blueprint.
license: MIT
compatibility: Requires the blueprint4llm CLI, Node.js >=22.13.0, npm, and Puppeteer's Chrome for rendering.
---

# Create and render a blueprint

Use this skill to create or revise a technical plan that people can review as a visual document. `blueprint4llm` renders Markdown; it does not generate plans or call an LLM.

## Workflow

1. Read the relevant `AGENTS.md`, `CLAUDE.md`, `README.md`, and existing plan files. Use current source code and tests when the plan describes an existing project.
2. Use the path requested by the user. If the user gives no path, follow the repository's plan convention or use `plan.md`.
3. Preserve existing decisions and structure when you edit a plan. Mark assumptions and open questions. Do not invent product behavior or implementation status.
4. Make the plan visual first. Prefer diagrams for architecture and flows, separate UI prototypes for screens, and Markdown tables for comparisons, requirements, or concise inventories. Use short prose only for assumptions, rationale, open questions, and details that visuals cannot show. Avoid long text blocks. Choose the simplest supported format that fits, and preserve formats the user already uses.
5. Put each UI screen in its own fenced block. Use only syntax supported by the selected renderer.
6. Check that the CLI is available with `blueprint4llm --version`. If it is missing, continue editing the Markdown, but tell the user that validation and rendering need the CLI. Give the install command `npm install --global blueprint4llm`. Do not install it globally without the user's request.
7. Validate the Markdown after edits:

   ```bash
   blueprint4llm ./plan.md --check
   ```

   Replace `./plan.md` with the actual path. Fix renderer errors, then run the check again.

8. For a new visual plan, create a companion HTML file after validation unless the user asks for Markdown only. Use a user-provided output path when available; otherwise use the Markdown path with an `.html` extension. Do not overwrite an existing output file; choose a new name or ask the user.

   ```bash
   blueprint4llm ./plan.md --out=./plan.html
   ```

9. Export PDF only when requested:

   ```bash
   blueprint4llm ./plan.md --out=./plan.pdf --format=pdf
   ```

10. When a user reports a visual issue in one diagram or UI prototype, export that block as an image and inspect the result with an available image viewing tool. SVG, PNG, and JPEG are supported. The export input must contain exactly one supported visual block. If the source has more, copy the reported block into a temporary Markdown file; headings and text are allowed.

    ```bash
    blueprint4llm ./reported-block.md --out=./reported-block.png --format=png
    ```

    Use PNG for visual inspection. Do not claim that you inspected the rendered result if no image viewing tool is available.

11. After creating or changing a visual plan, start a live preview in a separate, persistent terminal session:

    ```bash
    blueprint4llm ./plan.md --serve --port=8811
    ```

    Wait for the preview URL. Keep the server running while you inspect the page. If port `8811` is in use by an earlier `blueprint4llm` preview, stop that preview before starting this one. If another service owns the port, use a free port and report it.

12. Open the local preview in an available browser, for example:

    ```bash
    chromium http://127.0.0.1:8811/
    ```

    Use another installed browser or a browser tool if Chromium is unavailable and it can access the local server. Confirm that the browser displays the correct plan; a running server or URL alone is not enough. If no browser can access the local server, say so and provide the preview URL without claiming that you viewed it.

13. Leave the server running while the user reviews the preview. Stop it when the user is done.

## Supported visual formats

Use these criteria when the user leaves format choice open or asks for a recommendation. A file's format alone does not determine the format for unrelated new content. Preserve it when the task is to edit or extend that artifact.

### Diagrams

| Format | Fence | Best fit and trade-off |
| --- | --- | --- |
| Mermaid | `mermaid` | Use for concise process flows, simple sequences, and architecture maps. It is easy to scan and edit as text. It works best when relationships matter more than exact placement. |
| PlantUML | `plantuml` | Use when UML structure or semantics matter, such as class, component, state, deployment, detailed sequence, or activity diagrams. This renderer runs locally but disables network access and external includes. |
| draw.io JSON | `drawio` or `draw.io` | Use for graphs where explicit nodes, groups, and connections matter. The renderer creates an automatic layout with basic shapes; it does not preserve source positions or styles. It accepts structural JSON, not `.drawio` XML. |

Choose by the information and visual control the diagram needs. A short flowchart is usually Mermaid; a flow with UML activity semantics or a UML model is usually PlantUML. Use draw.io JSON when groups and explicit graph structure matter more than exact placement and styling. Do not choose a format only because it is first in the table or because its syntax is shorter. If the request needs exact draw.io positions or styles, explain that this renderer does not preserve them.

draw.io JSON is a project-specific subset. Read the project's [draw.io documentation](../../README.md#drawio-diagrams) and [example](../../examples/blueprint-draw.io.md) before authoring it.

### UI prototypes

| Format | Fence | Best fit and trade-off |
| --- | --- | --- |
| Wiremark | `wireframe` (canonical) or `wiremark` | Use for low-fidelity screens and screen states that are easy to describe as text. It is fast to review, but does not give pixel-level visual control. |
| Balsamiq Mockups 3 | `balsamiq` | Use for rough screen layouts built from common UI controls. It preserves positions and text, but supports a limited control set and does not reproduce the Balsamiq skin exactly. `.bmpr` and `.bmml` are not supported. |
| Pencil | `pencil` or `pen` | Use when custom frame geometry and vector shapes need more control than a text-first prototype. The renderer supports embedded schema 2.21 and common shapes, but not images, gradients, effects, or components. |
| Figma | `figma` | Use to show a more detailed design from Figma frame data. JSON rendering supports a subset of Figma objects; URL mode needs a configured access token. |

Choose by fidelity and the kind of information the screen must show: Wiremark for structure and content, Balsamiq for rough control layouts, Pencil for custom vector geometry, and Figma for detailed design data. If the requested fidelity exceeds the renderer's supported subset, explain the limitation.

**Wiremark rule:** If you choose `wireframe` or `wiremark`, read the full [Wiremark guide](https://docs.wiremark.dev/wiremark-llm.md) before writing or editing a block. Follow its syntax and component rules. Do not draft a Wiremark block before reading the guide.

Use project examples for project-specific format subsets. Do not read external documentation by default for common formats such as Mermaid or PlantUML; consult it only when syntax or renderer support is unclear. Do not invent Figma credentials or convert source files unless asked.

## Prose style

When prose is needed, follow ASD-STE100 (STE) principles: use short, clear sentences; keep one topic in each sentence; prefer active voice and simple, consistent terms. Preserve technical meaning and the requested document language. Do not claim formal STE compliance unless you apply its full rules and vocabulary.

## Output

- Keep the Markdown file as the source of truth.
- Report the paths of the Markdown and generated files.
- Mention validation warnings. Do not claim the plan is implemented or verified in code unless you checked the project.
