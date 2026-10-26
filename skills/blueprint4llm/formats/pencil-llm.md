# Pencil JSONC guide for blueprint4llm

Pencil's native `.pen` format is a versioned design document with a rich object tree, layout system, graphics, and reusable components. This guide first summarizes that upstream model, then defines the much smaller schema 2.21 profile accepted by blueprint4llm. The renderer consumes an embedded JSONC document and converts the accepted subset to static SVG; it does not load external assets or resolve editor-only design features.

## Upstream `.pen` model — format knowledge

An upstream `.pen` file is a JSON document (JSON comments are allowed) with a `version` and a tree of uniquely identified objects. The `children` array contains the canvas's top-level objects; the canvas is conceptually unbounded. Objects have a `type`, geometry, appearance and, where appropriate, children. The object tree expresses both containment and a design's logical structure: a page-sized frame can contain panels, a group can collect related marks, and leaves can be text or vector shapes.

### Nodes, coordinates, and layout

- **Frames** are rectangular container nodes with an optional visual surface. They can hold nested content, clip overflow, and apply horizontal, vertical, or absolute (`none`) layout. Use frames for screens, sections, cards, and other areas that need a surface, clipping, or layout behavior.
- **Groups** collect related objects into a hierarchy without necessarily drawing a container surface. Use them to keep an icon, illustration, or related set of marks together.
- **Shapes** include rectangles, ellipses, polygons, and SVG paths. **Text** nodes carry content and text styling. The upstream schema also defines other kinds of nodes (such as icons, scripts, browser previews, and references); see the local-profile comparison below before using them here.
- The canvas uses ordinary 2D coordinates: x increases to the right and y increases downward. Top-level x/y locate an object's top-left corner on the canvas; nested x/y are relative to the parent's top-left. Rotation is counter-clockwise around that corner. In a flow layout, the parent places children and their x/y positions do not determine their flow position.
- Upstream layout can combine fixed dimensions with dynamic `fit_content` and `fill_container` sizing, including fallback sizes. Frames can use flex-like `layout`, `gap`, padding, `justifyContent`, and `alignItems`; absolute positioning can be selected for a child with `layoutPosition`. Choose flow layout for repeated rows, columns, and responsive-looking arrangements; use explicit geometry when precise canvas placement matters. The actual support in blueprint4llm is narrower and is specified below.

### Paints, effects, and reusable design systems

Upstream graphics are richer than a single color per node. A fill may be a solid color, gradient, image, mesh gradient, or shader, and a node may stack fills painted in array order. Strokes can have multiple fills and additional alignment/width options. Nodes may also have ordered effects such as shadows, blur, background blur, or shaders. Use gradients or imagery for visual emphasis rather than encoding meaning by color alone; use contrast, labels, and repeated visual patterns so the design remains understandable.

The native format also supports design-system patterns:

- Mark a node `reusable: true` to define a component, then use a `ref` node to instantiate it. An instance can override properties and customize nested descendants; nested instances can be composed into larger reusable components.
- Frames can expose `slot`s as intended insertion points for approved child components. This is useful for shared shells, cards, menus, and other structures whose content varies.
- Document-wide `variables` and `themes` can centralize colors, dimensions, and other values and select variants such as light/dark or compact/regular.
- `imports` can refer to other `.pen` files. These features help maintain consistency in full editor documents, but they are not a substitute for literal, self-contained values in the local renderer profile.

For example, an upstream-only reusable status badge can be defined once and instantiated with a visual override:

```jsonc
{
  "version": "2.21",
  "children": [
    {
      "id": "status-badge",
      "type": "rectangle",
      "reusable": true,
      "width": 112,
      "height": 28,
      "cornerRadius": 14,
      "fill": "#DCFCE7",
    },
    {
      "id": "critical-badge",
      "type": "ref",
      "ref": "status-badge",
      "x": 128,
      "y": 0,
      "fill": "#FEE2E2",
    },
  ],
}
```

`reusable`, `ref`, and instance overrides are native format features; the local profile below rejects them.

**Upstream only:** the preceding capabilities describe the broader `.pen` format, not promises that blueprint4llm can render every native file. Native design files can contain properties, node types, assets, references, and document metadata that this renderer deliberately rejects. Do not pass a complete editor-authored file into the renderer unless it has been reduced to the local profile.

## Upstream format vs. blueprint4llm profile

The upstream schema is versioned; this renderer currently embeds and accepts **only schema `2.21`**, but accepting that version string does not mean it implements the full upstream schema. The implementation validates a strict local allowlist and emits static SVG. Use this comparison to decide what to flatten or omit before authoring:

| Area              | Upstream `.pen` capability                                                                                                             | Current blueprint4llm acceptance                                                                                                                                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document          | Versioned document with `children`, and document-level `imports`, `variables`, and `themes`.                                           | Root accepts exactly `version: "2.21"` and `children`. Other root fields are rejected.                                                                                                                                                                                           |
| Nodes             | Frames, groups, shapes, text, and additional node kinds including `note`, `prompt`, `context`, `icon`, `script`, `browser`, and `ref`. | Only `frame`, `group`, `rectangle`, `ellipse`, `polygon`, `path`, and `text`. Only frames/groups may own `children`; IDs must be unique and cannot contain `/`.                                                                                                                  |
| Sizing and layout | Dynamic sizing, fill-to-parent behavior, absolute layout positions, and other editor layout semantics.                                 | Finite x/y/rotation, explicit positive dimensions on leaves, optional frame/group dimensions computed from children, and only `none`/horizontal/vertical layout with the local gap/padding/alignment rules below. No `fit_content`/`fill_container` strings or `layoutPosition`. |
| Appearance        | Multiple fills; gradients, images, mesh gradients, stroke variants, and effects including shadows and blur.                            | One solid hex color or `none` for each fill/stroke, optional common opacity and stroke properties, plus the listed text, corner, and clipping properties. No image loading, gradient, shader, mesh paint, or effect support.                                                     |
| Components        | Reusable definitions, `ref` instances, descendant overrides, slots, variables, themes, and imports.                                    | Not supported: these properties/types are rejected. Inline ordinary nodes and literal color/number values instead.                                                                                                                                                               |

When drawing a screen or simple illustration for this project, prefer concrete frames and ordinary shapes, explicitly size leaf nodes, use solid hex colors, and keep the full tree inside the Markdown fence. This produces predictable offline SVG without requiring asset resolution or a Pencil editor.

There is no Pencil rendering SDK dependency: `src/renderers/pencil*.ts` implements the project schema, layout, and SVG output. It uses `jsonc-parser` for JSONC parsing (`^3.3.1` in `package.json`, resolved to `3.3.1` in `package-lock.json`). The focused contract tests are `tests/pencil-json.test.ts`, `tests/pencil-layout.test.ts`, and `tests/pencil-renderer.test.ts`; they cover parsing and rejected fields, layout, and SVG rendering.

## Markdown fence and document shape

Put one complete JSONC document in a fenced `pencil` or `pen` block:

````markdown
```pencil
{
  "version": "2.21",
  "children": []
}
```
````

The top-level object accepts exactly two properties:

- `version`: required, and must be the string `"2.21"`.
- `children`: required array of top-level nodes. An empty array is valid.

JSONC comments are allowed. Trailing commas are rejected. Duplicate JSON object keys are rejected. Unknown document or node properties are errors; keep the document to the fields listed here.

Each node requires a unique, non-empty `id` and a supported `type`. IDs may not contain `/`. The supported types are `frame`, `group`, `rectangle`, `ellipse`, `polygon`, `path`, and `text`. Only `frame` and `group` accept a `children` array; children cannot be attached to shapes or text.

The accepted source is limited to 1 MiB, 10,000 nodes, and 100 levels of node nesting. The final layout coordinates and dimensions must stay within the renderer's 16,384-pixel bounds; the rendered SVG is limited to 16,384 pixels per side and 4 MiB of output.

## Geometry, nesting, and containers

`x` and `y` are finite numbers and default to `0`. Top-level coordinates are measured from the document origin. A nested node's coordinates are offsets from its parent; nested offsets accumulate, so a child at `(12, 8)` inside a frame at `(100, 40)` is placed at `(112, 48)` before rotation. Negative coordinates are allowed. `rotation` is a finite angle in degrees; it rotates the node and its descendants around the node's top-left corner. Positive Pencil rotation is counter-clockwise.

Every non-container node (`rectangle`, `ellipse`, `polygon`, `path`, or `text`) must specify positive `width` and `height`. `frame` and `group` may omit either dimension; the renderer computes a natural size from their children and padding. A container can also set explicit dimensions.

Containers accept these layout properties:

| Property         | Accepted values and behavior                                                                                                                                                                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layout`         | `"none"`, `"horizontal"`, or `"vertical"`. A frame defaults to `"horizontal"`; a group defaults to `"none"`. In `"none"`, child `x`/`y` offsets position children. In horizontal or vertical layout, children are placed in array order and their own `x`/`y` do not set their flow position. |
| `gap`            | One non-negative number between adjacent flow children; defaults to `0`.                                                                                                                                                                                                                      |
| `padding`        | One non-negative number for all sides, `[vertical, horizontal]`, or `[top, right, bottom, left]`; defaults to `0`.                                                                                                                                                                            |
| `justifyContent` | `"start"`, `"center"`, `"end"`, `"space_between"`, or `"space_around"` on the flow axis; defaults to `"start"`.                                                                                                                                                                               |
| `alignItems`     | `"start"`, `"center"`, or `"end"` on the cross axis; defaults to `"start"`.                                                                                                                                                                                                                   |

Flow layout uses remaining space only when the container has an explicit size larger than its children plus gaps and padding. Frames draw their own rectangular surface. `clip: true` on a frame clips its children to the frame rectangle, including its rounded corners if present. Groups have no surface unless they have a `fill` or `stroke`.

## Supported node properties

All node types accept `id`, `type`, and these common optional properties:

| Property          | Meaning and validation                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| `x`, `y`          | Finite coordinate offsets; each defaults to `0`.                                                   |
| `width`, `height` | Positive dimensions. Required for every non-container node; optional for frames and groups.        |
| `enabled`         | Boolean; `false` hides this node and all its descendants.                                          |
| `opacity`         | Number from `0` through `1`; defaults to `1`.                                                      |
| `rotation`        | Any finite number of degrees; defaults to `0`.                                                     |
| `fill`, `stroke`  | A supported paint value (see below). Omitted paints are `none`, except omitted text fill is black. |
| `strokeWidth`     | Optional non-negative number, at most `16,384`; when present, sets the SVG stroke width.           |
| `strokeLinecap`   | `"butt"`, `"round"`, or `"square"`.                                                                |
| `strokeLinejoin`  | `"miter"`, `"bevel"`, or `"round"`.                                                                |

The properties specific to each type are:

| Type        | Additional properties                                                                                                                                                        |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frame`     | `children`, container layout properties, `clip` (boolean), `cornerRadius`.                                                                                                   |
| `group`     | `children`, container layout properties.                                                                                                                                     |
| `rectangle` | `cornerRadius`.                                                                                                                                                              |
| `ellipse`   | None.                                                                                                                                                                        |
| `polygon`   | `polygonCount`: integer from `3` through `256`; defaults to `6`. The renderer draws a regular polygon fitted to the node's width and height.                                 |
| `path`      | Required `geometry`; optional `viewBox` and `fillRule`.                                                                                                                      |
| `text`      | `content`, `fontFamily`, `fontSize`, `fontWeight`, `fontStyle`, `textAlign`, `textAlignVertical`, `textGrowth`, `letterSpacing`, `lineHeight`, `underline`, `strikethrough`. |

`cornerRadius` is either one non-negative number for all corners, or four non-negative numbers in `[top-left, top-right, bottom-right, bottom-left]` order. Radii are reduced proportionally if they would not fit the rectangle.

For a path, `geometry` is non-empty SVG path data beginning with `M` or `m`. It may contain path commands and numbers only; the renderer accepts the usual move, line, horizontal/vertical, curve, arc, and close-path command letters in upper or lower case. `viewBox`, when supplied, is `[x, y, width, height]` in the path's source coordinates. Its four values must be finite and within ±`16,384`; width and height must be at least `0.001`. Without it, the path uses `[0, 0, node width, node height]`. The path is scaled into the node's dimensions. `fillRule` is `"nonzero"` or `"evenodd"` and defaults to `"nonzero"`.

Text properties have these accepted values and defaults:

- `content` is a string and defaults to the empty string.
- `fontFamily` is a string and defaults to `"sans-serif"`; `fontSize` is positive, at most `16,384`, and defaults to `16`.
- `fontWeight` is a number from `1` through `1000`, or `"normal"`, `"bold"`, `"bolder"`, `"lighter"`, or a hundred-step string such as `"600"`; it defaults to `400`.
- `fontStyle` is `"normal"`, `"italic"`, or `"oblique"`; it defaults to `"normal"`.
- `textAlign` is `"left"`, `"center"`, `"right"`, or `"justify"`; it defaults to `"left"`. Justification is accepted but uses the same start anchor as left alignment.
- `textAlignVertical` is `"top"`, `"middle"`, or `"bottom"`; it defaults to `"middle"`.
- `textGrowth` is `"auto"`, `"fixed-width"`, or `"fixed-width-height"`; it defaults to `"auto"`. The two fixed-width modes wrap text using an approximate character-width estimate. `fixed-width` can expand the text layout height; `fixed-width-height` keeps the supplied height. In `auto`, only explicit line breaks split lines.
- `lineHeight` is a positive multiplier, at most `16,384`, defaults to `1.2`, and is multiplied by `fontSize` for line spacing. The `fontSize × lineHeight` product must also be at most `16,384`. `letterSpacing` is any finite number and defaults to `0`.
- `underline` and `strikethrough` are booleans and default to `false`.

