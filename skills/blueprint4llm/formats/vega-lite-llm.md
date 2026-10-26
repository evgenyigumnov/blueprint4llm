# Vega-Lite v6 for blueprint4llm

Use this guide to write a Vega-Lite chart that the blueprint4llm renderer can validate and turn into a static SVG. Put one strict JSON object in a Markdown fence labelled `vega-lite` or `vegalite`.

## Specification shape

A Vega-Lite chart is a JSON object. A unit chart has a `mark` and usually an `encoding`; a layered chart puts multiple mark-and-encoding units in a top-level `layer` array. A chart can also set `title`, `description`, `data`, `transform`, `width`, `height`, and `config`. Layer children inherit data and top-level encodings where the Vega-Lite schema permits it. The schema also accepts `concat`, `hconcat`, `vconcat`, `facet` with `spec`, and `repeat` with `spec` compositions.

The `$schema` property is optional. If included, its value must be exactly `https://vega.github.io/schema/vega-lite/v6.json`. This is an identifier; the renderer validates against its installed package-local v6 schema and does not fetch a schema from that address. The current renderer uses Vega-Lite 6.5.0 and Vega 6.4.0.

Write JSON, not JSON with comments or trailing commas. The parser rejects duplicate keys, non-finite numbers, and non-object top-level values. The installed v6 schema then checks that fields such as `mark`, `encoding`, channel definitions, and transforms have valid shapes. If a schema field is wrong, the CLI reports its location in the JSON and Markdown source.

For an encoding, map channels such as `x`, `y`, `color`, and `text` to definitions. A field definition normally names a data `field` and its `type`: `quantitative` for numeric measures, `nominal` for categories, `ordinal` for ordered categories, or `temporal` for dates and times. Axis, legend, title, sort, scale, and aggregate settings belong in those definitions and must conform to the local v6 schema. Layering lets marks share the same data and chart coordinates; put shared channels on the layer and add only mark-specific channels to each layer when that keeps the chart clear.

## Embedded data

Keep the chart's data in the Markdown document. The usual form is `data` with a `values` array of records; each row must be a JSON object. For reusable inline tables, add a top-level `datasets` object whose entries are either arrays of records or objects with a `values` array, then refer to a table with `data: {"name": "tableName"}`. Named lookup sources must resolve to one of these inline datasets; a lookup may also contain its own inline `values`.

The renderer rejects `data.url`, URL-based lookup sources, unresolved dataset names, and generated data sources such as `sequence`, `graticule`, and `sphere`. A URL-looking string inside an ordinary record is just a value; it is not loaded. The combined input limit is 10,000 source rows across inline values and datasets. Each row must be an object.

## Supported charts, transforms, and limits

The static profile allows these marks: `bar`, `line`, `point`, `circle`, `square`, `area`, `rect`, `rule`, `tick`, `text`, `arc`, `trail`, `boxplot`, `errorbar`, and `errorband`. An `image` mark and other marks such as `geoshape` are rejected. The local v6 schema still validates the full shape of each accepted mark and its encodings.

The renderer allows these transform operations: `filter`, `calculate`, `aggregate`, `joinaggregate`, `bin`, `timeUnit`, `stack`, `fold`, and `lookup`. For example, `calculate` writes an expression result to a field named by `as`; `aggregate` groups rows and computes summaries; `joinaggregate` adds a grouped summary to each row; `fold` turns several named fields into key/value rows; and `lookup` joins fields from an inline source. Transform objects must also satisfy the v6 schema. The whole specification may contain at most 100 transforms.

Layered charts, concatenated charts, faceted charts, and repeated charts are supported by the local v6 schema. The static policy caps a chart at 100 expanded views after facet and repeat expansion. It also limits computed datasets to 50,000 rows, the rendered scenegraph to 50,000 items, either rendered side to 4,096 pixels, total rendered area to 16,000,000 pixels, and SVG output to 4 MiB. A Vega-Lite source block is limited to 256 KiB.

## Static output behavior

The renderer compiles the spec with package-local Vega and Vega-Lite browser bundles in an isolated page and serializes the result as SVG. Rendering uses the English US locale and UTC timezone. Unit and layered charts default to 480 by 300 pixels when their dimensions are not supplied directly or through view configuration. The default background is white and the default font is sans-serif; explicit chart and config styles are preserved.

The SVG is static. It has no interactive selections, bindings, or expression-driven parameters: `selection` is rejected, and a `params` entry containing `select`, `bind`, or `expr` is rejected. Constant-value parameters are accepted by policy. Tooltip encodings are accepted but produce a warning because the SVG has no interactive tooltips. `href` values and `href` encodings, geographic projections, automatic resize, and container sizing are unsupported. Network requests, external data, and external image, font, or CSS resources are blocked; local CSS fragment references are allowed.

## Complete example

This layered chart compares quarterly net bookings with total regional quota. The bars stack regions, a calculation derives net bookings after credits, and a layer-level aggregate builds the quarterly quota line. All values are embedded, so the chart can render without network access.

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
