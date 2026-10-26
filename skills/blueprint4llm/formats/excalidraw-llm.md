# Excalidraw JSON for blueprint4llm

Write one strict JSON scene inside a Markdown fence whose language is `excalidraw`. The current renderer reads an Excalidraw file-scene envelope at document version 2 and emits static SVG. This is a renderer profile: it draws a small set of shapes and keeps each element's saved geometry; it does not run Excalidraw's editor or layout engine.

````markdown
```excalidraw
{"type":"excalidraw","version":2,"elements":[]}
```
````

## Scene envelope

The JSON root must be an object with:

- `type`: exactly `"excalidraw"`. Clipboard payloads such as `"excalidraw/clipboard"` are rejected.
- `version`: the number `2`. This is the document version; an element's own `version` field does not change it.
- `elements`: an array, including when the scene is empty.

Optional `appState.viewBackgroundColor` sets the scene background. It must be `"transparent"` or a hexadecimal color; when omitted the renderer uses white. If `appState` is supplied, it must be an object. Optional `files` must also be an object, but file payloads are not drawn or copied into the SVG. Other editor state is not needed to construct the scene.

Use strict JSON: no comments, trailing commas, or duplicate object keys. The source limit is 1 MiB, the nesting limit is 100, and a scene may contain at most 3,000 elements. A scene with no visible elements is accepted with a warning and renders as a small empty-scene placeholder.

## Elements and coordinates

Every element needs these fields:

| Field             | Requirement                                                                        |
| ----------------- | ---------------------------------------------------------------------------------- |
| `id`              | Non-empty string, unique across the scene.                                         |
| `type`            | Non-empty string. Only six types draw as shapes; other values become placeholders. |
| `x`, `y`          | Finite numbers from -1,000,000 to 1,000,000.                                       |
| `width`, `height` | Finite numbers from 0 to 1,000,000. Include these even for lines and arrows.       |

The renderer preserves element array order when painting. For rectangles, ellipses, diamonds, and text, `x` and `y` locate the element and `width` and `height` give its box. A line or arrow's `points` are coordinate pairs local to its element: the renderer adds `x` and `y` to each `[dx, dy]`. The `width` and `height` are still required for the input profile; the path itself comes from `points`.

`angle` is optional, defaults to `0`, and is in radians. A nonzero angle rotates around the center of the element's `x`/`y`/`width`/`height` box. Keep it at zero unless that rotation is intended.

The SVG view box is calculated from visible geometry and includes padding. Deleted elements (`isDeleted: true`) are omitted from the drawing and its bounds. The renderer doesn't create a fixed page size from editor zoom or scroll state.

## Supported drawing types

- `rectangle`, `ellipse`, and `diamond` draw their respective outline shapes.
- `text` draws text at its saved position.
- `line` draws a path without arrowheads unless arrowhead fields are supplied.
- `arrow` draws a path and can draw arrowheads.

Both `line` and `arrow` require `points`: an array of at least two `[x, y]` numeric pairs. Each coordinate must be finite and within ±1,000,000. Each element can have up to 10,000 points and the scene up to 100,000 total points. A repeated or identical point sequence is valid, but a path with all points identical is drawn as a dot and has no arrowhead.

For arrowheads, use `startArrowhead` and/or `endArrowhead` with `"arrow"` or `"triangle"`, or `null` for no head. Other nonempty strings are accepted but rendered as the `"arrow"` style with a warning. `elbowed` defaults to `false`; an arrow with `elbowed: true` is shown as a placeholder because elbow routing is not drawn.

## Groups, text containers, and bindings

`groupIds` is optional and defaults to `[]`. When present, it must be an array of non-empty strings, with no more than 100 IDs on one element. The renderer preserves the IDs as element metadata; groups do not create visible frames or change layout.

A text label is a separate `type: "text"` element. Give it its own `x`, `y`, `width`, and `height`; set `containerId` to the owning shape's ID, and list the label in that shape's `boundElements` array. `containerId` is a non-empty ID string or `null`. Each `boundElements` entry must be an object with a string `id`; the usual `type` value can be included as metadata. These references associate the elements, but text is rendered at its own saved geometry: it is not automatically fitted, wrapped, or moved with its container. Insert explicit newline characters in `text` for line breaks.

