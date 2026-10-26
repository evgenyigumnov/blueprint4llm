# Figma REST JSON and links

Use a `figma` fenced code block for either a local Figma REST file response in JSON or an HTTPS Figma design link. These are separate input modes: JSON is rendered locally without a network request, while a link asks the renderer to export one frame through Figma's authenticated API.

## Upstream Figma REST model (format knowledge)

Figma's REST API exposes structured file data and derived exports; it does **not** serialize the editor's native `.fig` document as a portable file. A file request such as `GET /v1/files/:file_key` returns a JSON response whose `document` is a tree, alongside file metadata such as the file name, last-modified time, version, and maps of components and styles. The tree conventionally starts at a `DOCUMENT`, whose `children` are `CANVAS` pages; page children are layers such as frames, groups, components, and shapes. Node IDs identify layers and appear in API responses with colon separators (for example, `12:34`).

The file and node endpoints can return a large tree. Use the file endpoint's `depth` option or the file-nodes endpoint when you need a focused subset; preserve the page/frame ancestors and geometry needed to understand the chosen layer. File/version URLs identify a document revision, while node IDs identify a specific layer. REST file JSON, a browser link, and an editor-native file are different artifacts: the renderer accepts a REST-shaped JSON excerpt locally, not a `.fig` binary or arbitrary Figma export.

### Nodes, hierarchy, and geometry

Nodes have a `type`, `id`, `name`, visibility and opacity properties, and type-specific content. Common types include `DOCUMENT`, `CANVAS`, `FRAME`, `GROUP`, `COMPONENT`, `COMPONENT_SET`, `INSTANCE`, `RECTANGLE`, `ELLIPSE`, `LINE`, `TEXT`, `VECTOR`, and `BOOLEAN_OPERATION`. Frames commonly express layout regions, clipping and backgrounds; groups organize layers; components define reusable source designs; instances refer to those components and may carry property overrides. Component sets collect variants, and instance component properties can represent choices such as a variant, Boolean state, text value, or swapped instance. Boolean operations and many further node types are valid upstream but are not necessarily supported by a renderer.

The tree is hierarchical, not a flat canvas: node `children` belong to their parent and their order is meaningful for painting. `absoluteBoundingBox` gives a node's axis-aligned bounds in document coordinates. `relativeTransform` is a 2-by-3 affine transform from the parent coordinate space, and `size` gives local dimensions; rotation and transforms therefore matter when interpreting nested geometry. Do not confuse a node's global bounding box with its local coordinates. A frame can clip its children, while visibility, opacity, masks, effects, and blend modes can change the final appearance. When choosing layers for a hand-authored snapshot, retain the complete parent-child relationships, coordinate information, and draw order that affect the selected frame.

### Paints, text, styles, and vectors

A node's `fills` and `strokes` are ordered paint arrays. Upstream paint records can describe solid colors, gradients and images, plus opacity, visibility, transforms, and other paint-specific data. Figma color channels are normalized values; style references and the file-level `styles` map identify reusable shared text, fill, stroke, and effect styles. A node's `styles` property points to those shared style IDs; style metadata is distinct from the resolved paint or text properties used to draw a layer. Variables and `boundVariables` add another reusable token layer. When authoring, prefer consistent semantic color/type/spacing tokens and shared component styles rather than duplicating slightly different values.

`TEXT` nodes carry `characters`, a text `style`, and can also include per-character style overrides and line data. Use text styles for typeface, size, weight, alignment and line-height; remember that a font may not be installed in the eventual renderer. `VECTOR` nodes contain path geometry, commonly exposed as `fillGeometry` and `strokeGeometry` when the file or node request asks for `geometry=paths`. Paths carry SVG-like path data and winding rules. A vector's shape is not recoverable from its bounds alone. In the upstream API, geometry may be omitted unless requested; include the path geometry when creating a local JSON snapshot intended to render vector nodes.

### API access, revisions, node links, and exports

The REST API's file endpoint retrieves document structure, while the file-nodes endpoint can focus on node IDs and the images endpoint exports selected nodes in formats such as SVG or PNG. A design link's file key identifies the file; `node-id` identifies the selected layer, and an optional `version-id` pins a revision. For example, query the official API's file or image endpoint with the relevant file key, node ID, version and export options rather than treating an editor URL as the response JSON. Figma's REST API requires an authorized credential with permission to read the requested file; access may be restricted by the user's file permissions and token scopes. Keep credentials in a secret manager, environment, or local ignored `.env`, never in a diagram block, guide, source JSON, or committed file.

