import { describe, expect, it } from 'vitest';

import { buildOpenApiModel } from '../src/renderers/openapi-model.js';
import { parseOpenApiSource } from '../src/renderers/openapi-source.js';

function build(source: string) {
  return buildOpenApiModel(parseOpenApiSource(source));
}

describe('buildOpenApiModel', () => {
  it('normalizes all eight operations in source order and merges parameters by location and name', () => {
    const document = build(`
openapi: 3.1.1
info: { title: Methods, version: '1' }
paths:
  /items/{id}:
    parameters:
      - name: id
        in: path
        required: true
        schema: { type: string }
      - name: state
        in: query
        schema: { type: string }
    get:
      parameters:
        - name: state
          in: query
          required: true
          schema: { type: string, enum: [new, paid] }
        - name: token
          in: header
          schema: { type: string }
      responses: { '200': { description: ok } }
    put: { responses: { default: { description: saved } } }
    post: { responses: { default: { description: created } } }
    delete: { responses: { default: { description: deleted } } }
    options: { responses: { default: { description: options } } }
    head: { responses: { default: { description: head } } }
    patch: { responses: { default: { description: patched } } }
    trace: { responses: { default: { description: trace } } }
`);

    expect(document.operations.map((operation) => operation.method)).toEqual([
      'GET',
      'PUT',
      'POST',
      'DELETE',
      'OPTIONS',
      'HEAD',
      'PATCH',
      'TRACE',
    ]);
    expect(
      document.operations[0]?.parameters.map(({ name, in: location }) => [name, location]),
    ).toEqual([
      ['id', 'path'],
      ['state', 'query'],
      ['token', 'header'],
    ]);
    expect(document.operations[0]?.parameters[1]).toMatchObject({
      required: true,
      schema: { enum: ['new', 'paid'] },
    });
  });

  it('resolves reusable request, response, header, parameter, and path item objects', () => {
    const document = build(`
openapi: 3.1.1
info: { title: Orders, version: '1' }
paths:
  /orders:
    $ref: '#/components/pathItems/Orders'
components:
  pathItems:
    Orders:
      parameters:
        - $ref: '#/components/parameters/Trace'
      post:
        requestBody: { $ref: '#/components/requestBodies/NewOrder' }
        responses:
          '201': { $ref: '#/components/responses/Created' }
  parameters:
    Trace: { name: X-Trace, in: header, schema: { type: string } }
  requestBodies:
    NewOrder:
      required: true
      content:
        application/json: { schema: { $ref: '#/components/schemas/NewOrder' } }
  responses:
    Created:
      description: created
      headers:
        X-Request-Id: { $ref: '#/components/headers/RequestId' }
      content:
        application/json: { schema: { $ref: '#/components/schemas/Order' } }
  headers:
    RequestId: { description: correlation id, schema: { type: string } }
  schemas:
    NewOrder: { type: object, properties: { customerId: { type: string } } }
    Order: { type: object, properties: { id: { type: string } } }
`);

    expect(document.operations[0]).toMatchObject({
      method: 'POST',
      path: '/orders',
      parameters: [{ name: 'X-Trace', in: 'header' }],
      requestBody: { required: true, content: [{ mediaType: 'application/json' }] },
      responses: [
        {
          status: '201',
          headers: [{ name: 'X-Request-Id', description: 'correlation id' }],
          content: [{ mediaType: 'application/json' }],
        },
      ],
    });
    expect(document.schemas.map(({ name }) => name)).toEqual(['NewOrder', 'Order']);
  });

  it('retains recursive model edges, composition variants, boolean schemas, and nullable types', () => {
    const document = build(`
openapi: 3.1.1
info: { title: Tree, version: '1' }
components:
  schemas:
    Category:
      type: object
      required: [name]
      properties:
        name: { type: [string, 'null'], format: uuid, readOnly: true }
        children: { type: array, items: { $ref: '#/components/schemas/Category' } }
        allowed: true
        forbidden: false
        value: { oneOf: [{ type: string }, { type: integer }] }
`);
    const category = document.schemas[0]?.schema;
    expect(category?.properties.map(({ name }) => name)).toEqual([
      'name',
      'children',
      'allowed',
      'forbidden',
      'value',
    ]);
    expect(category?.properties[0]?.schema.type).toEqual(['string', 'null']);
    expect(category?.properties[0]?.schema.readOnly).toBe(true);
    expect(category?.properties[1]?.schema.items?.ref).toMatchObject({ targetName: 'Category' });
    expect(category?.properties[2]?.schema.booleanSchema).toBe(true);
    expect(category?.properties[3]?.schema.booleanSchema).toBe(false);
    expect(category?.properties[4]?.schema.compositions[0]?.kind).toBe('oneOf');
  });

  it('supports response ranges and default while preserving media type and header order', () => {
    const document = build(`
openapi: 3.1.1
info: { title: Media, version: '1' }
paths:
  /data:
    get:
      responses:
        2XX: { description: success, content: { application/json: { schema: { type: string } }, text/plain: { schema: { type: string } } }, headers: { X-B: { schema: { type: integer } }, X-A: { schema: { type: boolean } } } }
        default: { description: fallback }
`);
    expect(document.operations[0]?.responses.map(({ status }) => status)).toEqual([
      '2XX',
      'default',
    ]);
    expect(document.operations[0]?.responses[0]?.content.map(({ mediaType }) => mediaType)).toEqual(
      ['application/json', 'text/plain'],
    );
    expect(document.operations[0]?.responses[0]?.headers.map(({ name }) => name)).toEqual([
      'X-B',
      'X-A',
    ]);
  });

  it('warns for unshown fields but does not treat data inside examples as references', () => {
    const document = build(`
openapi: 3.1.1
info: { title: Examples, version: '1' }
paths:
  /x:
    get:
      responses:
        '200':
          description: ok
          content:
            application/json:
              example: { $ref: '../remote.yaml#/Thing' }
          links: { next: { operationId: other } }
      security: [{ apiKey: [] }]
`);
    expect(document.warnings.map(({ summary }) => summary)).toContain('example');
    expect(document.warnings.map(({ summary }) => summary)).toContain('links');
    expect(document.warnings.map(({ summary }) => summary)).toContain('security');
    expect(
      document.warnings.every(({ line, column }) => line !== undefined && column !== undefined),
    ).toBe(true);
  });

  it('warns about unused component objects and unshown info fields with pointers', () => {
    const document = build(`
openapi: 3.1.1
info:
  title: Unused
  version: '1'
  contact: { email: api@example.test }
paths: {}
components:
  responses:
    NeverUsed: { description: hidden }
`);
    expect(document.warnings.map(({ message }) => message)).toEqual([
      'unused component responses "NeverUsed" is not shown at #/components/responses/NeverUsed',
      'field "contact" is not shown at #/info/contact',
    ]);
  });

  it('enforces operation and named-schema limits at the first excess item', () => {
    const paths = Array.from(
      { length: 200 },
      (_, index) => `  /p${index}:\n    get: { responses: { default: { description: ok } } }`,
    ).join('\n');
    const withinOperationLimit = `openapi: 3.1.1\ninfo: { title: Ops, version: "1" }\npaths:\n${paths}\n`;
    expect(build(withinOperationLimit).operations).toHaveLength(200);
    const overOperationLimit = withinOperationLimit.replace(
      '/p199:',
      '/p199:\n    post: { responses: { default: { description: ok } } }',
    );
    expect(() => build(overOperationLimit)).toThrow('limit 200');

    const schemas = Array.from({ length: 500 }, (_, index) => `    S${index}: true`).join('\n');
    const withinSchemaLimit = `openapi: 3.1.1\ninfo: { title: Schemas, version: "1" }\ncomponents:\n  schemas:\n${schemas}\n`;
    expect(build(withinSchemaLimit).schemas).toHaveLength(500);
    const overSchemaLimit = withinSchemaLimit.replace(
      '    S499: true',
      '    S499: true\n    S500: true',
    );
    expect(() => build(overSchemaLimit)).toThrow('limit 500');
  });

  it.each([
    ['missing info', 'openapi: 3.1.1\npaths: {}', 'field "info" must be an object'],
    [
      'missing title',
      'openapi: 3.1.1\ninfo: { version: "1" }\npaths: {}',
      'field "title" must be a non-empty string',
    ],
    [
      'missing paths and components',
      'openapi: 3.1.1\ninfo: { title: x, version: "1" }',
      'must contain "paths" or "components"',
    ],
    [
      'wrong root dialect',
      'openapi: 3.1.1\njsonSchemaDialect: other\ninfo: { title: x, version: "1" }\npaths: {}',
      'unsupported JSON Schema dialect',
    ],
    [
      'duplicate operation parameter',
      'openapi: 3.1.1\ninfo: { title: x, version: "1" }\npaths:\n  /x:\n    get:\n      parameters: [{ name: q, in: query, schema: { type: string } }, { name: q, in: query, schema: { type: string } }]\n      responses: { default: { description: ok } }',
      'duplicate operation parameter',
    ],
    [
      'path parameter without required',
      'openapi: 3.1.1\ninfo: { title: x, version: "1" }\npaths:\n  /x/{id}:\n    parameters: [{ name: id, in: path, schema: { type: string } }]\n    get: { responses: { default: { description: ok } } }',
      'path parameters must set "required: true"',
    ],
    [
      'bad status',
      'openapi: 3.1.1\ninfo: { title: x, version: "1" }\npaths:\n  /x:\n    get: { responses: { success: { description: ok } } }',
      'invalid response code',
    ],
  ])('rejects invalid readable fields: %s', (_label, source, message) => {
    expect(() => build(source)).toThrow(message);
  });
});
