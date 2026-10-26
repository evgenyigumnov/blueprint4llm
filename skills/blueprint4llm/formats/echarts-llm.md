# ECharts static chart guide

Use an `echarts` fenced block for a static chart that the local blueprint4llm renderer can validate and render as SVG. The block body is a strict JSON object containing an ECharts option in the `echarts-static-profile-v1` profile. The profile is intentionally smaller than the full ECharts option API.

## Upstream ECharts 6: the option tree, components, and interaction model

> This section describes what upstream Apache ECharts (v6) can do. It is **not** part of the blueprint4llm static profile. The renderer below accepts only a small subset of this model. Anything marked “upstream” here that is not listed in the local tables is outside the project’s pinned, offline profile.

ECharts configures a chart with a hierarchical `option` object. Its root names components and a `series` list; nested objects hold their settings. ECharts separates three ideas that matter for authoring:

- **Components** are top-level option sections for chart context, layout, data, or controls: `title`, `legend`, `tooltip`, `toolbox`, `dataZoom`, `visualMap`, `timeline`, `grid`, `geo`, `parallel`, and `dataset` are examples. Many component options accept either one object or an array. Components such as a title and legend can render as static visuals; controls such as data zoom become interactive in a browser host.
- **Series** are the data views — bars, lines, pie slices, scatter points, heatmaps, radar polygons, gauges, trees, maps, graphs, funnels, sankeys, and dozens more. A chart can combine multiple series; some use coordinate systems, while others have a standalone layout. Supported placement varies by series type.
- **Coordinate systems** define how values become screen positions. ECharts includes the Cartesian `grid` (`cartesian2d`), `polar`, `geo`, `singleAxis`, `radar`, `parallel`, and `calendar` systems; ECharts 6 adds `matrix` for arranging charts and components in cells. Some series use a standalone layout rather than axes, and supported coordinate systems vary by series type. Three-dimensional coordinate systems are available through the separate `echarts-gl` extension.

### Series versus components

In upstream ECharts every series is also a component, but they play different roles. Components such as `title`, `legend`, and axes can supply static visual context; `tooltip`, `toolbox`, and `dataZoom` can provide controls in a browser host. A chart can have zero or more components but must have at least one series to draw. Series carry their own `type` (e.g. `'line'`) plus per-series styling (`itemStyle`, `lineStyle`, `areaStyle`, `label`, `emphasis`). Components sit alongside `series` at the option root; they are never nested inside a series.

### Coordinate systems and chart families

Upstream ECharts ships many chart families in `echarts/charts`; the coordinate system and layout depend on the series type:

- **Cartesian (`cartesian2d`)**: bar, line, scatter, and heatmap commonly use `xAxis`/`yAxis` and share a `grid`; some upstream series can also use other supported coordinate systems.
- **Other coordinate-based families**: radar uses `radar.indicator`; parallel charts use parallel axes; polar, single-axis, geo, calendar, and matrix support their own layouts. Map series need registered map data or a geographic base.
- **Other chart families**: pie and gauge commonly use standalone layouts; tree, treemap, sunburst, graph, funnel, sankey, and chord each have type-specific data and layout. These families do not all use Cartesian axes.

ECharts 6 adds a chord series, scatter jittering, and the matrix coordinate system. Choosing a chart is first a choice of data structure and visual task: compare ordered values with a line or bar, show part-to-whole with pie or hierarchical data, correlate measures with scatter or heatmap, compare bounded scores with radar, report one bounded metric with gauge, or show location data with geo/map.

### Dataset and the encode model

Upstream ECharts can separate data from series with a root `dataset`. The dataset holds `dimensions` and `source`; each series then maps dimensions to channels through `encode` (`x`, `y`, `value`, `itemName`, or arrays of them). This lets many series share one table. A dataset can also declare one or more `transform` steps before a series reads the result. The official transform guide covers filtering and sorting and describes registered transforms such as aggregation, regression, boxplot, and clustering; availability can depend on which transform is registered and loaded.

### Visual channels and layout

