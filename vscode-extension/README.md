# Blueprint4llm Preview for VS Code

This package is the desktop VS Code shell for the existing `blueprint4llm` renderer. The first implementation stage sets up its runtime and VSIX packaging; preview commands are added in the next stage.

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

## Development

From the repository root, install and build the core package first. Then install the extension's development dependencies:

```bash
npm install
npm run build
cd vscode-extension
npm install
npm run test:host
npm run package
```

`npm run test:host` starts an Extension Development Host at the minimum supported VS Code version. On headless Linux, run it under `xvfb-run -a`.

`npm run test:package` builds a VSIX in a temporary directory, launches the unpacked package in the Extension Development Host, renders Mermaid through the packaged CLI, and checks the missing Chrome diagnostic. Run both checks with `npm test`.
