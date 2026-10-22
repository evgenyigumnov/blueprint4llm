# AGENTS.md

## Project folders

- `examples` contains sample `.md` files that the project can render.
- `src` contains the source code.
- `tests` contains the tests.
- `dev-docs` contains old plans used to create and change the project. Use the source code, tests, and `README.md` as the primary sources of current information.
- `vscode-extension` contains the Visual Studio Code extension code.

## Code rules

- Keep each code file to 300–500 lines at most. Split a file when it grows beyond this range.
- Give each module one coherent responsibility.
- Do not reduce logical cohesion or readability to meet an arbitrary line limit.
- Split files by function, not only by line count.
- Cover every function with unit tests.
- Add relevant unit tests when you add or change functionality or fix a bug.

## Markdown rules

- Use [Wiremark](https://docs.wiremark.dev/wiremark-llm.md) for UI prototypes. Use Mermaid for diagrams that explain how the code works.
- When you create development plans, such as `plan.md`, focus on UI prototypes and diagrams instead of text descriptions. This helps people understand the project visually.
- When you create UI prototypes with Wireframe blocks, do not combine multiple screens in one block. Use a separate Wireframe block for each screen.
- If you create or change a Markdown development plan, such as `plan.md`, open that plan in Chromium before you finish the task. This rule applies to plans only. It does not apply to `README.md`, `AGENTS.md`, examples, or other documentation.
- For each new or changed plan, run these steps from the project root:
  1. Start `blueprint4llm ./<PLAN_FILENAME>.md --serve --port=8811` in a separate terminal. Wait for the preview address. Keep the server running while you view the plan.
  2. In another terminal, run `chromium http://127.0.0.1:8811/` and wait for a Chromium window or tab to open.
  3. Confirm that Chromium shows the preview of the correct plan. Starting the server or seeing the URL is not enough.
- If an old preview is using port `8811`, stop that server before you start a new one. If you change multiple plans, open each plan in turn and repeat both steps.

## Use ASD-STE100 (Simplified Technical English) principles at about 80%

- Write briefly, directly, and clearly.
- Do not repeat information.
- Avoid introductory phrases and obvious explanations.
- Put one idea in each sentence.
- Do not describe details that are clear from the code or diagram.
- Use Mermaid for architecture and process diagrams.
- Use Wiremark for UI prototypes.
- Keep the text short without losing important details.

The goal is to minimize the time people need to understand and review the solution.

## Before you finish

- All tests and builds must pass without errors or warnings.
- Do not weaken checks or remove tests to make tests pass.
- If all tests pass, increment the version in `package.json`. Use the smallest increment for a bug fix and a larger increment for new functionality.

## Main rule

**Never commit changes unless the user asks you to do so directly.**
