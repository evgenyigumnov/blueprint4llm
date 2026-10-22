# Pencil profile mockup

The Pencil document is in the fenced block. The compiler creates a safe SVG from it without network access.

```pencil
{
  "version": "2.21",
  "children": [
    {
      "id": "profile-screen",
      "type": "frame",
      "x": -12,
      "y": 0,
      "width": 320,
      "height": 244,
      "layout": "vertical",
      "gap": 12,
      "padding": 20,
      "clip": true,
      "cornerRadius": 12,
      "fill": "#FFFFFF",
      "stroke": "#D8DEE9",
      "strokeWidth": 1,
      "children": [
        {
          "id": "title",
          "type": "text",
          "width": 280,
          "height": 32,
          "content": "Profile",
          "textGrowth": "fixed-width",
          "fontFamily": "Arial",
          "fontSize": 24,
          "fontWeight": "600",
          "fill": "#202124"
        },
        {
          "id": "avatar",
          "type": "ellipse",
          "width": 48,
          "height": 48,
          "fill": "#C7D2FE",
          "stroke": "#315DEB",
          "strokeWidth": 2
        },
        {
          "id": "email",
          "type": "text",
          "width": 280,
          "height": 36,
          "content": "anna@example.com",
          "textGrowth": "fixed-width",
          "fontSize": 14,
          "fill": "#475569"
        },
        {
          "id": "save-button",
          "type": "frame",
          "width": 280,
          "height": 48,
          "layout": "none",
          "cornerRadius": 8,
          "fill": "#315DEB",
          "children": [
            {
              "id": "save-label",
              "type": "text",
              "x": 0,
              "y": 6,
              "width": 280,
              "height": 36,
              "content": "Save",
              "textGrowth": "fixed-width",
              "textAlign": "center",
              "textAlignVertical": "middle",
              "fontSize": 16,
              "fontWeight": "600",
              "fill": "#FFFFFF"
            }
          ]
        }
      ]
    }
  ]
}
```

Supported types are frame/group, rectangle, ellipse, polygon, path, and text. Root objects can have negative coordinates. External files, images, variables, imports, components, scripts, effects, and gradients are rejected with diagnostics.
