# draw.io / diagrams.net

There are two formats to keep distinct:

- **Native draw.io files** are editable diagrams, usually XML (`.drawio` / `.xml`) with pages, mxGraph cells, geometry, and style strings.
- **blueprint4llm's `drawio` fence** accepts this project's small, custom structural JSON graph. It is not native draw.io XML, a native JSON export, or an import/export bridge. The local renderer validates that JSON, computes a layout, and emits SVG; it does not load a drawing into draw.io.

## Native draw.io file model (upstream)

A native file normally has an `<mxfile>` root, one `<diagram>` element per page, and an `<mxGraphModel>` for each page. The model contains a `<root>` with a flat list of `<mxCell>` elements: the conventional `id="0"` root cell and `id="1" parent="0"` default layer are followed by cells. Cell containment is expressed with `parent` IDs, not by nesting the XML elements. A page may store its model as compressed text instead of a literal `<mxGraphModel>`; a bare `<mxGraphModel>` is also accepted by draw.io when opened or imported.

A cell with `vertex="1"` is a shape; one with `edge="1"` is a connector. Edges usually name `source` and `target` cell IDs. Vertex geometry is stored in a child `<mxGeometry>` (`x`, `y`, `width`, `height`), with positions relative to the parent. Edge geometry is usually `relative="1"` and can hold route waypoints or terminal points; style keys can tune the connection points and routing. A vertex used as a container can parent other cells, whose geometry is relative to it. Layers provide separate logical/visibility groups.

Labels are in the cell's `value` attribute. By default they are text; styles with `html=1` enable HTML label content (which still must be XML-escaped in the file). A cell's `style` is a semicolon-delimited list of `key=value` settings, for example shape, fill, stroke, text, and edge-routing options. Native draw.io therefore carries both explicit geometry and detailed appearance, unlike the local format below.

### Small native XML example (upstream draw.io, not a blueprint4llm fence)

This example shows the native wrapper, default layer, two vertices with geometry, and an edge referencing them. It is illustrative XML; do not put it in a `drawio`/`draw.io` code fence for this project.

