# Vega-Lite v6 for blueprint4llm

Use this guide to author declarative charts and understand the boundary between the upstream Vega-Lite grammar and blueprint4llm's offline, static renderer profile. Put one strict JSON object in a Markdown fence labelled `vega-lite` or `vegalite`. The compatible layered example near the end can be checked with `blueprint4llm skills/blueprint4llm/formats/vega-lite-llm.md --check`.

## Upstream Vega-Lite v6: the declarative model

Vega-Lite describes a visualization rather than drawing it mark-by-mark at fixed coordinates. A specification declares the data, optional data transformations, a mark (the visual primitive), and encodings (which map fields to visual channels). Vega-Lite compiles that description into a lower-level Vega visualization. Scales translate data values into positions, colors, sizes, or other visual values; axes and legends make those mappings interpretable. The same grammar also supports composition, shared configuration, and interactive parameters.

A unit view usually has `data`, `mark`, and `encoding`. A larger view can compose unit views with `layer`, `facet`, `repeat`, `concat`, `hconcat`, or `vconcat`. Metadata such as `title` and `description`, transforms, dimensions, and `config` can be placed where the schema permits. Vega-Lite's schema defines which properties are valid and where they may occur.

### Data, types, and channels

Vega-Lite's data model is tabular: a dataset is a collection of records with named fields. Upstream specifications can embed `values`, load `url` data, refer to a named source supplied at runtime or through top-level `datasets`, and use generators such as `sequence`, `graticule`, or `sphere`. The project profile below narrows this to embedded object rows and inline named datasets.

A field's type communicates how its values should be interpreted. State it explicitly for clear, predictable charts:

| Type           | Meaning                                 | Common use                    |
| -------------- | --------------------------------------- | ----------------------------- |
| `quantitative` | Numeric magnitude on a continuous scale | revenue, duration, count      |
| `temporal`     | Dates or times                          | time series, event dates      |
| `nominal`      | Categories without an intrinsic order   | region, product, status       |
| `ordinal`      | Categories with a meaningful order      | severity, rank, ordered bands |

An encoding assigns a field, a constant visual `value`, or a constant data `datum` to a channel. Use a field definition with `field` and `type` when the visual should respond to data rows. Choose channels for the question, not just for decoration:

- `x` and `y` are the strongest channels for position and are usually easiest to compare accurately. Use time on an ordered axis; use a discrete axis for categories.
- `color` distinguishes series or groups. Use a qualitative palette for nominal categories and a sequential or diverging palette for ordered/numeric values; keep categories distinguishable and avoid using color alone for essential distinctions.
- `size`, `shape`, and `opacity` can add dimensions, but are less precise than position. Use them sparingly, especially when a chart already has many groups.
- `text` labels marks, `detail` separates groups without adding another visible legend, and `row`/`column` can organize small multiples. Use `tooltip` when an interactive host should reveal details on demand.

Field definitions can also specify aggregation, sorting, binning, time units, axis or legend settings, and scales. A field-level `aggregate` summarizes values before encoding; do not accidentally aggregate away distinctions that should remain separate. Use `value` for a fixed visual property, such as a constant label color; use `datum` when a fixed data value should still pass through a scale.

### Marks, scales, axes, and legends

Choose a mark that matches the comparison:

| Question                                    | Useful marks                               | Design note                                                                                           |
| ------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Compare amounts across categories           | `bar`, `tick`, or `point`                  | Bars emphasize magnitude from a baseline; points or ticks are compact for many categories.            |
| Show change over an ordered dimension       | `line` or `area`                           | Lines emphasize continuity; use area when filled magnitude is meaningful and stacking is intentional. |
| Show a relationship or distribution         | `point`, `circle`, or `boxplot`            | Scatter plots reveal association; boxplots summarize distributions.                                   |
| Show values in two categorical dimensions   | `rect`                                     | A color-encoded tile grid can make a heatmap; choose an ordered, legible color scale.                 |
| Add a reference, uncertainty, or annotation | `rule`, `errorbar`, `errorband`, or `text` | Keep reference marks visually subordinate to the data.                                                |

