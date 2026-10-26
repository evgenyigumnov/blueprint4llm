# OpenAPI 3.1.1 authoring guide

Write an API description as YAML or JSON inside a Markdown code fence named `openapi`. OpenAPI (OAS) is a language-agnostic contract for HTTP APIs: it can inform documentation, client/server generation, and testing, but does not implement the service. This guide separates upstream OAS concepts from the smaller, static profile rendered by blueprint4llm.

**Specification versions (reviewed 2026-10-26).** The [official version index](https://spec.openapis.org/oas/) lists published versions through 3.2.1 and 3.2.0; [OpenAPI 3.2.1](https://spec.openapis.org/oas/v3.2.1.html) is the latest listed release. This project's renderer deliberately accepts exactly `openapi: 3.1.1`, not 3.2.1, 3.2.0, or even 3.1.2. The [3.1.1 specification](https://spec.openapis.org/oas/v3.1.1.html) says tooling that supports OAS 3.1 should be compatible with all 3.1.* patch versions; the renderer uses strict equality instead. The root `openapi` value is the specification version, while `info.version` versions the OpenAPI document; it is not the OAS version and is not necessarily the API's runtime version.

## Upstream OpenAPI concepts

### Describe the HTTP interface

An OpenAPI document has an `openapi` version, `info` metadata, and one or more interface sections such as `paths`, `components`, or (in OAS 3.1) `webhooks`. Each `paths` key is an absolute path template beginning with `/`; each Path Item can define operations by HTTP method. The path and method together identify an operation, while a unique `operationId` gives tools a stable name. Keep paths resource-oriented, use path parameters for resource identity, and use query parameters for filtering, sorting, and pagination.

Parameters may be defined once for a whole path and overridden by an operation; a parameter is identified by its `(name, in)` pair. The standard locations are `path`, `query`, `header`, and `cookie`. A path-template variable must have a matching required path parameter. Parameter serialization choices such as `style` and `explode` matter for arrays and objects: document how a client actually sends them rather than assuming all tools serialize the same way. Use a parameter `schema` for ordinary typed values or `content` for a parameter represented as one media type, not both.

An operation's optional `requestBody` describes input payloads by media type (for example `application/json` or `multipart/form-data`). Its `responses` map describes possible outcomes by HTTP status; each Response Object has a description and may define headers and media-typed content. Include success and meaningful error outcomes, and use `default` for other responses when appropriate. Keep status semantics, media types, requiredness, and error shape consistent across operations. Examples can make wire-level values concrete in a full OAS toolchain.

### Model data and reuse definitions

OpenAPI 3.1 Schema Objects build on JSON Schema Draft 2020-12 and its dialect mechanism. Use schemas to describe primitives, arrays, objects, enums, constraints, and alternatives; `required` is declared on the containing object, and object properties are optional unless named there. Use a union such as `type: [string, 'null']` when `null` is a valid value. `format` is useful semantic guidance (such as `date-time` or `uuid`), but format validation varies among tools. `allOf`, `oneOf`, and `anyOf` express composition: `allOf` combines constraints, `oneOf` requires exactly one matching branch, and `anyOf` allows one or more matches. Consider a discriminator when a polymorphic payload needs an explicit type selector. `readOnly` and `writeOnly` distinguish response-oriented and request-oriented properties.

The `components` object holds reusable schemas, parameters, request bodies, responses, headers, security schemes, callbacks, and other definitions. A component has no effect until referenced. Reuse stable concepts to keep contracts consistent, but avoid creating indirection for one-off structures that makes an operation hard to understand. OAS supports references across documents as well as local references. In Schema Objects, `$ref` follows JSON Schema rules and can be accompanied by schema keywords; a Reference Object used for other object kinds has its own rules. Keep external references deliberate and resolvable in the tools that consume the full description.

### Describe deployment, security, and events

A `servers` array gives base URLs; server variables can describe a controlled environment or tenant substitution. Server declarations may be placed at the root, path, or operation scope, with narrower scopes overriding broader ones. Keep path keys relative to the chosen server base and do not embed secrets in a server URL.

Define authentication mechanisms under `components.securitySchemes` (for example HTTP bearer, API key, OAuth 2.0, or mutual TLS) and use `security` requirements to apply them. Entries in the `security` array are alternatives (OR); multiple schemes within one entry are jointly required (AND). An operation can override root security; an empty requirement object can make access optional, while an empty operation-level `security: []` removes inherited requirements. Describe authorization intent and scopes, never credentials or tokens.

A Callback Object describes requests the provider may initiate in response to a particular operation, often using a runtime expression to obtain a callback URL from the incoming request. The root `webhooks` map describes provider-initiated requests that are not tied to a particular API call, such as event notifications after a separate subscription. Define their request bodies and responses like other operations, and explain registration, retries, authentication, and delivery expectations in descriptions. These are standard contract features, not promises that a given renderer will visualize them.

Specification extensions use `x-`-prefixed fields where the specification permits them. They can carry vendor/tool-specific metadata, but support is tool-dependent; do not put essential interoperable contract semantics only in an extension.

### Upstream-only illustration: servers, security, callbacks, webhooks

This YAML is an OAS 3.1.1 illustration of features beyond the local renderer profile. It is intentionally labeled `yaml`, not a compatible `openapi` example. A full description would also include its surrounding metadata and any referenced definitions.

```yaml
servers:
  - url: https://{region}.api.example.test/v1
    variables:
      region: { default: eu, enum: [eu, us] }
security:
  - bearerAuth: []
components:
  securitySchemes:
    bearerAuth: { type: http, scheme: bearer }
paths:
  /subscriptions:
    post:
      callbacks:
        shipmentUpdates:
          '{$request.body#/callbackUrl}':
            post:
              requestBody:
                content:
                  application/json:
                    schema: { type: object, properties: { status: { type: string } } }
              responses:
                '204': { description: Event accepted }
      responses:
        '202': { description: Subscription accepted }
webhooks:
  shipmentStatus:
    post:
      requestBody:
        required: true
        content:
          application/json:
            schema: { type: object, properties: { status: { type: string } } }
      responses:
        '204': { description: Event accepted }
```

### Practical design choices

- Design the contract around observable HTTP behavior, not server internals. Give each operation a concise summary and describe units, defaults, pagination, idempotency, and error conditions where they affect callers.
- Reuse schemas for genuinely shared wire shapes; separate request and response models when their required fields or lifecycle differ. Mark server-assigned fields `readOnly` and caller-supplied fields `writeOnly` when that distinction is real.
- Prefer explicit response codes and a reusable error shape over one vague success response. State whether a response has a body, and use the correct media type for JSON, binary, form, or streaming payloads.
- Treat security, server URLs, callbacks, webhooks, examples, and serialization settings as meaningful contract data. Use a full OpenAPI toolchain when those upstream features must be validated, generated, or shown; this renderer is only a static reference view.

## Renderer compatibility profile

Place the complete OpenAPI document in an `openapi` fence; the compatible contract below shows Markdown placement and the supported profile together. The root must be an object with `info.title` and `info.version` as non-empty strings. Include at least one of `paths` or `components`. An empty `paths: {}` is valid when components contain schemas to display. Add paths for callable operations and components for reusable schemas and objects.

This profile is implemented by the project's own parser, model builder, reference resolver, and SVG renderer, not by a general OpenAPI SDK. `yaml` 2.9.1 is the pinned YAML parser in `package.json` and `package-lock.json`; the focused renderer tests also assert that parser version in the renderer cache key. The renderer's exact OAS version check is separate from the YAML parser version.

### Build a useful compatible contract

- Give each path a key beginning with `/`, such as `/v1/shipments/{shipmentId}`. The renderer recognizes `get`, `put`, `post`, `delete`, `options`, `head`, `patch`, and `trace` operations.
- Give each operation a `responses` object with at least one response. A response description is required. Use quoted numeric YAML response keys such as `'200'`, or use `default` and uppercase ranges from `1XX` through `5XX`.
- Describe inputs under `parameters`. A parameter needs `name`, `in`, and either `schema` or `content`. `in` must be `path`, `query`, `header`, or `cookie`. Set every path parameter to `required: true`. A path-level parameter applies to each operation on that path; an operation parameter with the same `(in, name)` replaces it. Duplicate parameters in the same list are errors.
- Describe a request body with `requestBody.content`; each media type can include a schema. `requestBody.required` defaults to `false` and `description` is optional.
- A response may include `content` and `headers`. Each media type can include a schema. A response header may have `schema` or `content`; the renderer displays either representation.
- Put reusable definitions under `components.schemas`, `parameters`, `requestBodies`, `responses`, `headers`, and `pathItems`. Referenced non-schema objects are resolved where used; schema `$ref`s are shown as visible reference edges rather than recursively expanded. Named schemas are also displayed in the Models section, even if no operation references them.

### Reuse objects with local JSON Pointers

Use `$ref` values beginning with `#/`, for example `#/components/schemas/Shipment`. References resolve against the YAML or JSON document in the same `openapi` fence; file paths, URLs, and the fragment `#` are rejected. References can point to mapping values or array entries in the document. JSON Pointer segments use `~1` for `/` and `~0` for `~`; percent-encoded fragments are decoded.

Schema references are kept as visible reference edges, so recursive schemas are supported without infinitely expanding them. For parameters, request bodies, responses, headers, and path items, the renderer resolves local reference chains. A reference target must have the expected object shape. Non-schema reference objects apply string `summary` and `description` siblings; a description is displayed only for object types that display descriptions. Other siblings are ignored and reported as warnings. A path item reference cannot be merged with local operations or parameters.

### JSON Schema subset shown by the renderer

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

### Other fields and warnings

The static reference shows the API title and `info.version` value, optional API description, operations, parameters, request bodies, response descriptions, response headers and media types, and the supported schema details above. Operation summaries, descriptions, operation IDs, tags, and the deprecated flag are also shown.

Fields outside the renderer's displayed profile are not rendered and produce warnings. Common examples include root `servers`, `tags`, `security`, `webhooks`, and `externalDocs`; operation `security`, `callbacks`, and `servers`; parameter serialization fields such as `style` and `explode`; response `links`; media type `example` or `encoding`; and schema validation keywords outside the subset above. Unshown fields on otherwise parsed objects normally produce warnings; malformed values and invalid reference targets instead produce errors. Component groups other than `schemas`, `parameters`, `requestBodies`, `responses`, `headers`, and `pathItems` warn at the group field. Unreferenced definitions in `parameters`, `requestBodies`, `responses`, `headers`, and `pathItems` also produce warnings.

Warnings are collected into the rendered “Not shown” summary and are available to the CLI as diagnostics. A warning means that contract information was not represented in the static reference. Keep essential machine-readable semantics in a full OpenAPI contract; supported descriptions can add human context in this static view but do not replace omitted security, deployment, callback, or serialization behavior.

### Complete compatible contract

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

### Renderer limits

The current parser accepts one YAML 1.2 document or strict JSON document. YAML aliases, merge keys, custom tags, non-string mapping keys, and non-finite numbers are rejected. The source limit is 256 KiB, with at most 10,000 syntax-tree nodes and depth 64. The renderer allows at most 200 operations, 500 named schemas, and 2,000 `$ref` uses. It produces a static SVG with a 1,200 px width, a maximum height of 16,384 px, a 5,000-line layout limit, and a 4 MiB output limit.

Check this guide's compatible examples with `blueprint4llm skills/blueprint4llm/formats/openapi-llm.md --check`.

## Official references

- [OpenAPI Specification 3.1.1](https://spec.openapis.org/oas/v3.1.1.html) — the renderer's declared specification version and the upstream object definitions described here.
- [OpenAPI Specification version index](https://spec.openapis.org/oas/) — published version list reviewed 2026-10-26.
- [OpenAPI Specification 3.2.1](https://spec.openapis.org/oas/v3.2.1.html) — latest version listed by the official index on the review date; not accepted by this renderer.

Review date: **2026-10-26**.
