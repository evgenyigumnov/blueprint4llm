# OpenAPI 3.1.1 authoring guide

Write the API contract as YAML or JSON inside a Markdown code fence named `openapi`. The renderer turns that document into a static API reference. It accepts the OpenAPI version string `3.1.1` only; this guide describes the renderer's supported profile, not every field in the OpenAPI specification.

Place the complete OpenAPI document in that fence; the contract below shows its Markdown placement and the supported fields together.

The root must be an object with `info.title` and `info.version` as non-empty strings. Include at least one of `paths` or `components`. An empty `paths: {}` is valid when components contain schemas to display. Add paths for callable operations and components for reusable schemas and objects.

## Build a useful contract

- Give each path a key beginning with `/`, such as `/v1/shipments/{shipmentId}`. The renderer recognizes `get`, `put`, `post`, `delete`, `options`, `head`, `patch`, and `trace` operations.
- Give each operation a `responses` object with at least one response. A response description is required. Use quoted numeric YAML response keys such as `'200'`, or use `default` and uppercase ranges from `1XX` through `5XX`.
- Describe inputs under `parameters`. A parameter needs `name`, `in`, and either `schema` or `content`. `in` must be `path`, `query`, `header`, or `cookie`. Set every path parameter to `required: true`. A path-level parameter applies to each operation on that path; an operation parameter with the same `(in, name)` replaces it. Duplicate parameters in the same list are errors.
- Describe a request body with `requestBody.content`; each media type can include a schema. `requestBody.required` defaults to `false` and `description` is optional.
- A response may include `content` and `headers`. Each media type can include a schema. A response header may have `schema` or `content`; the renderer displays either representation.
- Put reusable definitions under `components.schemas`, `parameters`, `requestBodies`, `responses`, `headers`, and `pathItems`. A referenced component is included where it is used. Named schemas are also displayed in the Models section, even if no operation references them.

## Reuse objects with local JSON Pointers

Use `$ref` values beginning with `#/`, for example `#/components/schemas/Shipment`. References resolve against the YAML or JSON document in the same `openapi` fence; file paths, URLs, and the fragment `#` are rejected. References can point to mapping values or array entries in the document. JSON Pointer segments use `~1` for `/` and `~0` for `~`; percent-encoded fragments are decoded.

Schema references are kept as visible reference edges, so recursive schemas are supported without infinitely expanding them. For parameters, request bodies, responses, headers, and path items, the renderer resolves local reference chains. A reference target must have the expected object shape. Non-schema reference objects apply string `summary` and `description` siblings; a description is displayed only for object types that display descriptions. Other siblings are ignored and reported as warnings. A path item reference cannot be merged with local operations or parameters.

## JSON Schema subset shown by the renderer

Schema Objects may be objects or boolean schemas (`true` and `false`). The renderer reads and displays these fields:

| Schema field                    | How it appears                                                                                                 |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `$ref`                          | Local reference target and pointer                                                                             |
| `type`                          | One JSON Schema type or an array of types: `null`, `boolean`, `object`, `array`, `number`, `integer`, `string` |
| `format`, `description`         | Schema summary and description text                                                                            |
| `required`, `properties`        | Expanded property rows; required property names are marked                                                     |
| `items`, `additionalProperties` | Expanded nested schema, or the boolean additional-properties value                                             |
| `enum`                          | Enum values in the schema summary                                                                              |
| `allOf`, `oneOf`, `anyOf`       | Each alternative/composition schema is expanded                                                                |
| `readOnly`, `writeOnly`         | Read-only and write-only flags                                                                                 |
| `$schema`                       | Accepted only when it equals `https://spec.openapis.org/oas/3.1/dialect/base`; it is not displayed             |

All other schema keys produce a warning and are not displayed. This includes constraints such as `minimum`, `maxLength`, and `pattern`, as well as `default`, `const`, and custom extension keys. The renderer does not apply those constraints to example data or generate validation rules from them. `$id`, `$anchor`, `$dynamicRef`, and `$dynamicAnchor` are rejected. A different `$schema` value is rejected. The root `jsonSchemaDialect`, when present, must use the same supported dialect URI.

Boolean schemas render as “Allows any value” (`true`) or “Allows no value” (`false`). A schema `type` array is displayed as a list of types, so `type: [string, 'null']` is the supported way to show a nullable string.

## Other fields and warnings

The static reference shows the API title, API version, optional API description, operations, parameters, request bodies, response descriptions, response headers and media types, and the supported schema details above. Operation summaries, descriptions, operation IDs, tags, and the deprecated flag are also shown.

Fields outside the renderer's displayed profile are not rendered and produce warnings. Common examples include root `servers`, `tags`, `security`, and `externalDocs`; operation `security`, `callbacks`, and `servers`; parameter serialization fields such as `style` and `explode`; response `links`; media type `example` or `encoding`; and schema validation keywords outside the subset above. Unknown fields inside recognized objects also warn. Component groups other than `schemas`, `parameters`, `requestBodies`, `responses`, `headers`, and `pathItems` warn at the group field. Unreferenced definitions in `parameters`, `requestBodies`, `responses`, `headers`, and `pathItems` also produce warnings.

Warnings are collected into the rendered “Not shown” summary and are available to the CLI as diagnostics. A warning means that contract information was not represented in the static reference; retain important behavior in supported descriptions, parameters, responses, and schemas.

## Complete contract

This contract defines shipment creation, listing, retrieval, reusable request and response objects, and a health operation. All references are local to the same document.

