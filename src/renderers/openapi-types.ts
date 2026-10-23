export type OpenApiValue = string | number | boolean | null | OpenApiObject | OpenApiValue[];

/** Ordered map representation that does not interpret special object keys. */
export type OpenApiObject = Map<string, OpenApiValue>;

export interface OpenApiPosition {
  line: number;
  column: number;
}

export type OpenApiSourceFormat = 'json' | 'yaml';

/** Parsed source tree and positions indexed by JSON Pointer fragment. */
export interface OpenApiSource {
  value: OpenApiValue;
  positions: ReadonlyMap<string, OpenApiPosition>;
  format: OpenApiSourceFormat;
}

export type OpenApiReferenceKind =
  'schema' | 'parameter' | 'request body' | 'response' | 'header' | 'path item';

export interface OpenApiWarning {
  message: string;
  summary: string;
  line?: number;
  column?: number;
}

export interface ApiDocument {
  title: string;
  version: string;
  positions: ReadonlyMap<string, OpenApiPosition>;
  description?: string;
  operations: ApiOperation[];
  schemas: ApiNamedSchema[];
  warnings: OpenApiWarning[];
}

export interface ApiNamedSchema {
  name: string;
  pointer: string;
  schema: ApiSchema;
}

export interface ApiOperation {
  method: string;
  path: string;
  pointer: string;
  summary?: string;
  description?: string;
  operationId?: string;
  tags: string[];
  deprecated: boolean;
  parameters: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses: ApiResponse[];
}

export interface ApiParameter {
  name: string;
  in: string;
  required: boolean;
  description?: string;
  pointer: string;
  schema?: ApiSchema;
  content: ApiMediaType[];
}

export interface ApiRequestBody {
  required: boolean;
  description?: string;
  pointer: string;
  content: ApiMediaType[];
}

export interface ApiResponse {
  status: string;
  description: string;
  pointer: string;
  content: ApiMediaType[];
  headers: ApiParameter[];
}

export interface ApiMediaType {
  mediaType: string;
  pointer: string;
  schema?: ApiSchema;
}

export interface ApiSchema {
  pointer: string;
  booleanSchema?: boolean;
  type?: string | string[];
  format?: string;
  description?: string;
  required: string[];
  properties: ApiSchemaProperty[];
  items?: ApiSchema;
  additionalProperties?: boolean | ApiSchema;
  enum?: OpenApiValue[];
  compositions: ApiSchemaComposition[];
  readOnly: boolean;
  writeOnly: boolean;
  ref?: ApiSchemaReference;
}

export interface ApiSchemaProperty {
  name: string;
  pointer: string;
  schema: ApiSchema;
}

export interface ApiSchemaComposition {
  kind: 'allOf' | 'oneOf' | 'anyOf';
  schemas: ApiSchema[];
}

export interface ApiSchemaReference {
  reference: string;
  targetPointer: string;
  targetName?: string;
}

export interface ApiLayoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
}

export interface ApiLayoutText {
  x: number;
  y: number;
  fontSize: number;
  color: string;
  text: string;
  weight?: number;
}
