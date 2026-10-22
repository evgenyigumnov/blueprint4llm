# AGENTS.md

## Project folders

- `examples` contains sample `.md` files that the project can render.
- `src` contains the source code.
- `tests` contains the tests.
- `dev-docs` contains old plans used to create and change the project. Use the source code, tests, and `README.md` as the primary sources of current information.
- `skills/blueprint4llm` contains the `blueprint4llm` skill instructions.
- `vscode-extension` contains the Visual Studio Code extension code.

## Code rules

- Keep each code file to 300–500 lines at most. Split a file when it grows beyond this range.
- Give each module one coherent responsibility.
- Do not reduce logical cohesion or readability to meet an arbitrary line limit.
- Split files by function, not only by line count.
- Cover every function with unit tests.
- Add relevant unit tests when you add or change functionality or fix a bug.

## Before you finish

- All tests and builds must pass without errors or warnings.
- Do not weaken checks or remove tests to make tests pass.
- If all tests pass, increment the version in `package.json`. Use the smallest increment for a bug fix and a larger increment for new functionality.

## Main rule

**Never commit changes unless the user asks you to do so directly.**
