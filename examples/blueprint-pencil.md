# Pencil reliability dashboard

This embedded Pencil schema 2.21 screen combines product navigation, service health metrics, a
multi-series trend plot, incident counts, and a compact dependency list in one custom vector frame.

```pencil
{
  "version": "2.21",
  "children": [
    {
      "id": "dashboard",
      "type": "frame",
      "width": 720,
      "height": 450,
      "layout": "none",
      "clip": true,
      "fill": "#F8FAFC",
      "children": [
        {
          "id": "sidebar",
          "type": "frame",
          "width": 146,
          "height": 450,
          "layout": "none",
          "fill": "#10243A",
          "children": [
            { "id": "brand", "type": "text", "x": 18, "y": 20, "width": 114, "height": 28, "content": "NORTHSTAR", "fontSize": 15, "fontWeight": "700", "fill": "#FFFFFF" },
            { "id": "workspace", "type": "text", "x": 18, "y": 57, "width": 114, "height": 30, "content": "Platform\nproduction", "fontSize": 11, "fill": "#B8C6D8" },
            { "id": "nav-overview", "type": "text", "x": 18, "y": 120, "width": 114, "height": 22, "content": "Overview", "fontSize": 13, "fontWeight": "600", "fill": "#FFFFFF" },
            { "id": "nav-services", "type": "text", "x": 18, "y": 158, "width": 114, "height": 22, "content": "Services", "fontSize": 13, "fill": "#B8C6D8" },
            { "id": "nav-incidents", "type": "text", "x": 18, "y": 196, "width": 114, "height": 22, "content": "Incidents  ·  4", "fontSize": 13, "fill": "#B8C6D8" },
            { "id": "nav-traces", "type": "text", "x": 18, "y": 234, "width": 114, "height": 22, "content": "Traces", "fontSize": 13, "fill": "#B8C6D8" },
            { "id": "nav-alerts", "type": "text", "x": 18, "y": 272, "width": 114, "height": 22, "content": "Alert policies", "fontSize": 13, "fill": "#B8C6D8" },
            { "id": "nav-bottom", "type": "text", "x": 18, "y": 408, "width": 114, "height": 20, "content": "On-call · A. Chen", "fontSize": 10, "fill": "#B8C6D8" }
          ]
        },
        { "id": "page-title", "type": "text", "x": 168, "y": 18, "width": 340, "height": 30, "content": "Reliability overview", "fontSize": 23, "fontWeight": "600", "fill": "#15253A" },
        { "id": "period", "type": "text", "x": 550, "y": 24, "width": 142, "height": 22, "content": "Last 24 hours  ▾", "fontSize": 12, "textAlign": "right", "fill": "#52637A" },

        { "id": "metric-availability", "type": "rectangle", "x": 168, "y": 58, "width": 166, "height": 78, "cornerRadius": 8, "fill": "#FFFFFF", "stroke": "#D8E0EA", "strokeWidth": 1 },
        { "id": "availability-label", "type": "text", "x": 182, "y": 70, "width": 138, "height": 18, "content": "Availability", "fontSize": 11, "fill": "#64748B" },
        { "id": "availability-value", "type": "text", "x": 182, "y": 91, "width": 138, "height": 30, "content": "99.97%", "fontSize": 23, "fontWeight": "600", "fill": "#176B50" },
        { "id": "availability-change", "type": "text", "x": 267, "y": 99, "width": 55, "height": 18, "content": "↑ 0.02%", "fontSize": 9, "textAlign": "right", "fill": "#176B50" },

        { "id": "metric-latency", "type": "rectangle", "x": 344, "y": 58, "width": 166, "height": 78, "cornerRadius": 8, "fill": "#FFFFFF", "stroke": "#D8E0EA", "strokeWidth": 1 },
        { "id": "latency-label", "type": "text", "x": 358, "y": 70, "width": 138, "height": 18, "content": "p95 latency", "fontSize": 11, "fill": "#64748B" },
        { "id": "latency-value", "type": "text", "x": 358, "y": 91, "width": 138, "height": 30, "content": "184 ms", "fontSize": 23, "fontWeight": "600", "fill": "#15253A" },
        { "id": "latency-change", "type": "text", "x": 440, "y": 99, "width": 56, "height": 18, "content": "↓ 12 ms", "fontSize": 9, "textAlign": "right", "fill": "#176B50" },

        { "id": "metric-errors", "type": "rectangle", "x": 520, "y": 58, "width": 172, "height": 78, "cornerRadius": 8, "fill": "#FFFFFF", "stroke": "#D8E0EA", "strokeWidth": 1 },
        { "id": "errors-label", "type": "text", "x": 534, "y": 70, "width": 144, "height": 18, "content": "Error budget used", "fontSize": 11, "fill": "#64748B" },
        { "id": "errors-value", "type": "text", "x": 534, "y": 91, "width": 144, "height": 30, "content": "18.4%", "fontSize": 23, "fontWeight": "600", "fill": "#B45309" },
        { "id": "errors-change", "type": "text", "x": 621, "y": 99, "width": 57, "height": 18, "content": "of monthly", "fontSize": 9, "textAlign": "right", "fill": "#64748B" },

        { "id": "chart-frame", "type": "frame", "x": 168, "y": 148, "width": 524, "height": 177, "layout": "none", "cornerRadius": 8, "fill": "#FFFFFF", "stroke": "#D8E0EA", "strokeWidth": 1, "children": [
          { "id": "chart-title", "type": "text", "x": 14, "y": 11, "width": 250, "height": 18, "content": "Request latency by service", "fontSize": 12, "fontWeight": "600", "fill": "#24364B" },
          { "id": "chart-legend-api", "type": "text", "x": 314, "y": 12, "width": 72, "height": 16, "content": "● API", "fontSize": 10, "fill": "#315DEB" },
          { "id": "chart-legend-worker", "type": "text", "x": 390, "y": 12, "width": 110, "height": 16, "content": "● Worker", "fontSize": 10, "fill": "#E19B2D" },
          { "id": "grid-1", "type": "path", "x": 47, "y": 46, "width": 452, "height": 1, "geometry": "M0 0 L452 0", "stroke": "#E8EDF3", "strokeWidth": 1 },
          { "id": "grid-2", "type": "path", "x": 47, "y": 83, "width": 452, "height": 1, "geometry": "M0 0 L452 0", "stroke": "#E8EDF3", "strokeWidth": 1 },
          { "id": "grid-3", "type": "path", "x": 47, "y": 120, "width": 452, "height": 1, "geometry": "M0 0 L452 0", "stroke": "#E8EDF3", "strokeWidth": 1 },
          { "id": "api-line", "type": "path", "x": 48, "y": 40, "width": 450, "height": 80, "geometry": "M0 57 L48 47 L96 52 L144 32 L192 41 L240 24 L288 38 L336 45 L384 29 L432 35", "stroke": "#315DEB", "strokeWidth": 3, "strokeLinecap": "round", "strokeLinejoin": "round" },
          { "id": "worker-line", "type": "path", "x": 48, "y": 40, "width": 450, "height": 80, "geometry": "M0 70 L48 63 L96 59 L144 62 L192 50 L240 56 L288 47 L336 58 L384 54 L432 60", "stroke": "#E19B2D", "strokeWidth": 2, "strokeLinecap": "round", "strokeLinejoin": "round" },
          { "id": "axis-labels", "type": "text", "x": 47, "y": 128, "width": 452, "height": 16, "content": "00:00         03:00         06:00         09:00         12:00         15:00         18:00         21:00", "fontSize": 8, "fill": "#8391A3" }
        ]},

        { "id": "service-title", "type": "text", "x": 168, "y": 340, "width": 280, "height": 20, "content": "Services with active signals", "fontSize": 13, "fontWeight": "600", "fill": "#24364B" },
        { "id": "service-header", "type": "text", "x": 168, "y": 365, "width": 524, "height": 17, "content": "SERVICE                                      HEALTH        P95       ALERTS", "fontSize": 9, "fontWeight": "600", "fill": "#7A899B" },
        { "id": "service-row-1", "type": "text", "x": 168, "y": 386, "width": 524, "height": 18, "content": "●  api-gateway                              Healthy       184 ms       1", "fontSize": 11, "fill": "#25364A" },
        { "id": "service-row-2", "type": "text", "x": 168, "y": 408, "width": 524, "height": 18, "content": "●  event-worker                            Degraded      362 ms       2", "fontSize": 11, "fill": "#B45309" },
        { "id": "service-row-3", "type": "text", "x": 168, "y": 430, "width": 524, "height": 18, "content": "●  billing-sync                              Healthy       206 ms       0", "fontSize": 11, "fill": "#25364A" }
      ]
    }
  ]
}
```

The renderer supports embedded schema 2.21 frames, groups, vector shapes, paths, and text. It does
not load images, components, gradients, or effects.
