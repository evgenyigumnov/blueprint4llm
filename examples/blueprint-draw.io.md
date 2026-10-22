# draw.io JSON diagram

Export a diagram with **File → Export as → JSON** and paste its contents into a `drawio` block. For multiple pages, use `page=<id>`. The `direction=LR` option sets a left-to-right layout; the default is `TB`.

```drawio page=release direction=LR
{
  "version": "26.0",
  "pages": [
    {
      "id": "release",
      "name": "Release",
      "cells": [
        { "id": "layer-1", "type": "layer" },
        { "id": "build", "type": "group", "parent": "layer-1", "label": "Build and test" },
        { "id": "compile", "type": "node", "parent": "build", "label": "Build" },
        { "id": "test", "type": "node", "parent": "build", "label": "Test" },
        {
          "id": "compile-test",
          "type": "edge",
          "parent": "build",
          "source": "compile",
          "target": "test",
          "label": "success"
        },
        { "id": "publish", "type": "node", "parent": "layer-1", "label": "Publish" },
        {
          "id": "test-publish",
          "type": "edge",
          "parent": "layer-1",
          "source": "test",
          "target": "publish",
          "label": "release"
        }
      ]
    }
  ]
}
```

The compiler preserves labels and connections, then creates a new inline SVG diagram with an automatic layout. Original geometry and styles from draw.io JSON are not preserved.