An ordinary arrow may refer to endpoint elements with `startBinding` and `endBinding`, each either `null` or an object containing a string `elementId`. These references are checked for missing or deleted targets and cause warnings if unresolved. The renderer still follows the arrow's explicit `points`; bindings do not recalculate endpoints, clip the path to a shape, or route it around other elements. For a connected scene, use an existing, non-deleted endpoint ID and keep the arrow's saved points visually aligned with the target shapes. `frameId` is also accepted as a nullable element ID and checked as a reference, but frame clipping is not implemented.

## Text and visual fields

`text` is required and must be a string for a text element. Text is emitted one saved line per line, with no automatic wrapping. Its useful optional fields are:

- `fontSize`: 1–512, default `20`.
- `lineHeight`: 0.5–4, default `1.25`; it multiplies `fontSize` to space explicit lines.
- `textAlign`: `"left"`, `"center"`, or `"right"`, default `"left"`; alignment uses the text element's width.
- `fontFamily`: integer 1–4, default `1`. The static SVG uses sans-serif; values other than `2` produce a warning that the family was replaced.

For other elements, omitted visual values use these defaults: `strokeColor` `"#1e1e1e"`, `backgroundColor` `"transparent"`, `strokeWidth` `1`, `strokeStyle` `"solid"`, `fillStyle` `"solid"`, `opacity` `100`, `roughness` `0`, `angle` `0`, and `isDeleted` `false`. Stroke and background colors accept `"transparent"` or 3-, 4-, 6-, or 8-digit hexadecimal colors. `strokeWidth` is 0–100; `strokeStyle` is `"solid"`, `"dashed"`, or `"dotted"`; opacity is a percentage from 0 to 100.

`fillStyle` accepts `"solid"`, `"hachure"`, `"cross-hatch"`, and `"zigzag"`, but the SVG renderer draws a solid fill and warns for non-solid styles. `roughness` accepts only 0, 1, or 2; nonzero values render with a smooth outline and produce a warning. `roundness` may be omitted, `null`, or an object; a non-null object is accepted but drawn with sharp corners and a warning. `link` may be a string or `null`, but links are not active in the SVG and produce a warning when nonempty. For text, `strokeColor` is the text color and a non-transparent `backgroundColor` draws a box behind the text.

## Unsupported items and warnings

Only `rectangle`, `ellipse`, `diamond`, `text`, `line`, and ordinary non-elbow `arrow` elements have direct drawing support. Any other element type is accepted if it has valid common fields, then displayed as a labeled placeholder; this includes image, frame, `magicframe`, and free-draw elements. Frames do not clip their contents. Element data such as image files, links, or editor-only properties does not become active content in the output.

Warnings do not necessarily mean the JSON is invalid. Expect warnings for unsupported element types, elbow arrows, unresolved element references, non-solid fills, nonzero roughness, non-null roundness, non-default text font families, inactive links, and empty scenes. Keep references pointed at existing, non-deleted IDs to avoid reference warnings. JSON syntax errors, duplicate IDs, missing required fields, invalid value types, and values outside the stated ranges are errors.

## Complete scene example

This order-checkout diagram shows a storefront request, API and order services, payment authorization, an inventory decision, an event bus, fulfilment, and a manual-review branch. Labels use text containers; arrows carry endpoint bindings and explicit points. The elements use the supported profile and should validate without renderer warnings.

