# Orders API

The `openapi` fence renders an OpenAPI 3.1.1 contract as a fully expanded static API reference. The
renderer works locally and keeps references between operations and models visible.

```openapi
openapi: 3.1.1
info:
  title: Orders API
  version: 1.0.0
  description: Create orders and retrieve them by ID.
paths:
  /orders/{id}:
    get:
      summary: Get an order
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          $ref: '#/components/responses/OrderResponse'
        '404':
          description: The order does not exist.
  /orders:
    post:
      summary: Create an order
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/NewOrder'
      responses:
        '201':
          $ref: '#/components/responses/OrderResponse'
components:
  schemas:
    Order:
      type: object
      required: [id, status]
      properties:
        id:
          type: string
          description: Server-assigned order ID.
        status:
          type: string
          enum: [new, paid]
    NewOrder:
      type: object
      required: [customerId]
      properties:
        customerId:
          type: string
  responses:
    OrderResponse:
      description: The order.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Order'
```