A scale maps a field's data domain to a visual range. Consider whether a quantitative scale should include zero, whether a log scale fits a multiplicative range, how a color domain should be bounded, and whether categorical colors remain distinct. Use axes for positional scales (titles, tick formatting, grid lines, and label density) and legends for non-positional encodings such as color, size, or shape. Clear titles and units help readers understand the encoded values; do not rely on a legend or color alone when direct labels or position would be clearer.

### Transformations

Transforms reshape or derive the rows used by a view; they are data operations, not visual styling. Place them where their scope is clear, and keep the operation order intentional. Common patterns include:

- `filter` removes rows that are not relevant to the question.
- `calculate` derives a field, such as a rate or net value, without changing the source records.
- `aggregate` groups rows and emits summary values; `joinaggregate` adds a grouped summary to each original row.
- `bin` groups continuous values into intervals; `timeUnit` derives calendar units such as month or year.
- `stack` computes positions for stacked marks; use stacking only when the parts and total are meaningful.
- `fold` reshapes several columns into key/value rows, which can make multiple measures share an encoding.
- `lookup` joins fields from a key-indexed data source.

The upstream grammar has additional transforms beyond these examples. A chart valid under the general Vega-Lite v6 grammar may still fall outside blueprint4llm's narrower transform policy; see the project profile below before relying on one.

### Composition and interaction

- **Layer** marks when they share a coordinate system and should be read together, such as bars with a target line. Put common encodings at the parent where possible; use distinct styles so overlaid marks remain legible.
- **Facet** partitions data by one or more fields into small multiples. It is useful for comparing groups while preserving a common visual design, but many distinct facet values create many views.
- **Repeat** applies one view template to a list of fields. Use it to compare several measures consistently; ensure the different scales are still comparable or explicitly explain why they are not.
- **Concatenation** (`concat`, `hconcat`, `vconcat`) places distinct views together. Use it when panels need different encodings or questions, and order panels to support the reading flow.

Interactive upstream Vega-Lite charts can declare named parameters for point/interval selections or bound input controls, then use those parameters in filters or conditional encodings for linked highlighting and brushing. The modern pattern is `params`; the older top-level `selection` form is legacy. Interaction is useful when a reader needs to explore detail, but provide a readable default state and do not make the main conclusion depend on an action the reader may not discover. This capability belongs to the upstream format; this project's SVG profile is static and does not implement interactive behavior.

## blueprint4llm renderer profile: accepted input and static limits

The project uses the package-local Vega-Lite **6.5.0** schema and browser bundle with Vega **6.4.0**, pinned in `package.json` and `package-lock.json`. This is the renderer's current v6 implementation, not a promise that every upstream Vega-Lite feature can be rendered here. The `$schema` property is optional; if present it must be exactly `https://vega.github.io/schema/vega-lite/v6.json`. That value is an identifier: validation uses the installed local schema and does not fetch the URL. The renderer applies its project policy and validates the specification against that schema; passing the upstream schema alone does not guarantee that a chart fits this static profile.

### JSON and embedded data

Write strict JSON: comments, trailing commas, duplicate object keys, non-finite numbers, and non-object top-level values are rejected. Schema and policy errors report a JSON location. Source blocks are limited to 256 KiB; the JSON parser also limits nesting to 64 levels and the syntax tree to 50,000 nodes.

Keep all chart data in the Markdown document. Use `data` with a `values` array of record objects, or define reusable inline tables in a top-level `datasets` object and refer to them with `data: {"name": "tableName"}`. Dataset entries must be arrays of record objects or objects containing a `values` array. Named lookup sources must resolve to one of these root datasets; a lookup can alternatively contain its own inline `values`. Each data row must be an object. The combined source-row limit is 10,000 across inline values, datasets, and inline lookup tables (the same array is counted once).