```excalidraw
{
  "type": "excalidraw",
  "version": 2,
  "appState": { "viewBackgroundColor": "#f8fafc" },
  "elements": [
    {
      "id": "title",
      "type": "text",
      "x": 40, "y": 32, "width": 900, "height": 28,
      "text": "Checkout: authorize, reserve, publish, fulfil",
      "fontSize": 22, "lineHeight": 1.25, "fontFamily": 2,
      "textAlign": "left", "strokeColor": "#0f172a"
    },
    {
      "id": "storefront",
      "type": "rectangle",
      "x": 40, "y": 120, "width": 160, "height": 80,
      "strokeColor": "#2563eb", "backgroundColor": "#dbeafe", "strokeWidth": 2,
      "groupIds": ["client"],
      "boundElements": [
        { "id": "storefront-label", "type": "text" },
        { "id": "request-arrow", "type": "arrow" }
      ]
    },
    {
      "id": "storefront-label",
      "type": "text",
      "x": 52, "y": 140, "width": 136, "height": 44,
      "text": "Web storefront\nCustomer checkout",
      "fontSize": 15, "lineHeight": 1.35, "fontFamily": 2,
      "textAlign": "center", "strokeColor": "#172554",
      "groupIds": ["client"], "containerId": "storefront"
    },
    {
      "id": "api",
      "type": "rectangle",
      "x": 300, "y": 120, "width": 170, "height": 80,
      "strokeColor": "#0f766e", "backgroundColor": "#ccfbf1", "strokeWidth": 2,
      "groupIds": ["edge"],
      "boundElements": [
        { "id": "api-label", "type": "text" },
        { "id": "request-arrow", "type": "arrow" },
        { "id": "route-arrow", "type": "arrow" }
      ]
    },
    {
      "id": "api-label",
      "type": "text",
      "x": 312, "y": 140, "width": 146, "height": 44,
      "text": "Checkout API\nValidate request",
      "fontSize": 15, "lineHeight": 1.35, "fontFamily": 2,
      "textAlign": "center", "strokeColor": "#134e4a",
      "groupIds": ["edge"], "containerId": "api"
    },
    {
      "id": "order-service",
      "type": "rectangle",
      "x": 570, "y": 120, "width": 170, "height": 80,
      "strokeColor": "#7c3aed", "backgroundColor": "#ede9fe", "strokeWidth": 2,
      "groupIds": ["commerce"],
      "boundElements": [
        { "id": "order-label", "type": "text" },
        { "id": "route-arrow", "type": "arrow" },
        { "id": "charge-arrow", "type": "arrow" },
        { "id": "stock-arrow", "type": "arrow" }
      ]
    },
    {
      "id": "order-label",
      "type": "text",
      "x": 582, "y": 140, "width": 146, "height": 44,
      "text": "Order service\nCreate pending order",
      "fontSize": 15, "lineHeight": 1.35, "fontFamily": 2,
      "textAlign": "center", "strokeColor": "#3b0764",
      "groupIds": ["commerce"], "containerId": "order-service"
    },
    {
      "id": "payment-provider",
      "type": "ellipse",
      "x": 850, "y": 120, "width": 180, "height": 80,
      "strokeColor": "#c2410c", "backgroundColor": "#ffedd5", "strokeWidth": 2,
      "groupIds": ["payments"],
      "boundElements": [
        { "id": "payment-label", "type": "text" },
        { "id": "charge-arrow", "type": "arrow" }
      ]
    },
    {
      "id": "payment-label",
      "type": "text",
      "x": 862, "y": 140, "width": 156, "height": 44,
      "text": "Payment provider\nAuthorize card",
      "fontSize": 15, "lineHeight": 1.35, "fontFamily": 2,
      "textAlign": "center", "strokeColor": "#7c2d12",
      "groupIds": ["payments"], "containerId": "payment-provider"
    },
    {
      "id": "inventory-service",
      "type": "rectangle",
      "x": 570, "y": 290, "width": 170, "height": 80,
      "strokeColor": "#15803d", "backgroundColor": "#dcfce7", "strokeWidth": 2,
      "groupIds": ["commerce"],
      "boundElements": [
        { "id": "inventory-label", "type": "text" },
        { "id": "stock-arrow", "type": "arrow" },
        { "id": "decision-arrow", "type": "arrow" }
      ]
    },
    {
      "id": "inventory-label",
      "type": "text",
      "x": 582, "y": 310, "width": 146, "height": 44,
      "text": "Inventory service\nReserve stock",
      "fontSize": 15, "lineHeight": 1.35, "fontFamily": 2,
      "textAlign": "center", "strokeColor": "#14532d",
      "groupIds": ["commerce"], "containerId": "inventory-service"
    },
    {
      "id": "availability",
      "type": "diamond",
      "x": 570, "y": 450, "width": 170, "height": 90,
      "strokeColor": "#a16207", "backgroundColor": "#fef3c7", "strokeWidth": 2,
      "groupIds": ["commerce"],
      "boundElements": [
        { "id": "availability-label", "type": "text" },
        { "id": "reserve-arrow", "type": "arrow" },
        { "id": "manual-arrow", "type": "arrow" }
      ]
    },
    {
      "id": "availability-label",
      "type": "text",
      "x": 580, "y": 473, "width": 150, "height": 44,
      "text": "Stock\navailable?",
      "fontSize": 14, "lineHeight": 1.25, "fontFamily": 2,
      "textAlign": "center", "strokeColor": "#713f12",
      "groupIds": ["commerce"], "containerId": "availability"
    },
    {
      "id": "event-bus",
      "type": "rectangle",
      "x": 850, "y": 450, "width": 170, "height": 80,
      "strokeColor": "#0369a1", "backgroundColor": "#e0f2fe", "strokeWidth": 2,
      "groupIds": ["events"],
      "boundElements": [
        { "id": "event-label", "type": "text" },
        { "id": "reserve-arrow", "type": "arrow" },
        { "id": "fulfilment-arrow", "type": "arrow" }
      ]
    },
    {
      "id": "event-label",
      "type": "text",
      "x": 862, "y": 470, "width": 146, "height": 44,
      "text": "Order event bus\nPublish reserved",
      "fontSize": 15, "lineHeight": 1.35, "fontFamily": 2,
      "textAlign": "center", "strokeColor": "#0c4a6e",
      "groupIds": ["events"], "containerId": "event-bus"
    },
    {
      "id": "fulfilment",
      "type": "rectangle",
      "x": 1100, "y": 450, "width": 180, "height": 80,
      "strokeColor": "#be123c", "backgroundColor": "#ffe4e6", "strokeWidth": 2,
      "groupIds": ["fulfilment"],
      "boundElements": [
        { "id": "fulfilment-label", "type": "text" },
        { "id": "fulfilment-arrow", "type": "arrow" },
        { "id": "notification-arrow", "type": "arrow" }
      ]
    },
    {
      "id": "fulfilment-label",
      "type": "text",
      "x": 1115, "y": 470, "width": 150, "height": 44,
      "text": "Fulfilment worker\nPick and dispatch",
      "fontSize": 15, "lineHeight": 1.35, "fontFamily": 2,
      "textAlign": "center", "strokeColor": "#881337",
      "groupIds": ["fulfilment"], "containerId": "fulfilment"
    },
    {
      "id": "notification",
      "type": "rectangle",
      "x": 1100, "y": 600, "width": 180, "height": 80,
      "strokeColor": "#475569", "backgroundColor": "#e2e8f0", "strokeWidth": 2,
      "groupIds": ["fulfilment"],
      "boundElements": [{ "id": "notification-label", "type": "text" }]
    },
    {
      "id": "notification-label",
      "type": "text",
      "x": 1115, "y": 620, "width": 150, "height": 44,
      "text": "Notification service\nSend dispatch update",
      "fontSize": 15, "lineHeight": 1.35, "fontFamily": 2,
      "textAlign": "center", "strokeColor": "#1e293b",
      "groupIds": ["fulfilment"], "containerId": "notification"
    },
    {
      "id": "manual-review",
      "type": "rectangle",
      "x": 570, "y": 650, "width": 170, "height": 72,
      "strokeColor": "#64748b", "backgroundColor": "#f1f5f9", "strokeWidth": 2,
      "groupIds": ["commerce"],
      "boundElements": [
        { "id": "review-label", "type": "text" },
        { "id": "manual-arrow", "type": "arrow" }
      ]
    },
    {
      "id": "review-label",
      "type": "text",
      "x": 582, "y": 664, "width": 146, "height": 44,
      "text": "Manual review\nNotify customer",
      "fontSize": 15, "lineHeight": 1.35, "fontFamily": 2,
      "textAlign": "center", "strokeColor": "#334155",
      "groupIds": ["commerce"], "containerId": "manual-review"
    },
    {
      "id": "request-arrow",
      "type": "arrow",
      "x": 200, "y": 160, "width": 100, "height": 0,
      "points": [[0, 0], [100, 0]], "strokeColor": "#334155", "strokeWidth": 2,
      "endArrowhead": "arrow",
      "startBinding": { "elementId": "storefront" },
      "endBinding": { "elementId": "api" }
    },
    {
      "id": "route-arrow",
      "type": "arrow",
      "x": 470, "y": 160, "width": 100, "height": 0,
      "points": [[0, 0], [100, 0]], "strokeColor": "#334155", "strokeWidth": 2,
      "endArrowhead": "arrow",
      "startBinding": { "elementId": "api" },
      "endBinding": { "elementId": "order-service" }
    },
    {
      "id": "charge-arrow",
      "type": "arrow",
      "x": 740, "y": 160, "width": 110, "height": 0,
      "points": [[0, 0], [110, 0]], "strokeColor": "#c2410c", "strokeWidth": 2,
      "endArrowhead": "triangle",
      "startBinding": { "elementId": "order-service" },
      "endBinding": { "elementId": "payment-provider" }
    },
    {
      "id": "stock-arrow",
      "type": "arrow",
      "x": 655, "y": 200, "width": 0, "height": 90,
      "points": [[0, 0], [0, 90]], "strokeColor": "#15803d", "strokeWidth": 2,
      "endArrowhead": "arrow",
      "startBinding": { "elementId": "order-service" },
      "endBinding": { "elementId": "inventory-service" }
    },
    {
      "id": "decision-arrow",
      "type": "arrow",
      "x": 655, "y": 370, "width": 0, "height": 80,
      "points": [[0, 0], [0, 80]], "strokeColor": "#15803d", "strokeWidth": 2,
      "endArrowhead": "arrow",
      "startBinding": { "elementId": "inventory-service" },
      "endBinding": { "elementId": "availability" }
    },
    {
      "id": "reserve-arrow",
      "type": "arrow",
      "x": 740, "y": 495, "width": 110, "height": 5,
      "points": [[0, 0], [110, -5]], "strokeColor": "#0369a1", "strokeWidth": 2,
      "endArrowhead": "triangle",
      "startBinding": { "elementId": "availability" },
      "endBinding": { "elementId": "event-bus" }
    },
    {
      "id": "yes-label",
      "type": "text",
      "x": 780, "y": 462, "width": 42, "height": 18,
      "text": "YES", "fontSize": 12, "fontFamily": 2,
      "textAlign": "center", "strokeColor": "#0369a1"
    },
    {
      "id": "manual-arrow",
      "type": "arrow",
      "x": 655, "y": 540, "width": 0, "height": 110,
      "points": [[0, 0], [0, 110]], "strokeColor": "#64748b", "strokeWidth": 2,
      "endArrowhead": "arrow",
      "startBinding": { "elementId": "availability" },
      "endBinding": { "elementId": "manual-review" }
    },
    {
      "id": "no-label",
      "type": "text",
      "x": 666, "y": 582, "width": 34, "height": 18,
      "text": "NO", "fontSize": 12, "fontFamily": 2,
      "textAlign": "left", "strokeColor": "#475569"
    },
    {
      "id": "fulfilment-arrow",
      "type": "arrow",
      "x": 1020, "y": 490, "width": 80, "height": 0,
      "points": [[0, 0], [80, 0]], "strokeColor": "#be123c", "strokeWidth": 2,
      "endArrowhead": "arrow",
      "startBinding": { "elementId": "event-bus" },
      "endBinding": { "elementId": "fulfilment" }
    },
    {
      "id": "notification-arrow",
      "type": "arrow",
      "x": 1190, "y": 530, "width": 0, "height": 70,
      "points": [[0, 0], [0, 70]], "strokeColor": "#475569", "strokeWidth": 2,
      "endArrowhead": "arrow",
      "startBinding": { "elementId": "fulfilment" },
      "endBinding": { "elementId": "notification" }
    }
  ]
}
```
