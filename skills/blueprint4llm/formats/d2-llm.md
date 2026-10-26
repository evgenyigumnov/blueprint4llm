# D2

**Reviewed:** 2026-10-26

## Purpose and mental model

D2 (Declarative Diagramming) is a text language for describing a diagram, not a list of drawing coordinates. A source document declares named objects, their relationships, and optional presentation attributes; a layout engine computes their positions and routes. The resulting model is a graph: objects can be arranged in nested containers, while connections can cross container boundaries.

D2's compact syntax is map-like. Write one declaration per line, or separate entries with semicolons in a compact inline map. A key identifies an object or attribute; a value can give it a label, shape, or other property. An object's key is its stable reference and, by default, its visible label. Use `key: Human-readable label` to keep a short ID while displaying clearer text. Keys are case-insensitive. A nested map defines children, and dotted paths refer to nested objects or attributes without reopening each map. These forms express the same hierarchy:

```text
cloud: { api: { shape: hexagon } }
cloud.api.shape: hexagon
```

A connection can create an undeclared endpoint, but explicitly declaring important objects first makes labels, containment, and the diagram's intent easier to review. Outside sequence diagrams, declaration order does not dictate layout order.

## Core syntax and concepts

### Objects, containers, and attributes

A bare key declares a default rectangle. A value after a colon sets its label; `shape` chooses a built-in shape such as `cylinder`, `person`, `queue`, `diamond`, or `cloud`. A map of child objects makes its parent a container. Use nesting when containment is meaningful—such as services inside a system boundary—or use dotted paths when a short reference is clearer than reopening a deep map. The `_` key refers to a container's parent when a child needs to connect outside its container.

Set attributes inside the object's map or with dotted paths. For example, `database: { shape: cylinder; style.fill: "#dbeafe" }` declares a cylinder with a fill. `direction: right` sets a global flow direction (`up`, `down`, `left`, or `right`). A `classes` map is useful for reusable styles: define `classes: { primary: { style.fill: "#dbeafe" } }`, then assign it with `api.class: primary`. Classes can be applied to objects or connections; override individual attributes where needed. Prefer a few consistent style classes to styling every node independently.

### Connections

Hyphens and arrows between object keys declare relationships; labels follow a colon. D2 supports `->` (source to target), `<-` (target to source), `<->` (both directions), and `--` (undirected). Connections may be chained, and repeated declarations create additional connections rather than replacing the first. Use the key/path, not the displayed label, as an endpoint. For example: `browser -> api: HTTPS`.

### Specialized diagram objects

Choose the data model that makes the relationship explicit, rather than imitating it with generic boxes:

- **SQL tables / ER diagrams:** set `shape: sql_table`. Each child key is a row/column; its value is the column type. A row's `constraint` can be `primary_key`, `foreign_key`, `unique`, or another SQL constraint; recognized constraints are abbreviated in the drawing. Connect table columns using paths such as `orders.customer_id -> customers.id`. ELK and TALA can route such links to the exact row; Dagre does not promise that precision.
- **UML classes:** set `shape: class`. Child keys describe fields or methods: a field's value is its type, and a key containing `(` is a method whose value is its return type. A method without a value returns `void`. Prefix members with `+`, `-`, or `#` for public, private, or protected visibility. Use classes for static structure and associations, not for a time-ordered exchange.
- **Sequence diagrams:** set `shape: sequence_diagram` on an object and declare participants and messages inside it using ordinary object and connection syntax. Messages are ordered by their source declaration order, and actors are shared throughout that sequence diagram. Nested objects can represent spans, notes, and groups. Use a sequence diagram for who sends what, and in what order; do not try to encode temporal ordering with ordinary graph edges.

These special objects remain part of D2's object/map model: they can be nested, labeled, connected, and styled. A SQL table describes columns, a class describes members, and a sequence diagram describes ordered interaction; they are distinct from simply choosing a visual shape.

## Idiomatic document pattern and layout choices

A readable source usually declares global direction first, then top-level system boundaries and their contents, then connections, with style classes near the objects they affect. Keep names short and stable, labels informative, and nesting aligned with real ownership or boundaries. Make high-value cross-container connections explicit. Use `direction` to establish the main reading flow; the layout engine handles positions and edge routes rather than manually placing objects.

Choose layout by graph character and the local rendering profile below:

- **Dagre** is the D2 default: fast and suited to layered/hierarchical flows. It can produce curved multi-segment routes and its hierarchical model has limitations around container relationships.
- **ELK** is also hierarchical, with orthogonal routes, active upstream development, better native container routing, and precise SQL-row connections. It may use more bends and is less symmetry-oriented. D2's upstream CLI can expose additional ELK algorithms, but those extra controls are not part of this adapter's configuration.
- **TALA** is an upstream D2 layout engine designed for software architecture diagrams, including container-aware placement. It is not available in this project's profile.