Upstream ECharts maps data to visual channels: position (`x`, `y`), color (including linear/radial gradients and `visualMap` ranges), size, shape, opacity, and label. Layout is controlled by components such as `grid`, `title`, `legend`, and axis configuration (`nameLocation`, `nameGap`, `splitNumber`, `boundaryGap`). Interaction — tooltips, toolbox buttons, data-zoom sliders, animation easing, emphasis highlight, and drag — lives in the live renderer.

### Interaction lifecycle (upstream only)

In a browser host ECharts wires up an event/action lifecycle: user input fires events (`click`, `mouseover`, `legendselectchanged`, `datazoom`, etc.), components listen via `chart.on(...)`, and actions can be dispatched with `chart.dispatchAction(...)`. Emphasis highlights hovered data, a tooltip reveals details, and data zoom changes the visible range. ECharts server-side rendering can emit SVG and supports limited initial animation or highlighting; full mouse-driven interaction requires a browser runtime. blueprint4llm renders a **static** SVG and disables animation, interaction, emphasis, and selection (see below).

### Choosing a design (upstream guidance)

- Compare ordered quantities over time → Cartesian line or bar with an axis; stack bars for part-of-a-total.
- Show part-to-whole → pie/rose chart (limit slices) or sunburst/treemap for many nested categories.
- Correlate two measures → scatter; correlate three on a grid → heatmap.
- Score several dimensions against fixed bounds → radar.
- Report a single bounded metric → gauge.
- Show location distribution → geo/map with a GeoJSON base layer.

## blueprint4llm renderer profile: accepted input and static limits

> The local renderer is a pinned, offline subset of the model above. It accepts only the fields listed in this guide and renders one static SVG per block. Upstream components such as `tooltip`, `toolbox`, `dataZoom`, `timeline`, `geo`/map, `parallel`, dataset `transform`, remote sources, and formatter functions are all outside it.

## Block syntax and dimensions

Put the option object directly inside the fence. The only supported fence metadata is `width=<integer>` and `height=<integer>`. Either value may appear first. Each defaults to 800 by 450 pixels. Each must be from 240 through 1600. Do not put `width` or `height` in the JSON object.

```echarts width=960 height=540
{
  "series": [
    { "type": "pie", "data": [{ "name": "Approved", "value": 7 }] }
  ]
}
```

The body must use strict JSON: quote property names and strings with double quotes; do not use comments, trailing commas, duplicate keys, functions, `NaN`, or infinity. The top value must be an object. Unknown fields and fields outside the profile cause validation errors.

The parser limits a block to 256 KiB, each line to 4 KiB, JSON nesting to 32 levels, and 100,000 JSON syntax-tree nodes. Keep charts within 20 series and 10,000 total inline points or dataset rows. A dataset can declare up to 32 dimensions.

Rendered SVG is limited to 4 MiB, and a rendering worker is stopped after 10 seconds. Blocks that exceed either limit fail instead of producing a chart.

## Root option fields

These are the only accepted root keys:

| Field             | Shape and use                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `title`           | One object. Text, subtext, placement, padding, background, border, and text-style fields are listed below.                     |
| `legend`          | One object. A static plain legend with placement, orientation, entries, text style, and formatter. Selection must be disabled. |
| `grid`            | One object or an array of 1–4 objects. Cartesian plot area and margins. `containLabel` must be `false`; set explicit margins.  |
| `xAxis`, `yAxis`  | One axis object or an array of 1–4 objects. Required for Cartesian series.                                                     |
| `radar`           | One radar coordinate object. Required for radar series and otherwise disallowed.                                               |
| `visualMap`       | One continuous visual map. Required for heatmap series and otherwise disallowed.                                               |
| `dataset`         | One embedded dataset object. Only `dimensions` and `source` are accepted.                                                      |
| `series`          | Required non-empty array of 1–20 series. Every series needs a supported `type` and embedded data or a dataset encoding.        |
| `color`           | Array of 1–32 supported colors or linear gradients.                                                                            |
| `backgroundColor` | Supported color or linear gradient. If omitted, the canvas is white.                                                           |
| `textStyle`       | Root text-style defaults. The renderer supplies its local font family.                                                         |
| `animation`       | Boolean. Animation is disabled in the SVG output.                                                                              |
| `silent`          | Boolean. Interaction is disabled in the SVG output.                                                                            |

