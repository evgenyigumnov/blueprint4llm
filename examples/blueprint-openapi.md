# Parcel operations API

This OpenAPI 3.1.1 contract renders a compact but realistic reference with multiple operations,
reusable request and response models, nested fields, enums, pagination, and error responses.

```openapi
openapi: 3.1.1
info:
  title: Parcel Operations API
  version: 2.4.0
  description: Create shipments, inspect tracking events, and manage delivery exceptions.
paths:
  /shipments:
    post:
      summary: Create a shipment
      parameters:
        - name: Idempotency-Key
          in: header
          required: true
          description: Reuse the same key when retrying a timed-out request.
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateShipment'
      responses:
        '201':
          description: Shipment accepted for fulfillment.
          headers:
            Location:
              description: URL of the new shipment.
              schema:
                type: string
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Shipment'
  /shipments/{shipmentId}:
    parameters:
      - name: shipmentId
        in: path
        required: true
        description: Stable shipment identifier.
        schema:
          type: string
    get:
      summary: Get shipment details
      responses:
        '200':
          description: Current fulfillment state and destination.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Shipment'
        '404':
          description: Shipment does not exist or is outside the caller's account.
  /shipments/{shipmentId}/events:
    get:
      summary: List tracking events
      parameters:
        - name: cursor
          in: query
          required: false
          description: Opaque cursor from the previous page.
          schema:
            type: string
        - name: limit
          in: query
          required: false
          schema:
            type: integer
      responses:
        '200':
          description: Newest-first event page and the next cursor, when present.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TrackingPage'
components:
  schemas:
    CreateShipment:
      type: object
      description: Customer order and delivery destination.
      required: [orderId, recipient, address, serviceLevel]
      properties:
        orderId:
          type: string
          description: Merchant order reference.
        recipient:
          type: string
          description: Name shown on the delivery label.
        address:
          $ref: '#/components/schemas/Address'
        serviceLevel:
          type: string
          enum: [economy, priority, same_day]
        signatureRequired:
          type: boolean
    Shipment:
      type: object
      description: Shipment state as last reported by fulfillment.
      required: [id, orderId, status, destination, createdAt]
      properties:
        id:
          type: string
          readOnly: true
        orderId:
          type: string
        status:
          type: string
          enum: [queued, packed, in_transit, delivery_attempted, delivered, exception]
        destination:
          $ref: '#/components/schemas/Address'
        createdAt:
          type: string
          format: date-time
          readOnly: true
    Address:
      type: object
      required: [line1, city, postalCode, countryCode]
      properties:
        line1:
          type: string
        city:
          type: string
        postalCode:
          type: string
        countryCode:
          type: string
          description: ISO 3166-1 alpha-2 code.
    TrackingPage:
      type: object
      required: [items]
      properties:
        items:
          type: array
          items:
            $ref: '#/components/schemas/TrackingEvent'
        nextCursor:
          type: string
    TrackingEvent:
      type: object
      required: [eventId, occurredAt, code, description]
      properties:
        eventId:
          type: string
        occurredAt:
          type: string
          format: date-time
        code:
          type: string
          enum: [label_created, picked_up, hub_arrival, out_for_delivery, delivered, exception]
        description:
          type: string
```