**Upstream-only capabilities:** Figma's full node tree, component metadata and variants, style/variable references, gradient/image paints, complex text ranges, masks/effects, boolean operations, and node-specific API options are broader than blueprint4llm's local JSON renderer. The remote URL path is an SVG export path, not support for every REST node field. The precise local profile follows.

## Current blueprint4llm local JSON profile

The JSON input must be a Figma file response object with a `document` object whose `type` is `DOCUMENT`. Its `children` are typically `CANVAS` pages, and each page's `children` contain frames. Each node needs a non-empty string `id` and `type`; `name` is an optional string, and `children` is an optional array. Node IDs must be unique throughout the tree. `absoluteBoundingBox` contains finite numeric `x`, `y`, `width`, and `height` values; widths and heights cannot be negative. The selected frame must have positive width and height.

With no fence option, the renderer selects a single top-level `FRAME`, `COMPONENT`, or `INSTANCE` directly under a `CANVAS`. If there are none or more than one, choose a node explicitly with `node=<id>` in the fence info string. For example, set the fence option to `node=12:34` to select node `12:34`. The ID must have the form `<digits>:<digits>`, exist in the tree, and refer to a `FRAME`, `COMPONENT`, or `INSTANCE`. Explicit selection can find a nested node. The selected node and every visible node rendered beneath it need an `absoluteBoundingBox`.

The renderer supports these node types:

| Node types                                | Behavior                                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `FRAME`, `GROUP`, `COMPONENT`, `INSTANCE` | Containers that may have children; each also has a rectangular shape that can have solid fills and strokes. |
| `RECTANGLE`                               | Rectangle, optionally with `cornerRadius` or four `rectangleCornerRadii`.                                   |
| `ELLIPSE`                                 | Ellipse sized from its bounding box.                                                                        |
| `LINE`                                    | Line from the bounding box's top-left to bottom-right; use a stroke.                                        |
| `TEXT`                                    | Plain text from `characters`, positioned from its bounding box and `style`.                                 |
| `VECTOR`                                  | Paths from `fillGeometry` and `strokeGeometry`. Include path geometry when authoring vector nodes.          |

Only solid paints are supported. A fill or stroke is an array such as `[{"type":"SOLID","color":{"r":0.12,"g":0.32,"b":0.72,"a":1}}]`; each color component and optional paint `opacity` must be between 0 and 1. The alpha component and paint opacity default to 1. Paints marked `visible: false` are skipped. Gradients, images, and other paint types are unsupported. For text, include a `characters` string, `style` object, and a visible solid fill or stroke; the renderer emits selectable SVG text. Unknown JSON fields do not add rendering support. Inputs are limited to 1 MiB, 10,000 nodes, and 100 levels of nesting.

For a `VECTOR`, provide `fillGeometry` and/or `strokeGeometry` arrays when the corresponding paint is present. Each path entry has a valid SVG path string in `path` and may set `windingRule` to `NONZERO` or `EVENODD`.

The renderer also supports basic geometry such as rotation, transforms, frame clipping, and ordinary strokes. It rejects unsupported node types, masks, visible effects, non-normal blend modes, nonzero corner smoothing, unsupported stroke settings, and per-character text style overrides. Keep the tree to the node and style subset above rather than expecting every feature from a Figma document to be reproduced.

## Complete local JSON document

This workspace overview uses one page and one top-level frame, so no selection option is needed. All visible nodes have bounds; colors use normalized RGB values; text and shapes use only supported node and paint types.