Text content and rendered wrapping are limited to 10,000 lines. Text wrapping and bounds use an approximate width estimate, so check the rendered result for long or tightly fitted copy. Font family names are emitted as SVG text attributes; the renderer does not embed a font.

## Paints and unsupported design features

`fill` and `stroke` accept either a color string or this object form:

```json
{ "type": "color", "color": "#315DEB", "enabled": true }
```

The color may be `"none"` or a hexadecimal color with 3, 6, or 8 digits after `#`. In object form, `enabled` is optional and must be boolean; `false` makes that paint invisible. No other paint-object property is accepted.

This renderer profile has no image node or image paint, and does not read local or remote image URLs. Paints are limited to one solid color per fill or stroke; gradients and shader paints are rejected. There are no effect properties such as shadows or blur. Component instances/references, imports, and document variables are not supported. Use ordinary frames, groups, shapes, paths, and text instead.

## Complete example

This operations dashboard uses absolute placement inside explicitly sized frames, nested local coordinates, a group, text, solid paints, a clipped panel, paths, a polygon, and ellipses. Its IDs are document-wide and unique.

```pencil
{
  "version": "2.21",
  "children": [
    {
      "id": "incident-overview",
      "type": "frame",
      "x": 0,
      "y": 0,
      "width": 1080,
      "height": 680,
      "layout": "none",
      "fill": "#F1F5F9",
      "children": [
        {
          "id": "top-bar",
          "type": "frame",
          "x": 0,
          "y": 0,
          "width": 1080,
          "height": 72,
          "layout": "none",
          "fill": "#FFFFFF",
          "stroke": "#DCE4EF",
          "strokeWidth": 1,
          "children": [
            {
              "id": "brand-icon",
              "type": "group",
              "x": 24,
              "y": 15,
              "width": 42,
              "height": 42,
              "children": [
                {
                  "id": "brand-mark",
                  "type": "rectangle",
                  "x": 0,
                  "y": 0,
                  "width": 42,
                  "height": 42,
                  "cornerRadius": 10,
                  "fill": "#2563EB"
                },
                {
                  "id": "brand-check",
                  "type": "path",
                  "x": 10,
                  "y": 10,
                  "width": 22,
                  "height": 22,
                  "geometry": "M0 10 L7 17 L20 0",
                  "viewBox": [0, 0, 20, 20],
                  "fill": "none",
                  "stroke": "#FFFFFF",
                  "strokeWidth": 3,
                  "strokeLinecap": "round",
                  "strokeLinejoin": "round"
                }
              ]
            },
            {
              "id": "brand-name",
              "type": "text",
              "x": 78,
              "y": 18,
              "width": 260,
              "height": 36,
              "content": "Northstar Operations",
              "fontSize": 19,
              "fontWeight": 700,
              "fill": "#0F172A"
            },
            {
              "id": "online-dot",
              "type": "ellipse",
              "x": 820,
              "y": 31,
              "width": 10,
              "height": 10,
              "fill": "#16A34A"
            },
            {
              "id": "online-label",
              "type": "text",
              "x": 838,
              "y": 24,
              "width": 170,
              "height": 24,
              "content": "ALL SYSTEMS NORMAL",
              "fontSize": 11,
              "fontWeight": 700,
              "fill": "#166534"
            },
            {
              "id": "operator-avatar",
              "type": "ellipse",
              "x": 1016,
              "y": 16,
              "width": 40,
              "height": 40,
              "fill": "#DBEAFE",
              "stroke": "#93C5FD",
              "strokeWidth": 1
            },
            {
              "id": "operator-initials",
              "type": "text",
              "x": 1016,
              "y": 16,
              "width": 40,
              "height": 40,
              "content": "EK",
              "fontSize": 13,
              "fontWeight": 700,
              "textAlign": "center",
              "textAlignVertical": "middle",
              "fill": "#1D4ED8"
            }
          ]
        },
        {
          "id": "navigation",
          "type": "frame",
          "x": 0,
          "y": 72,
          "width": 190,
          "height": 608,
          "layout": "none",
          "fill": "#FFFFFF",
          "stroke": "#DCE4EF",
          "strokeWidth": 1,
          "children": [
            {
              "id": "navigation-heading",
              "type": "text",
              "x": 20,
              "y": 22,
              "width": 145,
              "height": 20,
              "content": "WORKSPACE",
              "fontSize": 10,
              "fontWeight": 700,
              "fill": "#64748B"
            },
            {
              "id": "overview-active",
              "type": "rectangle",
              "x": 12,
              "y": 54,
              "width": 166,
              "height": 40,
              "cornerRadius": 8,
              "fill": "#EFF6FF"
            },
            {
              "id": "overview-label",
              "type": "text",
              "x": 26,
              "y": 61,
              "width": 140,
              "height": 26,
              "content": "Overview",
              "fontSize": 14,
              "fontWeight": 700,
              "fill": "#1D4ED8"
            },
            {
              "id": "services-label",
              "type": "text",
              "x": 26,
              "y": 108,
              "width": 140,
              "height": 26,
              "content": "Services",
              "fontSize": 14,
              "fill": "#475569"
            },
            {
              "id": "incidents-label",
              "type": "text",
              "x": 26,
              "y": 150,
              "width": 140,
              "height": 26,
              "content": "Incidents",
              "fontSize": 14,
              "fill": "#475569"
            },
            {
              "id": "reports-label",
              "type": "text",
              "x": 26,
              "y": 192,
              "width": 140,
              "height": 26,
              "content": "Reports",
              "fontSize": 14,
              "fill": "#475569"
            },
            {
              "id": "rotation-team",
              "type": "group",
              "x": 20,
              "y": 266,
              "width": 150,
              "height": 70,
              "children": [
                {
                  "id": "rotation-label",
                  "type": "text",
                  "x": 0,
                  "y": 0,
                  "width": 145,
                  "height": 20,
                  "content": "ON-CALL ROTATION",
                  "fontSize": 10,
                  "fontWeight": 700,
                  "fill": "#64748B"
                },
                {
                  "id": "rotation-name",
                  "type": "text",
                  "x": 0,
                  "y": 26,
                  "width": 150,
                  "height": 34,
                  "content": "Platform response team",
                  "fontSize": 12,
                  "fill": "#334155"
                }
              ]
            }
          ]
        },
        {
          "id": "dashboard-content",
          "type": "frame",
          "x": 214,
          "y": 92,
          "width": 842,
          "height": 560,
          "layout": "none",
          "children": [
            {
              "id": "page-title",
              "type": "text",
              "x": 0,
              "y": 0,
              "width": 510,
              "height": 38,
              "content": "Incident operations",
              "fontSize": 26,
              "fontWeight": 700,
              "fill": "#0F172A"
            },
            {
              "id": "page-subtitle",
              "type": "text",
              "x": 0,
              "y": 42,
              "width": 570,
              "height": 24,
              "content": "Service health and response activity for the last 24 hours",
              "fontSize": 13,
              "fill": "#64748B"
            },
            {
              "id": "range-button",
              "type": "rectangle",
              "x": 650,
              "y": 4,
              "width": 192,
              "height": 38,
              "cornerRadius": 8,
              "fill": "#FFFFFF",
              "stroke": "#CBD5E1",
              "strokeWidth": 1
            },
            {
              "id": "range-label",
              "type": "text",
              "x": 658,
              "y": 9,
              "width": 176,
              "height": 28,
              "content": "LAST 24 HOURS",
              "fontSize": 11,
              "fontWeight": 700,
              "textAlign": "center",
              "fill": "#334155"
            },
            {
              "id": "requests-card",
              "type": "frame",
              "x": 0,
              "y": 78,
              "width": 266,
              "height": 104,
              "layout": "none",
              "cornerRadius": 12,
              "fill": "#FFFFFF",
              "stroke": "#E2E8F0",
              "strokeWidth": 1,
              "children": [
                {
                  "id": "requests-label",
                  "type": "text",
                  "x": 16,
                  "y": 12,
                  "width": 220,
                  "height": 18,
                  "content": "REQUESTS PROCESSED",
                  "fontSize": 10,
                  "fontWeight": 700,
                  "fill": "#64748B"
                },
                {
                  "id": "requests-value",
                  "type": "text",
                  "x": 16,
                  "y": 32,
                  "width": 150,
                  "height": 40,
                  "content": "2.84M",
                  "fontSize": 29,
                  "fontWeight": 700,
                  "fill": "#0F172A"
                },
                {
                  "id": "requests-trend",
                  "type": "path",
                  "x": 188,
                  "y": 48,
                  "width": 58,
                  "height": 24,
                  "geometry": "M0 20 L11 14 L22 17 L34 7 L45 10 L58 0",
                  "viewBox": [0, 0, 58, 24],
                  "fill": "none",
                  "stroke": "#16A34A",
                  "strokeWidth": 2,
                  "strokeLinecap": "round",
                  "strokeLinejoin": "round"
                },
                {
                  "id": "requests-change",
                  "type": "text",
                  "x": 16,
                  "y": 78,
                  "width": 224,
                  "height": 18,
                  "content": "+8.2% vs previous day",
                  "fontSize": 11,
                  "fontWeight": 600,
                  "fill": "#15803D"
                }
              ]
            },
            {
              "id": "latency-card",
              "type": "frame",
              "x": 288,
              "y": 78,
              "width": 266,
              "height": 104,
              "layout": "none",
              "cornerRadius": 12,
              "fill": "#FFFFFF",
              "stroke": "#E2E8F0",
              "strokeWidth": 1,
              "children": [
                {
                  "id": "latency-label",
                  "type": "text",
                  "x": 16,
                  "y": 12,
                  "width": 220,
                  "height": 18,
                  "content": "P95 API LATENCY",
                  "fontSize": 10,
                  "fontWeight": 700,
                  "fill": "#64748B"
                },
                {
                  "id": "latency-value",
                  "type": "text",
                  "x": 16,
                  "y": 32,
                  "width": 220,
                  "height": 40,
                  "content": "184 ms",
                  "fontSize": 29,
                  "fontWeight": 700,
                  "fill": "#0F172A"
                },
                {
                  "id": "latency-change",
                  "type": "text",
                  "x": 16,
                  "y": 78,
                  "width": 224,
                  "height": 18,
                  "content": "12 ms faster than yesterday",
                  "fontSize": 11,
                  "fill": "#15803D"
                }
              ]
            },
            {
              "id": "availability-card",
              "type": "frame",
              "x": 576,
              "y": 78,
              "width": 266,
              "height": 104,
              "layout": "none",
              "cornerRadius": 12,
              "fill": "#FFFFFF",
              "stroke": "#E2E8F0",
              "strokeWidth": 1,
              "children": [
                {
                  "id": "availability-label",
                  "type": "text",
                  "x": 16,
                  "y": 12,
                  "width": 220,
                  "height": 18,
                  "content": "PLATFORM AVAILABILITY",
                  "fontSize": 10,
                  "fontWeight": 700,
                  "fill": "#64748B"
                },
                {
                  "id": "availability-value",
                  "type": "text",
                  "x": 16,
                  "y": 32,
                  "width": 220,
                  "height": 40,
                  "content": "99.97%",
                  "fontSize": 29,
                  "fontWeight": 700,
                  "fill": "#0F172A"
                },
                {
                  "id": "availability-change",
                  "type": "text",
                  "x": 16,
                  "y": 78,
                  "width": 224,
                  "height": 18,
                  "content": "Within monthly objective",
                  "fontSize": 11,
                  "fill": "#475569"
                }
              ]
            },
            {
              "id": "services-panel",
              "type": "frame",
              "x": 0,
              "y": 202,
              "width": 500,
              "height": 252,
              "layout": "none",
              "clip": true,
              "cornerRadius": 12,
              "fill": "#FFFFFF",
              "stroke": "#E2E8F0",
              "strokeWidth": 1,
              "children": [
                {
                  "id": "services-title",
                  "type": "text",
                  "x": 20,
                  "y": 14,
                  "width": 250,
                  "height": 26,
                  "content": "Service health",
                  "fontSize": 16,
                  "fontWeight": 700,
                  "fill": "#0F172A"
                },
                {
                  "id": "services-updated",
                  "type": "text",
                  "x": 330,
                  "y": 17,
                  "width": 150,
                  "height": 20,
                  "content": "UPDATED 09:42 UTC",
                  "fontSize": 10,
                  "textAlign": "right",
                  "fill": "#64748B"
                },
                {
                  "id": "services-rule",
                  "type": "rectangle",
                  "x": 20,
                  "y": 52,
                  "width": 460,
                  "height": 1,
                  "fill": "#E2E8F0"
                },
                {
                  "id": "service-api-name",
                  "type": "text",
                  "x": 22,
                  "y": 68,
                  "width": 250,
                  "height": 22,
                  "content": "Public API",
                  "fontSize": 13,
                  "fontWeight": 600,
                  "fill": "#1E293B"
                },
                {
                  "id": "service-api-dot",
                  "type": "ellipse",
                  "x": 346,
                  "y": 75,
                  "width": 8,
                  "height": 8,
                  "fill": "#16A34A"
                },
                {
                  "id": "service-api-state",
                  "type": "text",
                  "x": 362,
                  "y": 68,
                  "width": 112,
                  "height": 22,
                  "content": "Operational",
                  "fontSize": 12,
                  "fill": "#166534"
                },
                {
                  "id": "service-api-rule",
                  "type": "rectangle",
                  "x": 20,
                  "y": 106,
                  "width": 460,
                  "height": 1,
                  "fill": "#F1F5F9"
                },
                {
                  "id": "service-worker-name",
                  "type": "text",
                  "x": 22,
                  "y": 120,
                  "width": 250,
                  "height": 22,
                  "content": "Event worker pool",
                  "fontSize": 13,
                  "fontWeight": 600,
                  "fill": "#1E293B"
                },
                {
                  "id": "service-worker-note",
                  "type": "text",
                  "x": 22,
                  "y": 143,
                  "width": 300,
                  "height": 20,
                  "content": "Queue depth elevated; recovery in progress",
                  "fontSize": 10,
                  "fill": "#64748B"
                },
                {
                  "id": "service-worker-dot",
                  "type": "ellipse",
                  "x": 346,
                  "y": 128,
                  "width": 8,
                  "height": 8,
                  "fill": "#D97706"
                },
                {
                  "id": "service-worker-state",
                  "type": "text",
                  "x": 362,
                  "y": 121,
                  "width": 112,
                  "height": 22,
                  "content": "Degraded",
                  "fontSize": 12,
                  "fill": "#B45309"
                },
                {
                  "id": "service-worker-rule",
                  "type": "rectangle",
                  "x": 20,
                  "y": 174,
                  "width": 460,
                  "height": 1,
                  "fill": "#F1F5F9"
                },
                {
                  "id": "service-storage-name",
                  "type": "text",
                  "x": 22,
                  "y": 190,
                  "width": 250,
                  "height": 22,
                  "content": "Primary storage",
                  "fontSize": 13,
                  "fontWeight": 600,
                  "fill": "#1E293B"
                },
                {
                  "id": "service-storage-dot",
                  "type": "ellipse",
                  "x": 346,
                  "y": 197,
                  "width": 8,
                  "height": 8,
                  "fill": "#16A34A"
                },
                {
                  "id": "service-storage-state",
                  "type": "text",
                  "x": 362,
                  "y": 190,
                  "width": 112,
                  "height": 22,
                  "content": "Operational",
                  "fontSize": 12,
                  "fill": "#166534"
                }
              ]
            },
            {
              "id": "activity-panel",
              "type": "frame",
              "x": 518,
              "y": 202,
              "width": 324,
              "height": 252,
              "layout": "none",
              "cornerRadius": 12,
              "fill": "#FFFFFF",
              "stroke": "#E2E8F0",
              "strokeWidth": 1,
              "children": [
                {
                  "id": "activity-title",
                  "type": "text",
                  "x": 20,
                  "y": 14,
                  "width": 250,
                  "height": 26,
                  "content": "Response activity",
                  "fontSize": 16,
                  "fontWeight": 700,
                  "fill": "#0F172A"
                },
                {
                  "id": "activity-timeline",
                  "type": "path",
                  "x": 27,
                  "y": 68,
                  "width": 1,
                  "height": 126,
                  "geometry": "M0 0 L0 126",
                  "viewBox": [0, 0, 1, 126],
                  "fill": "none",
                  "stroke": "#CBD5E1",
                  "strokeWidth": 1
                },
                {
                  "id": "activity-dot-alert",
                  "type": "ellipse",
                  "x": 21,
                  "y": 76,
                  "width": 13,
                  "height": 13,
                  "fill": "#D97706",
                  "stroke": "#FFFFFF",
                  "strokeWidth": 2
                },
                {
                  "id": "activity-time-alert",
                  "type": "text",
                  "x": 48,
                  "y": 68,
                  "width": 250,
                  "height": 18,
                  "content": "09:18 UTC · ALERT",
                  "fontSize": 10,
                  "fontWeight": 700,
                  "fill": "#B45309"
                },
                {
                  "id": "activity-copy-alert",
                  "type": "text",
                  "x": 48,
                  "y": 90,
                  "width": 248,
                  "height": 42,
                  "content": "Queue processing latency crossed its threshold.",
                  "fontSize": 12,
                  "textGrowth": "fixed-width",
                  "fill": "#334155"
                },
                {
                  "id": "activity-dot-mitigation",
                  "type": "ellipse",
                  "x": 21,
                  "y": 148,
                  "width": 13,
                  "height": 13,
                  "fill": "#2563EB",
                  "stroke": "#FFFFFF",
                  "strokeWidth": 2
                },
                {
                  "id": "activity-time-mitigation",
                  "type": "text",
                  "x": 48,
                  "y": 140,
                  "width": 250,
                  "height": 18,
                  "content": "09:31 UTC · MITIGATION",
                  "fontSize": 10,
                  "fontWeight": 700,
                  "fill": "#1D4ED8"
                },
                {
                  "id": "activity-copy-mitigation",
                  "type": "text",
                  "x": 48,
                  "y": 162,
                  "width": 248,
                  "height": 42,
                  "content": "Worker pool scaled to reduce queue depth.",
                  "fontSize": 12,
                  "textGrowth": "fixed-width",
                  "fill": "#334155"
                }
              ]
            },
            {
              "id": "attention-banner",
              "type": "frame",
              "x": 0,
              "y": 474,
              "width": 842,
              "height": 76,
              "layout": "none",
              "cornerRadius": 12,
              "fill": "#EFF6FF",
              "stroke": "#BFDBFE",
              "strokeWidth": 1,
              "children": [
                {
                  "id": "attention-icon",
                  "type": "polygon",
                  "x": 18,
                  "y": 22,
                  "width": 28,
                  "height": 28,
                  "polygonCount": 3,
                  "fill": "#F59E0B"
                },
                {
                  "id": "attention-title",
                  "type": "text",
                  "x": 60,
                  "y": 12,
                  "width": 560,
                  "height": 24,
                  "content": "One service needs attention",
                  "fontSize": 14,
                  "fontWeight": 700,
                  "fill": "#1E3A8A"
                },
                {
                  "id": "attention-copy",
                  "type": "text",
                  "x": 60,
                  "y": 38,
                  "width": 575,
                  "height": 24,
                  "content": "A delayed queue is being monitored by the response team.",
                  "fontSize": 12,
                  "fill": "#1E40AF"
                },
                {
                  "id": "attention-action",
                  "type": "rectangle",
                  "x": 676,
                  "y": 19,
                  "width": 148,
                  "height": 38,
                  "cornerRadius": 8,
                  "fill": "#FFFFFF",
                  "stroke": "#93C5FD",
                  "strokeWidth": 1
                },
                {
                  "id": "attention-action-label",
                  "type": "text",
                  "x": 684,
                  "y": 24,
                  "width": 132,
                  "height": 28,
                  "content": "Open incident",
                  "fontSize": 12,
                  "fontWeight": 700,
                  "textAlign": "center",
                  "fill": "#1D4ED8"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

## Common mistakes

- Omitting `version`, `children`, an ID, or the type's required path geometry.
- Giving a shape or text node only one dimension, or using zero/negative `width` or `height`.
- Reusing an ID, putting `/` in an ID, attaching `children` to a non-container, or placing a property on the wrong node type.
- Expecting child `x`/`y` to control their positions in a horizontal or vertical flow container.
- Using a trailing comma, duplicate JSON key, unsupported root field, or extra node property.
- Supplying a URL, image, gradient, variable, component reference, shadow, or another effect as though it were a supported paint or node feature.
- Assuming text wraps exactly like a browser's font metrics; wrapping is approximate, so leave room and inspect the rendered result.

## Design guidance and official reference

For an embedded blueprint4llm drawing, start with a page-sized frame, then divide it into meaningful child frames (header, navigation, content panels) and use either absolute placement or the supported simple flow layout. Use groups where related vector pieces should be organized together. Keep spacing and colors systematic; use text labels alongside status colors; draw small icons with basic shapes or path data. Prefer short copy and generous text boxes because wrapping is estimated rather than measured with actual font metrics.

If reusing a native Pencil component, variable, theme, imported asset, or advanced paint, first flatten it into ordinary supported nodes and literal solid colors; otherwise validation will reject it or the renderer will not have the external information needed to draw it. Keep any upstream-only metadata out of the embedded JSONC instead of assuming unknown fields are ignored.

Official reference: [The .pen Format](https://docs.pencil.dev/for-developers/the-pen-format) (upstream document model and schema). Reviewed **2026-10-26**. The upstream page describes the broader native format; the compatibility table and property details in this guide describe the blueprint4llm renderer only.