```xml
<mxfile>
  <diagram id="page-1" name="Request flow">
    <mxGraphModel>
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="2" value="Client" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;" vertex="1" parent="1">
          <mxGeometry x="80" y="80" width="120" height="60" as="geometry" />
        </mxCell>
        <mxCell id="3" value="API" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;" vertex="1" parent="1">
          <mxGeometry x="300" y="80" width="120" height="60" as="geometry" />
        </mxCell>
        <mxCell id="4" value="request" style="edgeStyle=orthogonalEdgeStyle;endArrow=classic;html=1;" edge="1" parent="1" source="2" target="3">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

### Native authoring choices

- Prefer readable, uncompressed XML when generating or reviewing files; compression is an optional storage representation, not a different graph model. Keep page and cell IDs unique in their respective scopes and preserve the conventional root and default-layer cells.
- Use parent/container relationships when containment is meaningful; use layers for independently organized or hidden content. Store coordinates and sizes in geometry when the diagram must retain a deliberate hand-arranged layout. Use style strings for visual shape, text, and connector choices rather than encoding those choices in labels.
- Choose a native `.drawio` file when the result must be opened and edited with exact coordinates, arbitrary native shapes/styles, multiple editable pages/layers, or richer native metadata. Choose the blueprint4llm structural profile when authoring a compact graph in Markdown and letting this project lay it out as a static SVG. The local format cannot preserve native editor data or reproduce a native file.

## blueprint4llm compatibility profile

The project has no draw.io runtime dependency, so there is no upstream draw.io library version pinned here. This profile is defined by the repository-local parser, layout, and SVG renderer cited below.

Use a `drawio` or `draw.io` fenced code block for the project's structural JSON graph. The body must be JSON in the schema below—not native `<mxfile>` XML. Native `mxCell` fields such as `value`, `style`, `vertex`, `edge`, `mxGeometry`, coordinates, and editor metadata are not interpreted. Unknown JSON properties are discarded during normalization. This adapter is implemented locally; it does not use draw.io's XML parser or native renderer.

The fence info string may include `page=<id>` and `direction=TB` or `direction=LR`, separated by spaces. Use each option at most once; direction values are uppercase, and `direction=TB` is the default. A document with exactly one page needs no page option; when the JSON has multiple pages, set `page=<id>` to choose one. Page selection is exact and the id must exist.

## JSON structure

The root must be an object with:

- `version`: a non-empty string. The renderer retains it but does not interpret its format.
- `pages`: a non-empty array, with at most 100 page objects.

Each page has a unique non-empty `id`, an optional string `name`, and a `cells` array. If `name` is omitted, the page id is used as its name; the resulting name is the SVG title. Each page may have up to 10,000 cells. An empty `cells` array is allowed.

Every cell has a non-empty `id` unique within its page and a `type` of `layer`, `group`, `node`, or `edge`. `label` is optional, but if present it must be a string. Missing labels default to the id for nodes and groups, and to an empty string for layers and edges. Parent ids and edge endpoints must also be non-empty strings.

| Cell type | Required fields                            | Parent and rendering behavior                                                                                                                       |
| --------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `layer`   | `id`, `type`                               | `parent` is optional. A layer is a structural container and is not drawn.                                                                           |
| `group`   | `id`, `type`, `parent`                     | Parent it to a layer or another group. It encloses its child groups and nodes.                                                                      |
| `node`    | `id`, `type`, `parent`                     | Parent it to a layer or group. It is drawn as a labeled box.                                                                                        |
| `edge`    | `id`, `type`, `parent`, `source`, `target` | Parent it directly to a layer or group. `source` and `target` must identify nodes or groups; the edge is drawn with an arrow from source to target. |

Parents and edge endpoints must refer to cells on the same page. Parent cycles are rejected. For a renderable hierarchy, nodes and groups are children of a group or layer; edges have a group or layer as their direct parent. Nested groups are supported. Layers may be parentless or nested under layers or groups; they are transparent to layout. A node or group cannot be used as an edge's parent. An edge's parent does not have to contain its endpoints: the renderer derives layout scope from the endpoint groups.

The renderer keeps only the structural fields above. Other JSON properties, including native drawing data, explicit coordinates, shape styles, and HTML fields, do not control the result. Labels are plain text, escaped for SVG; they are not rich text or HTML.

## Layout behavior and limits

Edges define directed relationships for automatic ranking. With `direction=TB`, ranks progress top to bottom; with `direction=LR`, ranks progress left to right. Connected items are arranged from their edges, while items without a relationship start at the first rank. Items sharing a rank are laid out beside one another. Nested groups are laid out as containers, and layers are structural containers rather than drawable items. The renderer chooses spacing, box sizes, edge paths, and arrowheads; it does not expose coordinates or custom styling. Directed cycles are permitted and their members are placed within the same rank. Self-edges are drawn as loops.

The renderer wraps long labels automatically. Keep graphs reasonably sized: input is limited to 1 MiB, each page to 10,000 cells, and the document to 100 pages. Layout also has a five-second time limit, a 16,384-pixel maximum per SVG side, a 4 MiB SVG output limit, a 256-line label limit, and a nesting limit of 100 for groups or layers.

## Complete example

This parcel-order flow shows checkout, payment authorization, warehouse work, tracking, and customer updates. Its single page is selected explicitly, and its ranks run from left to right.

```drawio page=parcel direction=LR
{
  "version": "1.0",
  "pages": [
    {
      "id": "parcel",
      "name": "Parcel order lifecycle",
      "cells": [
        { "id": "main-layer", "type": "layer", "label": "" },
        { "id": "checkout", "type": "group", "parent": "main-layer", "label": "Checkout and order API" },
        { "id": "storefront", "type": "node", "parent": "checkout", "label": "Storefront UI\nCustomer checkout" },
        { "id": "orders", "type": "node", "parent": "checkout", "label": "Order API\nValidates cart, price, and address" },
        { "id": "payment", "type": "group", "parent": "main-layer", "label": "Payment authorization" },
        { "id": "risk", "type": "node", "parent": "payment", "label": "Risk review\nRules and velocity checks" },
        { "id": "gateway", "type": "node", "parent": "payment", "label": "Payment gateway" },
        { "id": "issuer", "type": "node", "parent": "payment", "label": "Card issuer" },
        { "id": "ledger", "type": "node", "parent": "payment", "label": "Payment ledger\nRecords authorization" },
        { "id": "fulfillment", "type": "group", "parent": "main-layer", "label": "Inventory and fulfillment" },
        { "id": "inventory", "type": "node", "parent": "fulfillment", "label": "Inventory service\nReserves stock" },
        { "id": "warehouse", "type": "group", "parent": "fulfillment", "label": "Warehouse execution" },
        { "id": "pick-pack", "type": "node", "parent": "warehouse", "label": "Pick and pack\nPrepares parcel" },
        { "id": "carrier", "type": "node", "parent": "warehouse", "label": "Carrier labels\nBooks shipment" },
        { "id": "tracking", "type": "node", "parent": "fulfillment", "label": "Tracking service\nCollects carrier scans" },
        { "id": "updates", "type": "group", "parent": "main-layer", "label": "Customer updates" },
        { "id": "events", "type": "node", "parent": "updates", "label": "Order event stream" },
        { "id": "email", "type": "node", "parent": "updates", "label": "Email service\nSends order notices" },
        { "id": "portal", "type": "node", "parent": "updates", "label": "Order portal\nShows current status" },
        { "id": "submit", "type": "edge", "parent": "main-layer", "source": "storefront", "target": "orders", "label": "submit order" },
        { "id": "authorize", "type": "edge", "parent": "main-layer", "source": "orders", "target": "risk", "label": "authorize payment" },
        { "id": "approve", "type": "edge", "parent": "main-layer", "source": "risk", "target": "gateway", "label": "approved" },
        { "id": "request-auth", "type": "edge", "parent": "main-layer", "source": "gateway", "target": "issuer", "label": "authorization request" },
        { "id": "record-auth", "type": "edge", "parent": "main-layer", "source": "issuer", "target": "ledger", "label": "approved authorization" },
        { "id": "paid-order", "type": "edge", "parent": "main-layer", "source": "ledger", "target": "inventory", "label": "paid order" },
        { "id": "reserve-stock", "type": "edge", "parent": "main-layer", "source": "inventory", "target": "pick-pack", "label": "stock reserved" },
        { "id": "pack-parcel", "type": "edge", "parent": "main-layer", "source": "pick-pack", "target": "carrier", "label": "parcel packed" },
        { "id": "scan-parcel", "type": "edge", "parent": "main-layer", "source": "carrier", "target": "tracking", "label": "label and scan events" },
        { "id": "order-event", "type": "edge", "parent": "main-layer", "source": "orders", "target": "events", "label": "order accepted" },
        { "id": "tracking-event", "type": "edge", "parent": "main-layer", "source": "tracking", "target": "events", "label": "shipment updates" },
        { "id": "notify-email", "type": "edge", "parent": "main-layer", "source": "events", "target": "email", "label": "send notice" },
        { "id": "refresh-portal", "type": "edge", "parent": "main-layer", "source": "events", "target": "portal", "label": "refresh status" }
      ]
    }
  ]
}
```

## Validation, sources, and review

For the **blueprint4llm structural JSON** example, run:

```sh
blueprint4llm skills/blueprint4llm/formats/drawio-llm.md --check
```

This checks the Markdown fences using this project's JSON parser and layout/render path; it does not validate native draw.io XML. Validate a native file by opening it in draw.io, and consult the official generation guide's XML schema and style-reference guidance when producing native files. Local profile details in this guide are based on `src/renderers/drawio-json.ts`, `src/renderers/drawio-layout.ts`, `src/renderers/drawio-rank.ts`, `src/renderers/drawio-svg.ts`, `src/renderers/drawio.ts`, and `tests/drawio-*.test.ts`.

Official upstream sources:

- [draw.io File Format wiki](https://github.com/jgraph/drawio/wiki/File-Format)
- [draw.io diagram generation reference](https://www.drawio.com/docs/reference/diagram-generation/)

Reviewed: 2026-10-26.