The renderer rejects `data.url`, URL-based lookup sources, unresolved dataset names, and generated sources such as `sequence`, `graticule`, and `sphere`. It does not load a URL-looking value found inside an ordinary data record.

### Supported marks, transforms, and composition

The static policy accepts these marks: `bar`, `line`, `point`, `circle`, `square`, `area`, `rect`, `rule`, `tick`, `text`, `arc`, `trail`, `boxplot`, `errorbar`, and `errorband`. `image` and other marks such as `geoshape` are rejected. The installed v6 schema still validates the full shape and properties of accepted mark definitions.

The static policy accepts these transform operations: `filter`, `calculate`, `aggregate`, `joinaggregate`, `bin`, `timeUnit`, `stack`, `fold`, and `lookup`. Other upstream operations (for example, `window`, `density`, or `regression`) are not in this project profile. Every transform object must also pass the v6 schema, and there may be no more than 100 transforms in the entire specification.

Layered, concatenated, faceted, and repeated views are supported by the local v6 schema and static policy. The renderer caps the specification at 100 expanded views after facet and repeat expansion. Design facets and repeats with this limit in mind; a field with many distinct values can exceed it even when the input table itself is small.

### Interactions and other unsupported features

The output is a static SVG, not a live Vega view. The legacy `selection` property is rejected. A `params` entry containing `select`, `bind`, or `expr` is rejected, so selection-driven filtering, brushing, and bound controls cannot be used. Constant-value parameters are accepted, but that does not make the result interactive. A tooltip encoding is accepted with a warning because the SVG cannot show interactive tooltips. Do not depend on hover, click, input binding, or other event-driven behavior.

Geographic `projection` is rejected, as are hyperlink-producing `href` properties and `href` encodings. A field named `href` in ordinary row data remains inert unless used by the rejected encoding. Automatic resize and `width`/`height` set to `"container"` are rejected. External data and network requests are blocked. External image, font, and CSS resources cannot load; CSS `url(#fragment)` references to local SVG definitions are allowed.

### Static output and resource ceilings

The renderer compiles the specification with its package-local Vega and Vega-Lite browser bundles in an isolated page, then serializes the result as SVG. Rendering uses the English-US locale and UTC timezone. Unit and layered charts default to 480 × 300 px when dimensions are not set directly or through view configuration. The default background is white and the default font is sans-serif; explicit chart and config styles are retained.

The local limits are:

- 10,000 inline source rows; 50,000 rows in any computed dataset; and 50,000 rendered scenegraph items.
- 100 transforms and 100 expanded views.
- A rendered side no larger than 4,096 px and a rendered area no larger than 16,000,000 px.
- SVG output no larger than 4 MiB; a source fence no larger than 256 KiB.

These are project safeguards, not Vega-Lite grammar limits. Keep a chart focused and compact even when it is technically under the ceilings.

## Complete compatible example

