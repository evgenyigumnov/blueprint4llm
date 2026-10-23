# draw.io parcel lifecycle map

Export JSON with **File → Export as → JSON** and paste it into a `drawio` block. This example maps
orders through payment and fulfillment to customer support, with each business area grouped and
cross-area dependencies kept visible.

```drawio page=parcel direction=TB
{
  "version": "26.0",
  "pages": [
    {
      "id": "parcel",
      "name": "Parcel lifecycle context map",
      "cells": [
        { "id": "platform", "type": "layer", "label": "Platform" },

        { "id": "commerce", "type": "group", "parent": "platform", "label": "Commerce · order and payment" },
        { "id": "cart", "type": "node", "parent": "commerce", "label": "Cart\npricing and promotions" },
        { "id": "checkout", "type": "node", "parent": "commerce", "label": "Checkout\naddress and delivery choice" },
        { "id": "orders", "type": "node", "parent": "commerce", "label": "Order service\nstate and line items" },
        { "id": "payments", "type": "node", "parent": "commerce", "label": "Payments\nauthorize and capture" },

        { "id": "operations", "type": "group", "parent": "platform", "label": "Operations · physical delivery" },
        { "id": "inventory", "type": "node", "parent": "operations", "label": "Inventory\nreserve and release stock" },
        { "id": "routing", "type": "node", "parent": "operations", "label": "Routing\nwarehouse and carrier" },
        { "id": "dispatch", "type": "node", "parent": "operations", "label": "Dispatch\nlabel and handoff" },
        { "id": "tracking", "type": "node", "parent": "operations", "label": "Tracking\ncarrier status events" },

        { "id": "experience", "type": "group", "parent": "platform", "label": "Customer · visibility and support" },
        { "id": "notifications", "type": "node", "parent": "experience", "label": "Notifications\nemail and push" },
        { "id": "portal", "type": "node", "parent": "experience", "label": "Order portal\nstatus and history" },
        { "id": "support", "type": "node", "parent": "experience", "label": "Support console\nmanual correction" },

        { "id": "cart-checkout", "type": "edge", "parent": "platform", "source": "cart", "target": "checkout", "label": "priced cart" },
        { "id": "checkout-order", "type": "edge", "parent": "platform", "source": "checkout", "target": "orders", "label": "place order" },
        { "id": "order-payment", "type": "edge", "parent": "platform", "source": "orders", "target": "payments", "label": "capture on dispatch" },
        { "id": "order-stock", "type": "edge", "parent": "platform", "source": "orders", "target": "inventory", "label": "reserve" },
        { "id": "stock-routing", "type": "edge", "parent": "platform", "source": "inventory", "target": "routing", "label": "available items" },
        { "id": "routing-dispatch", "type": "edge", "parent": "platform", "source": "routing", "target": "dispatch", "label": "fulfillment plan" },
        { "id": "dispatch-tracking", "type": "edge", "parent": "platform", "source": "dispatch", "target": "tracking", "label": "shipment ID" },
        { "id": "tracking-portal", "type": "edge", "parent": "platform", "source": "tracking", "target": "portal", "label": "status updates" },
        { "id": "order-notify", "type": "edge", "parent": "platform", "source": "orders", "target": "notifications", "label": "confirmation" },
        { "id": "portal-support", "type": "edge", "parent": "platform", "source": "portal", "target": "support", "label": "customer issue" }
      ]
    }
  ]
}
```

The structural JSON keeps group hierarchy and labels. The renderer computes an automatic layout;
original draw.io positions, colors, and styles are not preserved.
