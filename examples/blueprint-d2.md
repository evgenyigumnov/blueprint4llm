# D2 checkout sequence

This sequence covers the full checkout transaction: cart validation, price lock, inventory
reservation, payment authorization, event publication, and customer confirmation.

```d2
checkout: Checkout and fulfilment {
  shape: sequence_diagram

  buyer: "Buyer app"
  gateway: "API gateway"
  orders: "Order service"
  stock: "Inventory"
  payment: "Payments"
  events: "Event stream"
  email: "Email service"

  buyer -> gateway: POST /checkout
  gateway -> orders: validate cart and account
  orders -> orders: lock price and calculate tax
  orders -> stock: reserve SKUs for 10 minutes
  stock -> orders: reservation ID and expiry
  orders -> payment: authorize total
  payment -> orders: authorization token
  orders -> events: publish OrderPlaced
  events -> stock: confirm reservation
  events -> email: send receipt and delivery window
  email -> buyer: confirmation and tracking URL
  orders -> gateway: 201 Created + order ID
  gateway -> buyer: order summary
}
```

D2 source renders offline with the bundled WebAssembly engine. The static profile rejects imports,
external resources, animation, HTML, Markdown, and LaTeX labels.
