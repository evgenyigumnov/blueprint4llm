# Monthly API latency with an SLO band

Embedded rows drive a layered static chart: the shaded envelope gives the observed range, two lines
compare regions, and a dashed rule marks the 200 ms service objective.

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "title": {
    "text": "Monthly API latency",
    "subtitle": "p95 response time · observed range and 200 ms objective"
  },
  "description": "Regional p95 latency trends with range bands and an SLO reference line.",
  "width": 480,
  "height": 260,
  "data": {
    "values": [
      { "month": "Jan", "region": "Americas", "p95": 142, "low": 118, "high": 176 },
      { "month": "Feb", "region": "Americas", "p95": 151, "low": 124, "high": 184 },
      { "month": "Mar", "region": "Americas", "p95": 164, "low": 135, "high": 195 },
      { "month": "Apr", "region": "Americas", "p95": 158, "low": 128, "high": 190 },
      { "month": "May", "region": "Americas", "p95": 173, "low": 144, "high": 204 },
      { "month": "Jun", "region": "Americas", "p95": 181, "low": 151, "high": 214 },
      { "month": "Jul", "region": "Americas", "p95": 169, "low": 140, "high": 201 },
      { "month": "Aug", "region": "Americas", "p95": 157, "low": 130, "high": 188 },
      { "month": "Sep", "region": "Americas", "p95": 146, "low": 119, "high": 177 },
      { "month": "Oct", "region": "Americas", "p95": 139, "low": 113, "high": 171 },
      { "month": "Jan", "region": "Europe", "p95": 166, "low": 138, "high": 201 },
      { "month": "Feb", "region": "Europe", "p95": 172, "low": 143, "high": 209 },
      { "month": "Mar", "region": "Europe", "p95": 188, "low": 157, "high": 226 },
      { "month": "Apr", "region": "Europe", "p95": 196, "low": 163, "high": 235 },
      { "month": "May", "region": "Europe", "p95": 213, "low": 178, "high": 254 },
      { "month": "Jun", "region": "Europe", "p95": 207, "low": 174, "high": 247 },
      { "month": "Jul", "region": "Europe", "p95": 198, "low": 166, "high": 237 },
      { "month": "Aug", "region": "Europe", "p95": 185, "low": 154, "high": 223 },
      { "month": "Sep", "region": "Europe", "p95": 176, "low": 147, "high": 211 },
      { "month": "Oct", "region": "Europe", "p95": 162, "low": 135, "high": 196 }
    ]
  },
  "layer": [
    {
      "mark": { "type": "area", "opacity": 0.12 },
      "encoding": {
        "x": { "field": "month", "type": "ordinal", "title": "Month", "sort": null },
        "y": { "field": "low", "type": "quantitative", "title": "p95 latency (ms)" },
        "y2": { "field": "high" },
        "color": { "field": "region", "type": "nominal", "title": "Region" }
      }
    },
    {
      "mark": { "type": "line", "point": { "filled": true, "size": 48 }, "strokeWidth": 2.5 },
      "encoding": {
        "x": { "field": "month", "type": "ordinal", "title": "Month", "sort": null },
        "y": { "field": "p95", "type": "quantitative", "title": "p95 latency (ms)" },
        "color": { "field": "region", "type": "nominal", "title": "Region" },
        "detail": { "field": "region" }
      }
    },
    {
      "mark": { "type": "rule", "color": "#b45309", "strokeDash": [6, 4], "strokeWidth": 1.5 },
      "encoding": { "y": { "datum": 200 } }
    }
  ],
  "config": {
    "axis": { "labelFontSize": 11, "titleFontSize": 12, "gridColor": "#e5e7eb" },
    "legend": { "orient": "top", "labelFontSize": 11 },
    "view": { "stroke": "transparent" }
  }
}
```

The same embedded data and strict JSON profile render in the CLI, preview, VS Code, and PDF.
