---
name: blueprint4llm
description: Create or revise visual software plans in Markdown with any supported blueprint4llm diagram or UI prototype format, then validate and render them. Use when a user requests a development plan, architecture diagram, UI prototype, or rendered blueprint.
license: MIT
compatibility: Requires the blueprint4llm CLI, Node.js >=22.13.0, npm, and Puppeteer's Chrome for rendering.
---

# Create and render a blueprint

Use this skill to create or revise a technical plan that people can review as a visual document. `blueprint4llm` renders Markdown; it does not generate plans or call an LLM.

## Workflow

1. Read the relevant `AGENTS.md`, `README.md`, and existing plan files. Use current source code and tests when the plan describes an existing project.
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

10. After creating or changing a visual plan, start a live preview in a separate, persistent terminal session:

    ```bash
    blueprint4llm ./plan.md --serve --port=8811
    ```

    Wait for the preview URL. Keep the server running while you inspect the page. If port `8811` is in use by an earlier `blueprint4llm` preview, stop that preview before starting this one. If another service owns the port, use a free port and report it.

11. Open the local preview in an available browser, for example:

    ```bash
    chromium http://127.0.0.1:8811/
    ```

    Use another installed browser or a browser tool if Chromium is unavailable and it can access the local server. Confirm that the browser displays the correct plan; a running server or URL alone is not enough. If no browser can access the local server, say so and provide the preview URL without claiming that you viewed it.

12. Leave the server running while the user reviews the preview. Stop it when the user is done.

## Supported visual formats

### Diagrams

| Format | Fence | Choose it when |
| --- | --- | --- |
| Mermaid | `mermaid` | A concise architecture, flow, sequence, or process diagram is enough. |
| PlantUML | `plantuml` | The user wants UML notation or the project already uses PlantUML. |
| draw.io JSON | `drawio` or `draw.io` | The user provides a draw.io JSON export or needs structured nodes and connections. Use **File → Export as → JSON**; `.drawio` XML is not supported. |

### UI prototypes

| Format | Fence | Choose it when |
| --- | --- | --- |
| Wiremark | `wireframe` (canonical) or `wiremark` | A quick text-based screen prototype is easiest. Follow the [Wiremark guide](https://docs.wiremark.dev/wiremark-llm.md). |
| Balsamiq Mockups 3 | `balsamiq` | The user provides a Mockups 3 JSON mockup. Other Balsamiq formats, including `.bmpr` and `.bmml`, are not supported. |
| Pencil | `pencil` or `pen` | The user provides a `.pen` document or wants Pencil-style frames. Use the supported embedded JSONC schema 2.21 subset. |
| Figma | `figma` | The user provides a Figma REST API JSON response or a frame URL. JSON rendering supports a subset; URL mode needs a configured Figma access token. |

Use the user's existing source format when possible. For new content, pick the format that expresses the requirement with the least extra syntax. Read the relevant project example or format guide when the format is unfamiliar. Do not invent Figma credentials or convert source files unless asked.

## Prose style

When prose is needed, follow ASD-STE100 (STE) principles: use short, clear sentences; keep one topic in each sentence; prefer active voice and simple, consistent terms. Preserve technical meaning and the requested document language. Do not claim formal STE compliance unless you apply its full rules and vocabulary.

## Output

- Keep the Markdown file as the source of truth.
- Report the paths of the Markdown and generated files.
- Mention validation warnings. Do not claim the plan is implemented or verified in code unless you checked the project.