The allowed color syntax is a small CSS subset: hex colors, `rgb()`/`rgba()`, `hsl()`/`hsla()`, and a fixed set of common color names. A linear gradient uses `type: "linear"`, numeric `x`, `y`, `x2`, and `y2` coordinates from 0 to 1, and 2–8 `{ "offset", "color" }` stops. Do not assume browser CSS color functions or names outside that subset will pass.

### Nested option fields

Every object below rejects keys not listed for it. The names are exact.

| Object                                               | Accepted fields                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`                                              | `show`, `text`, `subtext`, `left`, `top`, `right`, `bottom`, `itemGap`, `padding`, `backgroundColor`, `borderColor`, `borderWidth`, `borderRadius`, `textStyle`, `subtextStyle`                                                                                                                    |
| `legend`                                             | `show`, `type`, `orient`, `left`, `top`, `right`, `bottom`, `width`, `height`, `itemWidth`, `itemHeight`, `itemGap`, `icon`, `data`, `formatter`, `textStyle`, `selectedMode`                                                                                                                      |
| `grid[]`                                             | `show`, `left`, `right`, `top`, `bottom`, `width`, `height`, `containLabel`, `backgroundColor`, `borderColor`, `borderWidth`, `shadowBlur`, `shadowColor`                                                                                                                                          |
| `xAxis[]`, `yAxis[]`                                 | `type`, `name`, `show`, `position`, `offset`, `nameLocation`, `nameGap`, `nameRotate`, `nameTextStyle`, `inverse`, `boundaryGap`, `min`, `max`, `scale`, `splitNumber`, `minInterval`, `maxInterval`, `interval`, `logBase`, `data`, `axisLine`, `axisTick`, `axisLabel`, `splitLine`, `splitArea` |
| `radar`                                              | `shape`, `radius`, `center`, `startAngle`, `splitNumber`, `name`, `axisLine`, `splitLine`, `splitArea`, `indicator`                                                                                                                                                                                |
| `visualMap`                                          | `type`, `min`, `max`, `dimension`, `orient`, `left`, `top`, `right`, `bottom`, `itemWidth`, `itemHeight`, `precision`, `calculable`, `realtime`, `text`, `inRange`, `outOfRange`, `textStyle`, `inverse`, `show`                                                                                   |
| `textStyle`, `title.textStyle`, `title.subtextStyle` | `color`, `fontStyle`, `fontWeight`, `fontSize`, `fontFamily`, `lineHeight`, `width`, `overflow`, `align`, `verticalAlign`, `backgroundColor`, `borderColor`, `borderWidth`, `borderRadius`, `padding`                                                                                              |
| `axisLine`                                           | `show`, `onZero`, `lineStyle`                                                                                                                                                                                                                                                                      |
| `axisTick`                                           | `show`, `alignWithLabel`, `inside`, `length`, `lineStyle`                                                                                                                                                                                                                                          |
| `splitLine`                                          | `show`, `interval`, `lineStyle`                                                                                                                                                                                                                                                                    |
| `splitArea`                                          | `show`, `interval`, `areaStyle`                                                                                                                                                                                                                                                                    |
| `axisLabel`                                          | `show`, `interval`, `rotate`, `margin`, `formatter`, `color`, `fontSize`, `fontFamily`, `fontWeight`, `align`, `verticalAlign`, `hideOverlap`, `showMinLabel`, `showMaxLabel`                                                                                                                      |
| `radar.name`                                         | `show`, `formatter`, `textStyle`                                                                                                                                                                                                                                                                   |
| `visualMap.inRange`                                  | `color` (2–16 colors)                                                                                                                                                                                                                                                                              |
| `visualMap.outOfRange`                               | `color` (1–16 colors)                                                                                                                                                                                                                                                                              |
| `itemStyle`                                          | `color`, `borderColor`, `borderWidth`, `borderType`, `borderRadius`, `opacity`, `shadowBlur`, `shadowColor`, `shadowOffsetX`, `shadowOffsetY`                                                                                                                                                      |
| `lineStyle`                                          | `color`, `width`, `type`, `opacity`, `cap`, `join`, `curveness`                                                                                                                                                                                                                                    |
| `areaStyle`                                          | `color`, `opacity`, `origin`                                                                                                                                                                                                                                                                       |
| `label`                                              | `show`, `position`, `distance`, `rotate`, `offset`, `formatter`, `color`, `fontSize`, `fontFamily`, `fontWeight`, `align`, `verticalAlign`, `backgroundColor`, `borderColor`, `borderWidth`, `borderRadius`, `padding`, `opacity`                                                                  |

Use `category`, `value`, or `time` for an axis `type`; axis `position` is `top`, `bottom`, `left`, or `right`. A legend `type` can only be `plain`; `orient` is `horizontal` or `vertical`. A radar `shape` is `polygon` or `circle`. A visual map `type` can only be `continuous`, and both `calculable` and `realtime` must be `false`. `containLabel` must be `false` because the renderer requires explicit grid margins.

Common accepted series fields are `type`, `name`, `data`, `encode`, `datasetIndex`, `xAxisIndex`, `yAxisIndex`, `coordinateSystem`, `label`, `itemStyle`, `lineStyle`, `areaStyle`, `emphasis`, `select`, `silent`, `animation`, and `selectedMode`. If set, `coordinateSystem` must be `cartesian2d` for a Cartesian type or `radar` for a radar type; pie and gauge cannot set it. Axis indexes default to `0`; explicit indexes must be non-negative integers and refer to existing axes. `emphasis` and `select` may contain only `disabled`. If set, `selectedMode` must be `false`.

Type-specific series fields are:

| Type      | Additional fields                                                                                                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bar`     | `stack`, `barWidth`, `barMaxWidth`, `barMinHeight`, `barGap`, `barCategoryGap`, `showBackground`, `backgroundStyle`, `roundCap`                                       |
| `line`    | `stack`, `smooth`, `step`, `connectNulls`, `showSymbol`, `symbol`, `symbolSize`                                                                                       |
| `scatter` | `symbol`, `symbolSize`                                                                                                                                                |
| `pie`     | `radius`, `center`, `roseType`, `clockwise`, `startAngle`, `minAngle`, `padAngle`, `avoidLabelOverlap`, `stillShowZeroSum`, `percentPrecision`, `labelLine`           |
| `radar`   | `symbol`, `symbolSize`                                                                                                                                                |
| `heatmap` | `blurSize`, `minOpacity`, `maxOpacity`                                                                                                                                |
| `gauge`   | `min`, `max`, `startAngle`, `endAngle`, `splitNumber`, `radius`, `axisLine`, `axisTick`, `splitLine`, `axisLabel`, `pointer`, `progress`, `anchor`, `detail`, `title` |