```figma
{
  "name": "Northstar workspace",
  "document": {
    "id": "0:0",
    "name": "Northstar workspace",
    "type": "DOCUMENT",
    "children": [
      {
        "id": "1:0",
        "name": "Product",
        "type": "CANVAS",
        "children": [
          {
            "id": "10:0",
            "name": "Workspace overview",
            "type": "FRAME",
            "absoluteBoundingBox": { "x": 0, "y": 0, "width": 960, "height": 640 },
            "fills": [
              { "type": "SOLID", "color": { "r": 0.96, "g": 0.97, "b": 0.99, "a": 1 } }
            ],
            "children": [
              {
                "id": "10:1",
                "name": "Application header",
                "type": "FRAME",
                "absoluteBoundingBox": { "x": 0, "y": 0, "width": 960, "height": 64 },
                "fills": [
                  { "type": "SOLID", "color": { "r": 1, "g": 1, "b": 1 } }
                ],
                "children": [
                  {
                    "id": "10:2",
                    "name": "Product name",
                    "type": "TEXT",
                    "absoluteBoundingBox": { "x": 24, "y": 20, "width": 150, "height": 28 },
                    "characters": "Northstar",
                    "style": { "fontFamily": "Inter", "fontSize": 20, "fontWeight": 700, "lineHeightPx": 28 },
                    "fills": [
                      { "type": "SOLID", "color": { "r": 0.08, "g": 0.12, "b": 0.2 } }
                    ]
                  },
                  {
                    "id": "10:3",
                    "name": "Search hint",
                    "type": "TEXT",
                    "absoluteBoundingBox": { "x": 230, "y": 22, "width": 260, "height": 22 },
                    "characters": "Search projects and people",
                    "style": { "fontFamily": "Inter", "fontSize": 14, "lineHeightPx": 20 },
                    "fills": [
                      { "type": "SOLID", "color": { "r": 0.43, "g": 0.47, "b": 0.55 } }
                    ]
                  },
                  {
                    "id": "10:4",
                    "name": "Profile avatar",
                    "type": "ELLIPSE",
                    "absoluteBoundingBox": { "x": 904, "y": 16, "width": 32, "height": 32 },
                    "fills": [
                      { "type": "SOLID", "color": { "r": 0.19, "g": 0.35, "b": 0.78 } }
                    ]
                  }
                ]
              },
              {
                "id": "10:5",
                "name": "Navigation",
                "type": "FRAME",
                "absoluteBoundingBox": { "x": 0, "y": 64, "width": 224, "height": 576 },
                "fills": [
                  { "type": "SOLID", "color": { "r": 1, "g": 1, "b": 1 } }
                ],
                "children": [
                  {
                    "id": "10:6",
                    "name": "Selected navigation item",
                    "type": "RECTANGLE",
                    "absoluteBoundingBox": { "x": 12, "y": 88, "width": 200, "height": 40 },
                    "cornerRadius": 8,
                    "fills": [
                      { "type": "SOLID", "color": { "r": 0.91, "g": 0.94, "b": 1 } }
                    ]
                  },
                  {
                    "id": "10:7",
                    "name": "Overview navigation label",
                    "type": "TEXT",
                    "absoluteBoundingBox": { "x": 28, "y": 98, "width": 160, "height": 20 },
                    "characters": "Overview",
                    "style": { "fontFamily": "Inter", "fontSize": 14, "fontWeight": 600, "lineHeightPx": 20 },
                    "fills": [
                      { "type": "SOLID", "color": { "r": 0.13, "g": 0.29, "b": 0.7 } }
                    ]
                  },
                  {
                    "id": "10:8",
                    "name": "Other navigation labels",
                    "type": "TEXT",
                    "absoluteBoundingBox": { "x": 28, "y": 148, "width": 160, "height": 110 },
                    "characters": "Projects\nReports\nTeam settings",
                    "style": { "fontFamily": "Inter", "fontSize": 14, "lineHeightPx": 36 },
                    "fills": [
                      { "type": "SOLID", "color": { "r": 0.27, "g": 0.31, "b": 0.39 } }
                    ]
                  }
                ]
              },
              {
                "id": "10:9",
                "name": "Main content",
                "type": "FRAME",
                "absoluteBoundingBox": { "x": 224, "y": 64, "width": 736, "height": 576 },
                "children": [
                  {
                    "id": "10:10",
                    "name": "Page title",
                    "type": "TEXT",
                    "absoluteBoundingBox": { "x": 256, "y": 88, "width": 420, "height": 32 },
                    "characters": "Workspace overview",
                    "style": { "fontFamily": "Inter", "fontSize": 24, "fontWeight": 700, "lineHeightPx": 30 },
                    "fills": [
                      { "type": "SOLID", "color": { "r": 0.08, "g": 0.12, "b": 0.2 } }
                    ]
                  },
                  {
                    "id": "10:11",
                    "name": "Page subtitle",
                    "type": "TEXT",
                    "absoluteBoundingBox": { "x": 256, "y": 124, "width": 520, "height": 22 },
                    "characters": "A quick view of your team's current work.",
                    "style": { "fontFamily": "Inter", "fontSize": 14, "lineHeightPx": 20 },
                    "fills": [
                      { "type": "SOLID", "color": { "r": 0.43, "g": 0.47, "b": 0.55 } }
                    ]
                  },
                  {
                    "id": "10:12",
                    "name": "Project metric card",
                    "type": "GROUP",
                    "absoluteBoundingBox": { "x": 256, "y": 168, "width": 206, "height": 112 },
                    "children": [
                      {
                        "id": "10:13",
                        "name": "Project metric background",
                        "type": "RECTANGLE",
                        "absoluteBoundingBox": { "x": 256, "y": 168, "width": 206, "height": 112 },
                        "cornerRadius": 12,
                        "fills": [
                          { "type": "SOLID", "color": { "r": 1, "g": 1, "b": 1 } }
                        ],
                        "strokes": [
                          { "type": "SOLID", "color": { "r": 0.88, "g": 0.9, "b": 0.93 } }
                        ],
                        "strokeWeight": 1
                      },
                      {
                        "id": "10:14",
                        "name": "Active projects label",
                        "type": "TEXT",
                        "absoluteBoundingBox": { "x": 276, "y": 184, "width": 166, "height": 20 },
                        "characters": "Active projects",
                        "style": { "fontFamily": "Inter", "fontSize": 13, "lineHeightPx": 18 },
                        "fills": [
                          { "type": "SOLID", "color": { "r": 0.43, "g": 0.47, "b": 0.55 } }
                        ]
                      },
                      {
                        "id": "10:15",
                        "name": "Active project count",
                        "type": "TEXT",
                        "absoluteBoundingBox": { "x": 276, "y": 212, "width": 166, "height": 36 },
                        "characters": "24",
                        "style": { "fontFamily": "Inter", "fontSize": 28, "fontWeight": 700, "lineHeightPx": 34 },
                        "fills": [
                          { "type": "SOLID", "color": { "r": 0.08, "g": 0.12, "b": 0.2 } }
                        ]
                      }
                    ]
                  },
                  {
                    "id": "10:16",
                    "name": "Review metric card",
                    "type": "GROUP",
                    "absoluteBoundingBox": { "x": 477, "y": 168, "width": 206, "height": 112 },
                    "children": [
                      {
                        "id": "10:17",
                        "name": "Review metric background",
                        "type": "RECTANGLE",
                        "absoluteBoundingBox": { "x": 477, "y": 168, "width": 206, "height": 112 },
                        "cornerRadius": 12,
                        "fills": [
                          { "type": "SOLID", "color": { "r": 1, "g": 1, "b": 1 } }
                        ],
                        "strokes": [
                          { "type": "SOLID", "color": { "r": 0.88, "g": 0.9, "b": 0.93 } }
                        ],
                        "strokeWeight": 1
                      },
                      {
                        "id": "10:18",
                        "name": "Needs review label",
                        "type": "TEXT",
                        "absoluteBoundingBox": { "x": 497, "y": 184, "width": 166, "height": 20 },
                        "characters": "Needs review",
                        "style": { "fontFamily": "Inter", "fontSize": 13, "lineHeightPx": 18 },
                        "fills": [
                          { "type": "SOLID", "color": { "r": 0.43, "g": 0.47, "b": 0.55 } }
                        ]
                      },
                      {
                        "id": "10:19",
                        "name": "Review count",
                        "type": "TEXT",
                        "absoluteBoundingBox": { "x": 497, "y": 212, "width": 166, "height": 36 },
                        "characters": "08",
                        "style": { "fontFamily": "Inter", "fontSize": 28, "fontWeight": 700, "lineHeightPx": 34 },
                        "fills": [
                          { "type": "SOLID", "color": { "r": 0.08, "g": 0.12, "b": 0.2 } }
                        ]
                      }
                    ]
                  },
                  {
                    "id": "10:20",
                    "name": "Completion metric card",
                    "type": "GROUP",
                    "absoluteBoundingBox": { "x": 698, "y": 168, "width": 220, "height": 112 },
                    "children": [
                      {
                        "id": "10:21",
                        "name": "Completion metric background",
                        "type": "RECTANGLE",
                        "absoluteBoundingBox": { "x": 698, "y": 168, "width": 220, "height": 112 },
                        "cornerRadius": 12,
                        "fills": [
                          { "type": "SOLID", "color": { "r": 1, "g": 1, "b": 1 } }
                        ],
                        "strokes": [
                          { "type": "SOLID", "color": { "r": 0.88, "g": 0.9, "b": 0.93 } }
                        ],
                        "strokeWeight": 1
                      },
                      {
                        "id": "10:22",
                        "name": "Completion label",
                        "type": "TEXT",
                        "absoluteBoundingBox": { "x": 718, "y": 184, "width": 180, "height": 20 },
                        "characters": "Completed this month",
                        "style": { "fontFamily": "Inter", "fontSize": 13, "lineHeightPx": 18 },
                        "fills": [
                          { "type": "SOLID", "color": { "r": 0.43, "g": 0.47, "b": 0.55 } }
                        ]
                      },
                      {
                        "id": "10:23",
                        "name": "Completion count",
                        "type": "TEXT",
                        "absoluteBoundingBox": { "x": 718, "y": 212, "width": 180, "height": 36 },
                        "characters": "12",
                        "style": { "fontFamily": "Inter", "fontSize": 28, "fontWeight": 700, "lineHeightPx": 34 },
                        "fills": [
                          { "type": "SOLID", "color": { "r": 0.08, "g": 0.12, "b": 0.2 } }
                        ]
                      }
                    ]
                  },
                  {
                    "id": "10:24",
                    "name": "Recent projects panel",
                    "type": "FRAME",
                    "absoluteBoundingBox": { "x": 256, "y": 300, "width": 662, "height": 300 },
                    "fills": [
                      { "type": "SOLID", "color": { "r": 1, "g": 1, "b": 1 } }
                    ],
                    "strokes": [
                      { "type": "SOLID", "color": { "r": 0.88, "g": 0.9, "b": 0.93 } }
                    ],
                    "strokeWeight": 1,
                    "children": [
                      {
                        "id": "10:25",
                        "name": "Panel title",
                        "type": "TEXT",
                        "absoluteBoundingBox": { "x": 280, "y": 320, "width": 300, "height": 24 },
                        "characters": "Recent projects",
                        "style": { "fontFamily": "Inter", "fontSize": 16, "fontWeight": 600, "lineHeightPx": 22 },
                        "fills": [
                          { "type": "SOLID", "color": { "r": 0.08, "g": 0.12, "b": 0.2 } }
                        ]
                      },
                      {
                        "id": "10:26",
                        "name": "Table headings",
                        "type": "TEXT",
                        "absoluteBoundingBox": { "x": 280, "y": 366, "width": 610, "height": 18 },
                        "characters": "PROJECT                         OWNER                      STATUS",
                        "style": { "fontFamily": "Inter", "fontSize": 11, "fontWeight": 600, "lineHeightPx": 16, "letterSpacing": 0.4 },
                        "fills": [
                          { "type": "SOLID", "color": { "r": 0.43, "g": 0.47, "b": 0.55 } }
                        ]
                      },
                      {
                        "id": "10:27",
                        "name": "First project row",
                        "type": "TEXT",
                        "absoluteBoundingBox": { "x": 280, "y": 402, "width": 610, "height": 22 },
                        "characters": "Mobile onboarding              Maya Chen                  In progress",
                        "style": { "fontFamily": "Inter", "fontSize": 13, "lineHeightPx": 18 },
                        "fills": [
                          { "type": "SOLID", "color": { "r": 0.2, "g": 0.24, "b": 0.31 } }
                        ]
                      },
                      {
                        "id": "10:28",
                        "name": "First row divider",
                        "type": "LINE",
                        "absoluteBoundingBox": { "x": 280, "y": 438, "width": 610, "height": 0 },
                        "strokes": [
                          { "type": "SOLID", "color": { "r": 0.9, "g": 0.92, "b": 0.94 } }
                        ],
                        "strokeWeight": 1
                      },
                      {
                        "id": "10:29",
                        "name": "Second project row",
                        "type": "TEXT",
                        "absoluteBoundingBox": { "x": 280, "y": 454, "width": 610, "height": 22 },
                        "characters": "Billing refresh                 Omar Patel                In review",
                        "style": { "fontFamily": "Inter", "fontSize": 13, "lineHeightPx": 18 },
                        "fills": [
                          { "type": "SOLID", "color": { "r": 0.2, "g": 0.24, "b": 0.31 } }
                        ]
                      },
                      {
                        "id": "10:30",
                        "name": "Second row divider",
                        "type": "LINE",
                        "absoluteBoundingBox": { "x": 280, "y": 490, "width": 610, "height": 0 },
                        "strokes": [
                          { "type": "SOLID", "color": { "r": 0.9, "g": 0.92, "b": 0.94 } }
                        ],
                        "strokeWeight": 1
                      },
                      {
                        "id": "10:31",
                        "name": "Third project row",
                        "type": "TEXT",
                        "absoluteBoundingBox": { "x": 280, "y": 506, "width": 610, "height": 22 },
                        "characters": "Analytics dashboard           Lena Fischer              Planned",
                        "style": { "fontFamily": "Inter", "fontSize": 13, "lineHeightPx": 18 },
                        "fills": [
                          { "type": "SOLID", "color": { "r": 0.2, "g": 0.24, "b": 0.31 } }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}
```

