# Excalidraw service flow

The scene keeps the saved positions and draws without an editor or network access.

```excalidraw
{
  "type": "excalidraw",
  "version": 2,
  "elements": [
    {
      "id": "client", "type": "rectangle", "x": -40, "y": 24,
      "width": 140, "height": 64, "strokeColor": "#1e1e1e",
      "backgroundColor": "#dbeafe", "fillStyle": "solid", "strokeWidth": 2,
      "strokeStyle": "solid", "roughness": 0, "opacity": 100,
      "groupIds": ["frontend"], "roundness": null, "isDeleted": false
    },
    {
      "id": "api", "type": "ellipse", "x": 260, "y": 24,
      "width": 132, "height": 64, "strokeColor": "#1e1e1e",
      "backgroundColor": "#dcfce7", "fillStyle": "solid", "strokeWidth": 2,
      "strokeStyle": "solid", "roughness": 0, "opacity": 100,
      "groupIds": ["backend"], "roundness": null, "isDeleted": false
    },
    {
      "id": "request", "type": "arrow", "x": 100, "y": 56,
      "width": 160, "height": 0, "strokeColor": "#334155",
      "backgroundColor": "transparent", "fillStyle": "solid", "strokeWidth": 2,
      "strokeStyle": "solid", "roughness": 0, "opacity": 100,
      "groupIds": ["integration"], "roundness": null, "isDeleted": false,
      "points": [[0, 0], [72, -18], [160, 0]],
      "startArrowhead": null, "endArrowhead": "triangle", "elbowed": false
    },
    {
      "id": "client-label", "type": "text", "x": -30, "y": 42,
      "width": 120, "height": 24, "strokeColor": "#1e1e1e",
      "backgroundColor": "transparent", "fillStyle": "solid", "strokeWidth": 1,
      "strokeStyle": "solid", "roughness": 0, "opacity": 100,
      "groupIds": ["frontend"], "roundness": null, "isDeleted": false,
      "text": "Client", "fontSize": 18, "fontFamily": 2,
      "textAlign": "center", "lineHeight": 1.25, "containerId": "client"
    },
    {
      "id": "api-label", "type": "text", "x": 266, "y": 42,
      "width": 120, "height": 24, "strokeColor": "#1e1e1e",
      "backgroundColor": "transparent", "fillStyle": "solid", "strokeWidth": 1,
      "strokeStyle": "solid", "roughness": 0, "opacity": 100,
      "groupIds": ["backend"], "roundness": null, "isDeleted": false,
      "text": "API", "fontSize": 18, "fontFamily": 2,
      "textAlign": "center", "lineHeight": 1.25, "containerId": "api"
    }
  ],
  "appState": { "viewBackgroundColor": "#ffffff" },
  "files": {}
}
```