Use only these chart types: `bar`, `line`, `scatter`, `pie`, `radar`, `heatmap`, and `gauge`. Cartesian types are `bar`, `line`, `scatter`, and `heatmap`. They require both `xAxis` and `yAxis`; only Cartesian charts can use `grid`. A Cartesian chart may mix these series types, including bar and line. Radar series require `radar.indicator` and cannot be mixed with another coordinate family. Pie and gauge series use the standalone family and do not use axes or grid. The renderer rejects a chart that mixes coordinate families.

Each radar indicator is `{ "name": "...", "min": number, "max": number }`; `name` is required and non-empty, while `min` and `max` are optional. If both bounds are supplied, `min` must be less than `max`. A radar has 1–32 indicators and each inline radar point must supply exactly one numeric or `null` value per indicator.

## Embedded data

Data is always inside the option. Do not use a URL, file, callback, or remote data source.

### Inline series data

Without a root `dataset`, every series needs a non-empty `data` array. Supported points depend on the series type:

| Type           | Accepted inline points                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------- |
| `bar`, `line`  | A finite number or `null`; `[category, value]`; or `{ "name"?, "value": number-or-null-or-pair, "itemStyle"? }` |
| `scatter`      | `[x, y]` or `{ "name"?, "value": [x, y], "itemStyle"? }`                                                        |
| `heatmap`      | `[x, y, value]` or `{ "name"?, "value": [x, y, value], "itemStyle"? }`; the third value is numeric or `null`    |
| `pie`, `gauge` | `{ "name"?, "value": number-or-null, "itemStyle"? }`                                                            |
| `radar`        | `{ "name"?, "value": [number-or-null, ...], "itemStyle"? }`; array length must equal the indicator count        |