This layered chart compares quarterly net bookings with total regional quota. The bars stack regions, a calculation derives net bookings after credits, and a layer-level aggregate builds the quarterly quota line. All values are embedded, so the chart renders without network access.

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "title": "2025 Net Bookings by Region",
  "description": "Stacked bars show net bookings in thousands of dollars. The dashed line shows total regional quota for each quarter.",
  "width": 700,
  "height": 360,
  "data": {
    "values": [
      { "quarter": "Q1", "region": "North", "bookings": 410, "credits": 12, "quota": 390 },
      { "quarter": "Q1", "region": "Central", "bookings": 290, "credits": 8, "quota": 300 },
      { "quarter": "Q1", "region": "South", "bookings": 335, "credits": 10, "quota": 310 },
      { "quarter": "Q2", "region": "North", "bookings": 445, "credits": 15, "quota": 405 },
      { "quarter": "Q2", "region": "Central", "bookings": 315, "credits": 5, "quota": 310 },
      { "quarter": "Q2", "region": "South", "bookings": 360, "credits": 12, "quota": 325 },
      { "quarter": "Q3", "region": "North", "bookings": 470, "credits": 14, "quota": 425 },
      { "quarter": "Q3", "region": "Central", "bookings": 330, "credits": 7, "quota": 320 },
      { "quarter": "Q3", "region": "South", "bookings": 380, "credits": 10, "quota": 340 },
      { "quarter": "Q4", "region": "North", "bookings": 520, "credits": 18, "quota": 450 },
      { "quarter": "Q4", "region": "Central", "bookings": 365, "credits": 9, "quota": 335 },
      { "quarter": "Q4", "region": "South", "bookings": 405, "credits": 11, "quota": 360 }
    ]
  },
  "transform": [
    { "calculate": "datum.bookings - datum.credits", "as": "netBookings" }
  ],
  "layer": [
    {
      "mark": { "type": "bar", "cornerRadiusTopLeft": 3, "cornerRadiusTopRight": 3 },
      "encoding": {
        "x": {
          "field": "quarter",
          "type": "ordinal",
          "sort": ["Q1", "Q2", "Q3", "Q4"],
          "axis": { "title": "Fiscal quarter", "labelAngle": 0 }
        },
        "y": {
          "field": "netBookings",
          "type": "quantitative",
          "aggregate": "sum",
          "title": "Net bookings and quota ($k)",
          "axis": { "format": "$,.0f", "grid": true }
        },
        "color": { "field": "region", "type": "nominal", "title": "Sales region" }
      }
    },
    {
      "transform": [
        {
          "aggregate": [
            { "op": "sum", "field": "quota", "as": "quarterQuota" }
          ],
          "groupby": ["quarter"]
        }
      ],
      "mark": {
        "type": "line",
        "color": "#b45309",
        "strokeDash": [7, 4],
        "point": { "filled": true, "size": 75 }
      },
      "encoding": {
        "x": {
          "field": "quarter",
          "type": "ordinal",
          "sort": ["Q1", "Q2", "Q3", "Q4"],
          "axis": { "title": "Fiscal quarter", "labelAngle": 0 }
        },
        "y": {
          "field": "quarterQuota",
          "type": "quantitative",
          "title": "Net bookings and quota ($k)",
          "axis": { "format": "$,.0f", "grid": true }
        }
      }
    }
  ]
}
```

## References and verification

**Official Vega-Lite sources; reviewed 2026-10-26:**

- [Vega-Lite documentation](https://vega.github.io/vega-lite/docs/) and [specification](https://vega.github.io/vega-lite/docs/spec.html)
- [Data](https://vega.github.io/vega-lite/docs/data.html), [encoding](https://vega.github.io/vega-lite/docs/encoding.html), [marks](https://vega.github.io/vega-lite/docs/mark.html), [scales](https://vega.github.io/vega-lite/docs/scale.html), [axes](https://vega.github.io/vega-lite/docs/axis.html), and [legends](https://vega.github.io/vega-lite/docs/legend.html)
- [Transforms](https://vega.github.io/vega-lite/docs/transform.html), [layering](https://vega.github.io/vega-lite/docs/layer.html), [faceting](https://vega.github.io/vega-lite/docs/facet.html), [repetition](https://vega.github.io/vega-lite/docs/repeat.html), and [concatenation](https://vega.github.io/vega-lite/docs/concat.html)
- [Parameters](https://vega.github.io/vega-lite/docs/parameter.html) and [selections](https://vega.github.io/vega-lite/docs/selection.html)

The project-profile details above are grounded in `src/renderers/vega-lite.ts`, `vega-lite-source.ts`, `vega-lite-schema.ts`, `vega-lite-policy.ts`, `vega-lite-data.ts`, `vega-lite-style.ts`, and `vega-lite-page.ts`, with focused coverage in `tests/vega-lite-source.test.ts`, `vega-lite-schema.test.ts`, `vega-lite-policy.test.ts`, and `vega-lite-renderer.test.ts`. Package pins are recorded in `package.json` and `package-lock.json`.
