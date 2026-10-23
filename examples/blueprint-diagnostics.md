# Document diagnostics

The compiler keeps available Markdown content and valid diagrams visible when one diagram fails.
Each failed block shows its source position and full message. Add `--diagnostics-summary` to include
an overall error and warning count at the top of the document.

## Failed Mermaid diagram

```mermaid
flowchart LR
  Client -->
```

The service continues after the first failure.

## Valid draw.io diagram

```drawio
{
  "version": "26.0",
  "pages": [
    {
      "id": "page-1",
      "name": "Order flow",
      "cells": [
        { "id": "layer", "type": "layer" },
        { "id": "client", "type": "node", "parent": "layer", "label": "Client" },
        { "id": "api", "type": "node", "parent": "layer", "label": "Order API" },
        {
          "id": "request",
          "type": "edge",
          "parent": "layer",
          "source": "client",
          "target": "api",
          "label": "Submit order"
        }
      ]
    }
  ]
}
```

This diagram and the surrounding text remain available.

## Failed Wiremark screen

```wiremark
Wireframe #order-form mobile
  Stack column gap=2
    Typography h4 "Order form"
    UnknownControl "Submit"
```

The final paragraph remains available after both errors. Run `blueprint4llm` with `--check` to
collect both diagnostics, or use `--report-json=diagnostics.json` to save their coordinates.