For tuple coordinates, each coordinate or category can be a finite number or a string. Per-data-point `itemStyle` is narrower than series `itemStyle`: it accepts only `color`, `borderColor`, `borderWidth`, `borderType`, `borderRadius`, and `opacity`.

### Dataset and encodings

A root dataset must have a unique `dimensions` array with 1–32 string names and a non-empty `source` array. Each source row must be an array with exactly one cell per dimension. A cell is a string, finite number, or `null`. The source is embedded row data, not a URL. No other dataset keys are accepted; transforms are disabled.

When using a dataset, do not set series `data`. Every series must have an `encode` object. The only encode keys are `x`, `y`, `value`, and `itemName`. Each value names a dimension, gives a zero-based dimension index, or gives a non-empty array of such references. Every reference must exist. `datasetIndex` may be omitted or set to `0`.

Required encode keys by series type:

| Type                     | Required `encode` keys |
| ------------------------ | ---------------------- |
| `bar`, `line`, `scatter` | `x`, `y`               |
| `heatmap`                | `x`, `y`, `value`      |
| `pie`                    | `itemName`, `value`    |
| `gauge`, `radar`         | `value`                |

For dataset-backed radar series, `encode.value` must map exactly one dimension per radar indicator. For heatmap, `visualMap` is required and its `min` must be less than `max`. Its `inRange.color` must contain at least two colors. With inline heatmap tuples, `visualMap.dimension`, if present, must be `2`; with a dataset it must identify a valid source dimension.

The inline point count across all series, or the dataset row count, cannot exceed 10,000. Do not combine root `dataset.source` with per-series `data`.

## Static output and unsupported options

The renderer runs local ECharts 6.1.0 in server-side SVG mode. It emits a static SVG with the requested canvas dimensions and a `viewBox`; it does not produce a live chart. The renderer sets animation off, marks output silent, and disables series emphasis and selection. If input asks for animation, interaction, emphasis, or selection effects, the renderer may report a warning while still producing static output. The default canvas background is white when `backgroundColor` is omitted. The renderer supplies `Noto Sans, DejaVu Sans, sans-serif` as the default font family.

Only the fields listed in this guide pass the profile. For example, `tooltip`, `toolbox`, `dataZoom`, arbitrary component options, and JavaScript formatter functions are outside it. Dataset transforms and external sources are also outside it. Formatters must be strings of at most 512 characters and may use only `{a}`, `{b}`, `{c}`, `{d}`, `{name}`, `{value}`, or `{percent}` placeholders; tag-shaped `<...>` substrings and unknown brace placeholders are rejected. Do not add fields just because another ECharts runtime accepts them.

## Complete example

This example shows monthly fulfillment volume and on-time rate, using one embedded dataset with a mixed bar-and-line Cartesian chart and two value axes.

