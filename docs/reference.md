# Format reference

## Excalidraw

Use an `excalidraw` fence for one complete JSON scene saved as an `.excalidraw` file. The root
`type` must be `excalidraw`, and the root `version` must be `2`. The renderer rejects clipboard
payloads and other root schema versions. Element-level `version` values are metadata and do not
select the document schema.

````markdown
```excalidraw
{
  "type": "excalidraw",
  "version": 2,
  "elements": [
    { "id": "service", "type": "rectangle", "x": 0, "y": 0, "width": 140, "height": 72 },
    {
      "id": "flow", "type": "arrow", "x": 140, "y": 36, "width": 120, "height": 0,
      "points": [[0, 0], [120, 0]], "startArrowhead": null, "endArrowhead": "arrow"
    }
  ],
  "appState": { "viewBackgroundColor": "#ffffff" },
  "files": {}
}
```
````

Supported elements are `rectangle`, `ellipse`, `diamond`, `text`, `line`, and ordinary `arrow`.
The renderer preserves source coordinates, sizes, rotation, array order, group IDs, polyline points,
and text line breaks. It does not apply group transforms or calculate new arrow routes from bindings.
Each text element is drawn once at its saved position. A bound label is not duplicated from its
container's `boundElements` list.

The renderer outputs static SVG. It accepts `#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`, and `transparent`
colors; `solid`, `dashed`, or `dotted` strokes; and `solid` fills. Other Excalidraw fill styles are
shown as solid fills with a warning. Nonzero roughness is drawn with smooth outlines, and roundness
is drawn with sharp corners. `arrow` and `triangle` arrowheads are supported; other non-null
arrowheads use an arrow shape with a warning. Broken bindings retain their stored coordinates and
produce a warning.

Images, freedraw paths, frames, magic frames, iframes, embeddables, unknown element types, and elbowed
arrows are shown as labeled placeholders. Frame children keep scene coordinates; frames do not clip
their contents. Links never become active SVG links, and link targets are omitted from output.
`files` contents are not decoded or fetched. The renderer does not support clipboard JSON,
`.excalidrawlib` files, scene URLs, or scenes embedded in PNG or SVG files.

Text uses `sans-serif` in browser output and the existing Noto Sans font when printed to PDF.
Original Excalidraw fonts and exact label widths are not guaranteed. Colors do not change with the
document's light or dark theme. PDF uses the shared 220 mm maximum diagram height and does not split a
scene across pages. SVG, PNG, and JPEG use the existing image export limits.

Limits per block: 1 MiB UTF-8 source, 3,000 elements including deleted elements, 100 JSON nesting
levels, 10,000 points per element, 100,000 points per scene, 100 group IDs per element, coordinate
and dimension magnitudes up to 1,000,000, font size 1–512, line height 0.5–4, stroke width 0–100,
and 4 MiB output SVG. Negative coordinates and zero dimensions are accepted. A scene with no visible
elements produces a small placeholder SVG and a warning.

```

```
