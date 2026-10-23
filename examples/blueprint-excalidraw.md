# Excalidraw launch roadmap

This saved scene turns a release plan into three review gates. It uses fixed coordinates, grouped
color-coded cards, arrows, and an advance criterion tied to observable evidence.

```excalidraw
{
  "type": "excalidraw",
  "version": 2,
  "elements": [
    {
      "id": "title", "type": "text", "x": 30, "y": 22,
      "width": 650, "height": 35, "strokeColor": "#17324d",
      "backgroundColor": "transparent", "fillStyle": "solid", "strokeWidth": 1,
      "strokeStyle": "solid", "roughness": 0, "opacity": 100,
      "groupIds": [], "roundness": null, "isDeleted": false,
      "text": "Launch plan · evidence first",
      "fontSize": 22, "fontFamily": 2, "textAlign": "left", "lineHeight": 1.25
    },
    {
      "id": "plan-card", "type": "rectangle", "x": 28, "y": 82,
      "width": 190, "height": 230, "strokeColor": "#315b86",
      "backgroundColor": "#eaf2ff", "fillStyle": "solid", "strokeWidth": 2,
      "strokeStyle": "solid", "roughness": 0, "opacity": 100,
      "groupIds": ["plan"], "roundness": null, "isDeleted": false
    },
    {
      "id": "plan-title", "type": "text", "x": 44, "y": 98,
      "width": 160, "height": 30, "strokeColor": "#17324d",
      "backgroundColor": "transparent", "fillStyle": "solid", "strokeWidth": 1,
      "strokeStyle": "solid", "roughness": 0, "opacity": 100,
      "groupIds": ["plan"], "roundness": null, "isDeleted": false,
      "text": "01 · PLAN", "fontSize": 16, "fontFamily": 2,
      "textAlign": "left", "lineHeight": 1.25
    },
    {
      "id": "plan-detail", "type": "text", "x": 44, "y": 142,
      "width": 158, "height": 102, "strokeColor": "#334155",
      "backgroundColor": "transparent", "fillStyle": "solid", "strokeWidth": 1,
      "strokeStyle": "solid", "roughness": 0, "opacity": 100,
      "groupIds": ["plan"], "roundness": null, "isDeleted": false,
      "text": "Weeks 1–2\nOutcome metric\nData owners\nThreat review",
      "fontSize": 11, "fontFamily": 2, "textAlign": "left", "lineHeight": 1.5
    },
    {
      "id": "beta-card", "type": "rectangle", "x": 260, "y": 82,
      "width": 190, "height": 230, "strokeColor": "#2e8061",
      "backgroundColor": "#e9f8ef", "fillStyle": "solid", "strokeWidth": 2,
      "strokeStyle": "solid", "roughness": 0, "opacity": 100,
      "groupIds": ["beta"], "roundness": null, "isDeleted": false
    },
    {
      "id": "beta-title", "type": "text", "x": 276, "y": 98,
      "width": 160, "height": 30, "strokeColor": "#17324d",
      "backgroundColor": "transparent", "fillStyle": "solid", "strokeWidth": 1,
      "strokeStyle": "solid", "roughness": 0, "opacity": 100,
      "groupIds": ["beta"], "roundness": null, "isDeleted": false,
      "text": "02 · PILOT", "fontSize": 16, "fontFamily": 2,
      "textAlign": "left", "lineHeight": 1.25
    },
    {
      "id": "beta-detail", "type": "text", "x": 276, "y": 142,
      "width": 158, "height": 102, "strokeColor": "#334155",
      "backgroundColor": "transparent", "fillStyle": "solid", "strokeWidth": 1,
      "strokeStyle": "solid", "roughness": 0, "opacity": 100,
      "groupIds": ["beta"], "roundness": null, "isDeleted": false,
      "text": "Weeks 3–4\n5 pilot users\nTask success\nRollback drill",
      "fontSize": 11, "fontFamily": 2, "textAlign": "left", "lineHeight": 1.5
    },
    {
      "id": "launch-card", "type": "rectangle", "x": 492, "y": 82,
      "width": 190, "height": 230, "strokeColor": "#a76622",
      "backgroundColor": "#fff4df", "fillStyle": "solid", "strokeWidth": 2,
      "strokeStyle": "solid", "roughness": 0, "opacity": 100,
      "groupIds": ["launch"], "roundness": null, "isDeleted": false
    },
    {
      "id": "launch-title", "type": "text", "x": 508, "y": 98,
      "width": 160, "height": 30, "strokeColor": "#17324d",
      "backgroundColor": "transparent", "fillStyle": "solid", "strokeWidth": 1,
      "strokeStyle": "solid", "roughness": 0, "opacity": 100,
      "groupIds": ["launch"], "roundness": null, "isDeleted": false,
      "text": "03 · LAUNCH", "fontSize": 14, "fontFamily": 2,
      "textAlign": "left", "lineHeight": 1.25
    },
    {
      "id": "launch-detail", "type": "text", "x": 508, "y": 142,
      "width": 158, "height": 102, "strokeColor": "#334155",
      "backgroundColor": "transparent", "fillStyle": "solid", "strokeWidth": 1,
      "strokeStyle": "solid", "roughness": 0, "opacity": 100,
      "groupIds": ["launch"], "roundness": null, "isDeleted": false,
      "text": "Weeks 5–6\n10→50→100%\nBudget watch\nSupport owner",
      "fontSize": 11, "fontFamily": 2, "textAlign": "left", "lineHeight": 1.5
    },
    {
      "id": "plan-beta", "type": "arrow", "x": 220, "y": 184,
      "width": 36, "height": 0, "strokeColor": "#64748b",
      "backgroundColor": "transparent", "fillStyle": "solid", "strokeWidth": 2,
      "strokeStyle": "solid", "roughness": 0, "opacity": 100,
      "groupIds": ["gates"], "roundness": null, "isDeleted": false,
      "points": [[0, 0], [36, 0]], "startArrowhead": null,
      "endArrowhead": "triangle", "elbowed": false
    },
    {
      "id": "beta-launch", "type": "arrow", "x": 452, "y": 184,
      "width": 36, "height": 0, "strokeColor": "#64748b",
      "backgroundColor": "transparent", "fillStyle": "solid", "strokeWidth": 2,
      "strokeStyle": "solid", "roughness": 0, "opacity": 100,
      "groupIds": ["gates"], "roundness": null, "isDeleted": false,
      "points": [[0, 0], [36, 0]], "startArrowhead": null,
      "endArrowhead": "triangle", "elbowed": false
    },
    {
      "id": "gate-note", "type": "text", "x": 40, "y": 340,
      "width": 630, "height": 60, "strokeColor": "#475569",
      "backgroundColor": "transparent", "fillStyle": "solid", "strokeWidth": 1,
      "strokeStyle": "solid", "roughness": 0, "opacity": 100,
      "groupIds": ["gates"], "roundness": null, "isDeleted": false,
      "text": "Gate: advance only when\nsuccess holds, rollback is rehearsed,\nand support is staffed.",
      "fontSize": 12, "fontFamily": 2, "textAlign": "center", "lineHeight": 1.3
    }
  ],
  "appState": { "viewBackgroundColor": "#ffffff" },
  "files": {}
}
```