```echarts width=1000 height=560
{
  "title": {
    "text": "Monthly fulfillment performance",
    "subtext": "North American distribution network · FY2025",
    "left": "center",
    "top": 12,
    "itemGap": 8,
    "textStyle": {
      "fontSize": 21,
      "fontWeight": 700,
      "color": "#172b4d"
    },
    "subtextStyle": {
      "fontSize": 12,
      "color": "#64748b"
    }
  },
  "color": ["#2563eb", "#ea580c"],
  "backgroundColor": "#ffffff",
  "legend": {
    "show": true,
    "orient": "horizontal",
    "left": "center",
    "top": 72,
    "data": ["Shipments", "On-time rate"],
    "textStyle": {
      "fontSize": 12,
      "color": "#334155"
    },
    "selectedMode": false
  },
  "grid": {
    "left": 76,
    "right": 86,
    "top": 118,
    "bottom": 72,
    "containLabel": false
  },
  "dataset": {
    "dimensions": ["month", "shipments", "onTimePercent"],
    "source": [
      ["Jan", 18400, 92.4],
      ["Feb", 17950, 93.1],
      ["Mar", 20120, 91.8],
      ["Apr", 21480, 94.0],
      ["May", 22910, 94.6],
      ["Jun", 23670, 93.7],
      ["Jul", 24820, 95.2],
      ["Aug", 24260, 94.8],
      ["Sep", 23140, 95.6],
      ["Oct", 25530, 96.1],
      ["Nov", 28190, 94.9],
      ["Dec", 29760, 95.4]
    ]
  },
  "xAxis": {
    "type": "category",
    "name": "Month",
    "nameLocation": "middle",
    "nameGap": 38,
    "axisLine": {
      "show": true,
      "lineStyle": {
        "color": "#94a3b8",
        "width": 1
      }
    },
    "axisTick": {
      "show": false
    },
    "axisLabel": {
      "show": true,
      "color": "#475569",
      "fontSize": 11,
      "margin": 12
    },
    "splitLine": {
      "show": false
    }
  },
  "yAxis": [
    {
      "type": "value",
      "name": "Shipments",
      "nameLocation": "middle",
      "nameGap": 54,
      "min": 0,
      "axisLabel": {
        "color": "#475569",
        "formatter": "{value}"
      },
      "splitLine": {
        "show": true,
        "lineStyle": {
          "color": "#e2e8f0",
          "type": "dashed"
        }
      }
    },
    {
      "type": "value",
      "name": "On-time rate",
      "nameLocation": "middle",
      "nameGap": 58,
      "position": "right",
      "min": 0,
      "max": 100,
      "axisLabel": {
        "color": "#475569",
        "formatter": "{value}%"
      },
      "splitLine": {
        "show": false
      }
    }
  ],
  "series": [
    {
      "type": "bar",
      "name": "Shipments",
      "encode": {
        "x": "month",
        "y": "shipments"
      },
      "barMaxWidth": 38,
      "itemStyle": {
        "color": "#2563eb",
        "borderRadius": 3
      },
      "label": {
        "show": false,
        "position": "top",
        "formatter": "{c}"
      },
      "xAxisIndex": 0,
      "yAxisIndex": 0
    },
    {
      "type": "line",
      "name": "On-time rate",
      "encode": {
        "x": "month",
        "y": "onTimePercent"
      },
      "yAxisIndex": 1,
      "smooth": 0.25,
      "showSymbol": true,
      "symbol": "circle",
      "symbolSize": 8,
      "lineStyle": {
        "color": "#ea580c",
        "width": 3
      },
      "itemStyle": {
        "color": "#ea580c",
        "borderColor": "#ffffff",
        "borderWidth": 2
      },
      "label": {
        "show": false,
        "position": "top",
        "formatter": "{c}%"
      }
    }
  ]
}
```

## References and verification

**Official Apache ECharts sources; reviewed 2026-10-26:**

- [ECharts option documentation](https://echarts.apache.org/en/option.html) — the full option tree, component, series, coordinate-system, dataset, and visual-mapping reference.
- [Dataset](https://echarts.apache.org/handbook/en/concepts/dataset/) and [data transform](https://echarts.apache.org/handbook/en/concepts/data-transform/) — upstream data reuse, encode mappings, and registered transforms.
- [ECharts 6 features](https://echarts.apache.org/handbook/en/basics/release-note/v6-feature/) — matrix layout, chord series, and scatter jittering.
- [Events and actions](https://echarts.apache.org/handbook/en/concepts/event/) and [server-side rendering](https://echarts.apache.org/handbook/en/how-to/cross-platform/server/) — browser interaction and upstream SVG SSR behavior.
- [ECharts handbook](https://echarts.apache.org/handbook/en/) — chart concepts, recipes, and the v5→v6 upgrade guide.

The upstream material in this guide is separated from the local profile by section heading. The pinned static profile above is grounded in `src/renderers/echarts.ts`, `echarts-source.ts`, `echarts-options.ts`, `echarts-options-schema.ts`, `echarts-options-data.ts`, `echarts-options-fields.ts`, and `echarts-runner.ts` (worker loads `echarts/core`, `echarts/charts`, `echarts/components`, `echarts/renderers` with the SVG renderer in SSR mode). Behavior is covered by `tests/echarts-source.test.ts`, `echarts-options.test.ts`, and `echarts-renderer.test.ts`. Package pins ECharts to `6.1.0`; the profile revision is `echarts-static-profile-v1`.