## URL input mode: authenticated SVG export

A URL is a live, network-backed input, distinct from local JSON. The accepted shape is an HTTPS link on `figma.com` or `www.figma.com` with a `/design/<file-key>` or `/file/<file-key>` path and exactly one `node-id=<number>-<number>` query parameter. One optional `version-id` may also be supplied. Unrelated query parameters are ignored. The renderer translates the link to a request to Figma's Images API for one SVG (`format=svg`, with text not outlined), then downloads the returned SVG. It does not fetch the complete REST file tree and does not pass a full file response through the local JSON renderer.

URL mode requires a real configured `FIGMA_ACCESS_TOKEN`. The renderer resolves it from the compile option, the `FIGMA_ACCESS_TOKEN` environment variable, or a `.env` file in the current working directory, in that order. The token is sent only to Figma's API request, not to the returned SVG download host. Without a non-empty configured token, URL rendering stops before making a request. File permissions or a missing `file_content:read` scope can prevent access. Invalid/expired credentials, denied or unavailable files/nodes, rate limits, request timeouts, and unavailable SVG exports can also fail. Local JSON needs no token and makes no network request. Do not treat a URL as an offline snapshot, fabricate a token, or place credentials in the Markdown.

## Authoring tips and response limitations

For a fully local illustration, prepare a small REST-response-shaped snapshot with one page, one selected frame, stable unique IDs, explicit bounds and only the layer fields needed for a static picture. Keep absolute coordinates consistent with each layer's parent relationship; do not paste just a frame's name or bounding box and expect Figma to reconstruct its contents. Include `geometry=paths` data for vector layers, and simplify gradients, images, effects, masks, complex text, or unsupported node types into ordinary shapes and text if a portable local rendering is required. For exact appearance with rich native features, a Figma SVG export may be a better source, but this guide's URL mode itself accepts a Figma link, not arbitrary SVG input.

