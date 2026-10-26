# Format guide map and exercises

Choose a guide by the kind of information you need to express. Each guide explains the upstream format and then gives the `blueprint4llm` compatibility profile; read the profile before writing a block.

## Map

| Format family             | Choose it for                                                                                                                                            | Guide                                 | Official primary references                                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Diagram language          | Text-first diagrams with objects, containers, and relationships; use D2's specialized table, class, and sequence objects when their models fit.          | [D2](d2-llm.md)                       | [D2 Tour](https://www.d2lang.com/tour/intro/)                                                                                                        |
| Diagram language          | A diagram whose question matches one of Mermaid's distinct grammars, such as flowchart, sequence, class, state, or ER.                                   | [Mermaid](mermaid-llm.md)             | [Mermaid Diagram Syntax](https://mermaid.js.org/intro/syntax-reference.html)                                                                         |
| Diagram language          | A graph where DOT structure and an engine-specific automatic layout are useful; use `graph` for undirected edges and `digraph` for directed edges.       | [Graphviz DOT](graphviz-llm.md)       | [DOT Language](https://www.graphviz.org/content/dot-language/), [Graphviz documentation](https://graphviz.org/documentation/)                        |
| Diagram language          | UML-style interaction, type structure, lifecycle, workflow, or logical/physical architecture diagrams.                                                   | [PlantUML](plantuml-llm.md)           | [PlantUML starting guide](https://plantuml.com/starting), [Language Reference Guide](https://plantuml.com/guide)                                     |
| Editable diagram document | A native, editable multi-page diagram with draw.io cells, geometry, and styles. The project guide also defines a separate structural JSON graph profile. | [draw.io](drawio-llm.md)              | [File Format](https://github.com/jgraph/drawio/wiki/File-Format), [AI diagram generation](https://www.drawio.com/docs/reference/diagram-generation/) |
| Editable canvas document  | A scene of positioned sketch elements, text, and bindings. Saved-file JSON and clipboard JSON are different envelopes.                                   | [Excalidraw](excalidraw-llm.md)       | [Excalidraw JSON Schema](https://docs.excalidraw.com/docs/codebase/json-schema)                                                                      |
| Editable design document  | A hierarchical `.pen` canvas with frames, groups, shapes, text, and layout.                                                                              | [Pencil](pencil-llm.md)               | [The `.pen` Format](https://docs.pencil.dev/for-developers/the-pen-format)                                                                           |
| Wireframe document        | A low-fidelity screen sketch built from Mockups 3 controls; Mockups JSON, BMPR projects, and legacy BMML are distinct formats.                           | [Balsamiq Mockups 3](balsamiq-llm.md) | [Mockups 3 for Desktop Documentation](https://balsamiq.com/assets/product/mockups3fordesktop/balsamiq-mockups-3-for-desktop-documentation.pdf)       |
| Design API data           | A Figma REST file-response excerpt or a design URL selecting a frame for authenticated SVG export.                                                       | [Figma](figma-llm.md)                 | [Figma REST API](https://developers.figma.com/docs/rest-api/), [File nodes](https://developers.figma.com/docs/rest-api/files/)                       |
| API description           | A versioned HTTP API contract with paths, operations, parameters, schemas, references, and security semantics.                                           | [OpenAPI](openapi-llm.md)             | [OpenAPI Specification 3.1.1](https://spec.openapis.org/oas/v3.1.1.html), [version index](https://spec.openapis.org/oas/)                            |
| Data visualization        | Declarative charts that map data fields or constants to marks, channels, scales, and composed views.                                                     | [Vega-Lite](vega-lite-llm.md)         | [Vega-Lite documentation](https://vega.github.io/vega-lite/docs/), [view specification](https://vega.github.io/vega-lite/docs/spec.html)             |
| Data visualization        | An option tree of chart series and visual components, with data and coordinate systems suited to the chart family.                                       | [ECharts](echarts-llm.md)             | [ECharts option reference](https://echarts.apache.org/en/option.html), [ECharts Handbook](https://echarts.apache.org/handbook/en/)                   |

These guides describe different upstream formats and different local integrations. Upstream syntax or a feature documented by a library does not by itself mean the `blueprint4llm` renderer accepts or displays it. The selected guide identifies the pinned library or local parser, accepted input, static output, and limits. For ordinary authoring, use that guide without loading the other format guides or browsing the web.

## Exercises

Answer the understanding question from the linked guide's upstream model and local profile. For each authoring question, produce a small fenced block that follows the guide's local profile; use the guide's validation command to check it.

### D2

- **Understand / choose:** A diagram needs to show messages in time order. Why is a `sequence_diagram` object a better model than ordinary D2 graph edges, and how does its ordering work?
- **Author:** Write a `d2` block with `direction: right`, a `service` container holding `api` and `database`, and a labeled connection from `api` to `database`.

### Mermaid

- **Understand / choose:** Choose between a flowchart and a sequence diagram for a client request, server response, and an optional retry. Which grammar expresses participants and ordered messages directly?
- **Author:** Write a `mermaid` block with a `sequenceDiagram`, aliased client and API participants, a request and response, and an `opt` fragment for a retry.

### Graphviz DOT

- **Understand / choose:** For an undirected network, which graph declaration and edge operator are required? What does naming a subgraph `cluster_*` mean, and is that name a formal DOT construct?
- **Author:** Write one `digraph` with `rankdir=LR`, a `cluster_ingress` containing two nodes, an external node, and a labeled directed edge from one clustered node to the external node.

### PlantUML

- **Understand / choose:** Choose a class diagram or deployment diagram to show which runtime host runs an artifact. What relationship does each diagram family model?
- **Author:** Write a complete `plantuml` sequence diagram with an actor, an API participant, a request, and a response.

### draw.io

- **Understand / choose:** When should an author use a native draw.io XML file, and when should they use the project's `drawio` structural JSON fence? Which one preserves native coordinates and styles?
- **Author:** Write a `drawio page=main direction=LR` block with one page, a layer, two labeled nodes parented to that layer, and an edge between the nodes.

### Excalidraw

- **Understand / choose:** How does a saved Excalidraw scene JSON envelope differ from clipboard JSON, and which envelope does the local renderer require?
- **Author:** Write an `excalidraw` JSON scene at document version 2 with two rectangles and one arrow ending in an arrowhead. Give every element unique IDs and explicit geometry; give the arrow at least two points.

### Pencil

- **Understand / choose:** The upstream `.pen` format supports reusable components and references. Which local-profile choices keep a design self-contained when those features are not accepted?
- **Author:** Write a `pencil` block with version `2.21`, a vertical frame with padding and gap, and two explicitly sized children: a solid-filled rectangle and text.

### Balsamiq Mockups 3

- **Understand / choose:** Which artifact should be shared to preserve an entire desktop project with its assets and Symbols: Mockups JSON or BMPR? What is BMML used for?
- **Author:** Write a `balsamiq` JSON mockup with a 640-by-400 canvas, a `Title`, `TextInput`, and `Button`. Give each control a unique ID, bounds, z-order, and concise text.

### Figma

- **Understand / choose:** Compare Figma JSON mode with URL mode. Which is rendered locally, and which mode calls the authenticated SVG export path?
- **Author:** Write a local `figma` JSON response with a `DOCUMENT`, one `CANVAS`, and one top-level `FRAME` containing a `TEXT` node. Give each node a unique ID in `number:number` form and absolute bounds; give the text characters, style, and a solid fill.

### OpenAPI

- **Understand / choose:** How does an OpenAPI security requirement differ from a server URL, and which of those fields does the local static renderer display?
- **Author:** Write an `openapi` 3.1.1 YAML block for `GET /widgets/{widgetId}` with a required path parameter and a quoted `'200'` JSON response whose schema references `#/components/schemas/Widget`; define that schema with a string `id` property.

### Vega-Lite

- **Understand / choose:** For category totals, what should the mark and `x`/`y` encodings represent? Explain why an encoding with `field` and `type` differs from a constant `value` or `datum`.
- **Author:** Write a `vega-lite` JSON block with three inline records and a bar chart encoding a nominal category on `x` and a quantitative amount on `y`.

### ECharts

- **Understand / choose:** Which ECharts chart families use Cartesian axes, and why would a pie series not use `xAxis` and `yAxis`? Name one interactive component that the local static profile excludes.
- **Author:** Write an `echarts` JSON option with explicit grid margins and `containLabel: false`, a category `xAxis` with three categories, a value `yAxis`, and one bar series with three inline values.