```openapi
openapi: 3.1.1
info:
  title: Northstar Shipping API
  version: '2025-03'
  description: Create shipments, track their progress, and retrieve delivery details.

paths:
  /v1/shipments:
    parameters:
      - $ref: '#/components/parameters/TenantId'
    get:
      operationId: listShipments
      summary: List shipments
      description: Return a page of shipments visible to the selected tenant.
      tags: [Shipments]
      parameters:
        - name: limit
          in: query
          description: Maximum number of shipments to return.
          schema:
            type: integer
            format: int32
        - name: status
          in: query
          description: Keep only shipments in this lifecycle state.
          schema:
            type: string
            enum: [queued, in_transit, delivered, delayed, cancelled]
        - name: cursor
          in: query
          description: Continue after the cursor returned by the previous page.
          schema:
            type: string
      responses:
        '200':
          description: The requested page of shipments.
          headers:
            X-Next-Cursor:
              $ref: '#/components/headers/NextCursor'
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ShipmentPage'
        '400':
          $ref: '#/components/responses/InvalidRequest'
    post:
      operationId: createShipment
      summary: Create a shipment
      tags: [Shipments]
      requestBody:
        $ref: '#/components/requestBodies/CreateShipment'
      responses:
        '201':
          $ref: '#/components/responses/ShipmentCreated'
        '400':
          $ref: '#/components/responses/InvalidRequest'

  /v1/shipments/{shipmentId}:
    parameters:
      - $ref: '#/components/parameters/TenantId'
      - $ref: '#/components/parameters/ShipmentId'
    get:
      operationId: getShipment
      summary: Get shipment details
      tags: [Shipments]
      responses:
        '200':
          $ref: '#/components/responses/ShipmentFound'
        '404':
          $ref: '#/components/responses/ShipmentNotFound'

  /v1/health:
    $ref: '#/components/pathItems/Health'

components:
  parameters:
    TenantId:
      name: X-Tenant-Id
      in: header
      required: true
      description: Tenant whose shipments are being accessed.
      schema:
        type: string
    ShipmentId:
      name: shipmentId
      in: path
      required: true
      description: Stable identifier of the shipment.
      schema:
        type: string
        format: uuid

  requestBodies:
    CreateShipment:
      required: true
      description: Shipment details supplied by the calling system.
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ShipmentCreate'

  responses:
    ShipmentCreated:
      description: The shipment was created.
      headers:
        X-Request-Id:
          $ref: '#/components/headers/RequestId'
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Shipment'
    ShipmentFound:
      description: Shipment and current tracking information.
      headers:
        X-Request-Id:
          $ref: '#/components/headers/RequestId'
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Shipment'
    ShipmentNotFound:
      description: No shipment with that identifier is visible to this tenant.
      content:
        application/problem+json:
          schema:
            $ref: '#/components/schemas/Problem'
    InvalidRequest:
      description: The request could not be processed.
      content:
        application/problem+json:
          schema:
            $ref: '#/components/schemas/Problem'

  headers:
    RequestId:
      description: Identifier for correlating this response with service logs.
      schema:
        type: string
    NextCursor:
      description: Cursor for the next page, when another page is available.
      schema:
        type: string

  pathItems:
    Health:
      get:
        operationId: getHealth
        summary: Check service health
        tags: [Operations]
        responses:
          '200':
            description: The service is accepting requests.
            content:
              text/plain:
                schema:
                  type: string
                  enum: [ok]

  schemas:
    ShipmentCreate:
      type: object
      description: Fields required to schedule a new shipment.
      required: [orderId, destination]
      properties:
        orderId:
          type: string
          format: uuid
          description: Identifier of the order being fulfilled.
        destination:
          $ref: '#/components/schemas/Address'
        deliveryInstructions:
          type: string
          description: Optional instructions for the carrier.

    ShipmentPage:
      type: object
      required: [items]
      properties:
        items:
          type: array
          items:
            $ref: '#/components/schemas/Shipment'
        nextCursor:
          type: [string, 'null']
          description: Cursor to request the next page, or null at the end.

    Shipment:
      type: object
      description: A parcel moving through the delivery network.
      required: [id, orderId, status, createdAt, destination]
      properties:
        id:
          type: string
          format: uuid
          readOnly: true
        orderId:
          type: string
          format: uuid
        status:
          type: string
          enum: [queued, in_transit, delivered, delayed, cancelled]
        createdAt:
          type: string
          format: date-time
          readOnly: true
        destination:
          $ref: '#/components/schemas/Address'
        tracking:
          type: array
          readOnly: true
          items:
            $ref: '#/components/schemas/TrackingEvent'

    Address:
      type: object
      required: [name, street, city, postalCode, countryCode]
      properties:
        name:
          type: string
        street:
          type: string
        city:
          type: string
        region:
          type: [string, 'null']
        postalCode:
          type: string
        countryCode:
          type: string
          description: Two-letter country or region code.

    TrackingEvent:
      type: object
      required: [occurredAt, status]
      properties:
        occurredAt:
          type: string
          format: date-time
        status:
          type: string
          enum: [label_created, picked_up, in_transit, delivered]
        location:
          type: [string, 'null']
        detail:
          type: [string, 'null']

    Problem:
      type: object
      required: [code, message]
      properties:
        code:
          type: string
        message:
          type: string
        requestId:
          type: [string, 'null']
```

## Renderer limits

The current parser accepts one YAML 1.2 document or strict JSON document. YAML aliases, merge keys, custom tags, non-string mapping keys, and non-finite numbers are rejected. The source limit is 256 KiB, with at most 10,000 syntax-tree nodes and depth 64. The renderer allows at most 200 operations, 500 named schemas, and 2,000 `$ref` uses. It produces a static SVG with a 1,200 px width, a maximum height of 16,384 px, a 5,000-line layout limit, and a 4 MiB output limit.