API responses can be incomplete for a rendering purpose: file requests may limit tree depth, vector geometry is optional, node bounds can be absent, and access restrictions can conceal the document. An export can fail independently of successfully opening a design in the editor. Check the endpoint's returned data and requested node/version before reducing the JSON; do not infer missing geometry from a screenshot or from component metadata alone.

## Common mistakes

- Supplying a Figma URL when working offline. Use a local JSON response instead; URL rendering needs network access and a configured token.
- Omitting the `document` object, using a root type other than `DOCUMENT`, or putting a `FRAME` somewhere other than directly under a `CANVAS` without selecting it.
- Having zero or multiple top-level frames but omitting the `node=<id>` fence option.
- Using an invalid or repeated `node=` option, or selecting a `TEXT`, `GROUP`, or other type instead of a frame, component, or instance.
- Leaving out a visible node's `absoluteBoundingBox`, or giving the selected frame zero width or height.
- Using duplicate IDs, unsupported node types such as `BOOLEAN_OPERATION`, or a gradient/image fill instead of a visible `SOLID` paint.
- Giving a `VECTOR` a fill or stroke but no matching path geometry. Vector paths must be supplied in `fillGeometry` or `strokeGeometry`.
- Expecting every Figma effect, mask, blend mode, variable stroke, or per-character text style to render. Those features exceed this renderer's supported subset.
- Treating the browser design link, editor-native `.fig` file, and REST file JSON as interchangeable formats; only the JSON response-shaped local subset is parsed offline.
- Expecting full REST metadata such as components, styles, variables, or unrequested vector geometry to expand into a rendered design automatically.

## Official references

- [Figma REST API overview](https://developers.figma.com/docs/rest-api/)
- [Figma file endpoints](https://developers.figma.com/docs/rest-api/files/)
- [Figma REST API authentication](https://developers.figma.com/docs/rest-api/authentication/)
- [Figma image export endpoint](https://developers.figma.com/docs/rest-api/images-endpoint/)

Review date: 2026-10-26.