Try the default for a simple flow. Consider ELK for a contained architecture or when orthogonal edges and SQL-column endpoints matter. A layout engine affects arrangement, not the meaning or syntax of objects; switch diagram type (for example, to a sequence diagram) when the relationship itself is temporal rather than topological.

## Practical example

This single static board combines a containment hierarchy, a SQL table, a UML class, labeled connections, and an ordered sequence. It uses only syntax accepted by blueprint4llm:

```d2
direction: right
vars: { d2-config: { layout-engine: elk; theme-id: 0 } }

client: Web client { web: Browser }
service: Order service {
  orders: {
    shape: sql_table
    id: int { constraint: primary_key }
    customer_id: int
  }
  Order: {
    shape: class
    +id: string
    +confirm(): void
  }
}
flow: {
  shape: sequence_diagram
  buyer: Buyer
  api: Order API
  buyer -> api: submit order
  api -> buyer: confirmation
}

client.web -> service: HTTPS
service.orders -> service.Order: creates
```

## blueprint4llm compatibility profile (not the full D2 feature set)

The D2 language and standalone D2 toolchain support features that this integration deliberately rejects. For Markdown `d2` fences, the local adapter is `@d2lang/d2@0.1.34` (locked in `package-lock.json`) and emits a validated, static SVG. The following are the project's actual constraints, not general D2 syntax rules:

- **One static board per block.** `layers`, `scenarios`, and `steps` are valid upstream composition concepts but are rejected; put one diagram board in each fence. The adapter compiles only `index.d2` in a one-file virtual filesystem, so imports needing other files cannot resolve.
- **Limited D2 config.** Fence metadata is rejected. In source, only `vars.d2-config` may be supplied, with `layout-engine` set at most once to `dagre` or `elk`, and/or `theme-id` set at most once to `0`. Dagre is the default. ELK is recompiled with ELK when selected. TALA is a valid upstream engine, but is not accepted here.
- **Fixed static render settings.** The adapter uses light theme `0`, bundled Noto Sans regular/bold fonts, no sketch mode, and fixed SVG padding/centering options. The policy rejects nonzero themes, dark-theme IDs or overrides, sketch mode, animation intervals, render targets, forced appendices, and ASCII output; the adapter also fixes its own render options. These are valid upstream rendering capabilities, but this is a static SVG profile, not the full interactive D2 experience.
- **Unsupported source features.** Icons/image objects, clickable `link`s, `tooltip`s, Markdown/LaTeX labels (`language`), and animated diagrams (`style.animated: true`) are rejected. They are upstream D2 features, not invalid D2 syntax. Use plain-text labels and static shapes/connections instead.
- Source is limited to 256 KiB. The renderer runs the bundled WebAssembly engine with a 30-second job timeout; it does not fetch D2 resources from the network.

These restrictions are enforced by `src/renderers/d2.ts`, `src/renderers/d2-policy.ts`, and `src/renderers/d2-runner.ts`. The supported and rejected settings, special objects, features, and board types are covered by `tests/d2-policy.test.ts` and `tests/d2-renderer.test.ts`.

## Official references

- [D2 introduction](https://www.d2lang.com/tour/intro/)
- [Shapes](https://d2lang.com/tour/shapes/), [connections](https://d2lang.com/tour/connections/), and [containers](https://d2lang.com/tour/containers/)
- [Styles](https://d2lang.com/tour/style/) and [classes](https://d2lang.com/tour/classes/)
- [Text and code](https://d2lang.com/tour/text/), [icons and images](https://d2lang.com/tour/icons/), and [interactive links and tooltips](https://d2lang.com/tour/interactive/)
- [SQL tables](https://d2lang.com/tour/sql-tables/), [UML classes](https://d2lang.com/tour/uml-classes/), and [sequence diagrams](https://d2lang.com/tour/sequence-diagrams/)
- [Themes](https://d2lang.com/tour/themes/), [sketch mode](https://d2lang.com/tour/sketch/), [layout overview](https://d2lang.com/tour/layouts/), [Dagre](https://d2lang.com/tour/dagre/), [ELK](https://d2lang.com/tour/elk/), [TALA](https://d2lang.com/tour/tala/), [composition](https://d2lang.com/tour/composition/), and [imports](https://d2lang.com/tour/imports/)
- [D2.js package and API](https://github.com/terrastruct/d2/tree/master/d2js/js) (the local dependency is pinned to 0.1.34)
