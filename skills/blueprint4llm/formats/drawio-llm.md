# draw.io structural JSON

Use a `drawio` or `draw.io` fenced code block for a structural JSON graph. This renderer does not read native draw.io XML or import an existing drawing's coordinates and styling. It validates the graph structure, calculates a layout, and emits a safe SVG.

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
