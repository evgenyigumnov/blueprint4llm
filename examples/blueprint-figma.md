# Figma trip itinerary frame

The `figma` fence accepts local Figma REST API JSON or a frame URL. This offline frame is a travel
itinerary with a destination card, booking details, stay dates, a price summary, and clear next
actions.

## Local JSON frame

```figma
{
  "name": "Kyoto itinerary",
  "document": {
    "id": "0:0",
    "name": "Document",
    "type": "DOCUMENT",
    "children": [
      {
        "id": "1:1",
        "name": "Mobile booking",
        "type": "CANVAS",
        "children": [
          {
            "id": "12:34",
            "name": "Trip details",
            "type": "FRAME",
            "absoluteBoundingBox": { "x": 0, "y": 0, "width": 390, "height": 710 },
            "fills": [{ "type": "SOLID", "color": { "r": 0.97, "g": 0.98, "b": 0.99, "a": 1 } }],
            "children": [
              {
                "id": "12:35", "name": "Back navigation", "type": "TEXT",
                "absoluteBoundingBox": { "x": 22, "y": 18, "width": 180, "height": 22 },
                "characters": "‹  My trips",
                "style": { "fontFamily": "Inter", "fontSize": 14, "fontWeight": 600 },
                "fills": [{ "type": "SOLID", "color": { "r": 0.15, "g": 0.31, "b": 0.55, "a": 1 } }]
              },
              {
                "id": "12:36", "name": "Trip heading", "type": "TEXT",
                "absoluteBoundingBox": { "x": 22, "y": 54, "width": 346, "height": 34 },
                "characters": "Your Kyoto escape",
                "style": { "fontFamily": "Inter", "fontSize": 25, "fontWeight": 700 },
                "fills": [{ "type": "SOLID", "color": { "r": 0.09, "g": 0.14, "b": 0.22, "a": 1 } }]
              },
              {
                "id": "12:37", "name": "Trip dates", "type": "TEXT",
                "absoluteBoundingBox": { "x": 22, "y": 91, "width": 346, "height": 21 },
                "characters": "Oct 17–21 · 4 nights · 2 guests",
                "style": { "fontFamily": "Inter", "fontSize": 13, "fontWeight": 400 },
                "fills": [{ "type": "SOLID", "color": { "r": 0.37, "g": 0.43, "b": 0.51, "a": 1 } }]
              },
              {
                "id": "12:38", "name": "Destination card", "type": "RECTANGLE",
                "absoluteBoundingBox": { "x": 22, "y": 126, "width": 346, "height": 122 },
                "cornerRadius": 14,
                "fills": [{ "type": "SOLID", "color": { "r": 0.84, "g": 0.9, "b": 0.95, "a": 1 } }]
              },
              {
                "id": "12:39", "name": "Sun", "type": "ELLIPSE",
                "absoluteBoundingBox": { "x": 282, "y": 145, "width": 42, "height": 42 },
                "fills": [{ "type": "SOLID", "color": { "r": 0.95, "g": 0.73, "b": 0.42, "a": 1 } }]
              },
              {
                "id": "12:40", "name": "Hill silhouette", "type": "RECTANGLE",
                "absoluteBoundingBox": { "x": 22, "y": 211, "width": 346, "height": 37 },
                "fills": [{ "type": "SOLID", "color": { "r": 0.31, "g": 0.48, "b": 0.48, "a": 1 } }]
              },
              {
                "id": "12:41", "name": "Destination label", "type": "TEXT",
                "absoluteBoundingBox": { "x": 40, "y": 158, "width": 210, "height": 22 },
                "characters": "JAPAN · KANSAI REGION",
                "style": { "fontFamily": "Inter", "fontSize": 11, "fontWeight": 700, "letterSpacing": 0.7 },
                "fills": [{ "type": "SOLID", "color": { "r": 0.15, "g": 0.31, "b": 0.55, "a": 1 } }]
              },
              {
                "id": "12:42", "name": "Destination city", "type": "TEXT",
                "absoluteBoundingBox": { "x": 40, "y": 181, "width": 250, "height": 28 },
                "characters": "KYOTO",
                "style": { "fontFamily": "Inter", "fontSize": 22, "fontWeight": 700, "letterSpacing": 1.5 },
                "fills": [{ "type": "SOLID", "color": { "r": 0.09, "g": 0.14, "b": 0.22, "a": 1 } }]
              },
              {
                "id": "12:43", "name": "Property name", "type": "TEXT",
                "absoluteBoundingBox": { "x": 22, "y": 264, "width": 346, "height": 27 },
                "characters": "Higashiyama House",
                "style": { "fontFamily": "Inter", "fontSize": 19, "fontWeight": 650 },
                "fills": [{ "type": "SOLID", "color": { "r": 0.09, "g": 0.14, "b": 0.22, "a": 1 } }]
              },
              {
                "id": "12:44", "name": "Property address", "type": "TEXT",
                "absoluteBoundingBox": { "x": 22, "y": 293, "width": 346, "height": 20 },
                "characters": "Gion district · 4.91 ★  ·  Free cancellation",
                "style": { "fontFamily": "Inter", "fontSize": 12, "fontWeight": 400 },
                "fills": [{ "type": "SOLID", "color": { "r": 0.37, "g": 0.43, "b": 0.51, "a": 1 } }]
              },
              {
                "id": "12:45", "name": "Date card", "type": "RECTANGLE",
                "absoluteBoundingBox": { "x": 22, "y": 328, "width": 206, "height": 68 },
                "cornerRadius": 10,
                "fills": [{ "type": "SOLID", "color": { "r": 1, "g": 1, "b": 1, "a": 1 } }],
                "strokes": [{ "type": "SOLID", "color": { "r": 0.84, "g": 0.87, "b": 0.91, "a": 1 } }]
              },
              {
                "id": "12:46", "name": "Check-in", "type": "TEXT",
                "absoluteBoundingBox": { "x": 36, "y": 339, "width": 178, "height": 18 },
                "characters": "CHECK-IN  ·  FRI, OCT 17",
                "style": { "fontFamily": "Inter", "fontSize": 10, "fontWeight": 600 },
                "fills": [{ "type": "SOLID", "color": { "r": 0.37, "g": 0.43, "b": 0.51, "a": 1 } }]
              },
              {
                "id": "12:47", "name": "Check-in time", "type": "TEXT",
                "absoluteBoundingBox": { "x": 36, "y": 360, "width": 178, "height": 23 },
                "characters": "After 15:00",
                "style": { "fontFamily": "Inter", "fontSize": 15, "fontWeight": 600 },
                "fills": [{ "type": "SOLID", "color": { "r": 0.09, "g": 0.14, "b": 0.22, "a": 1 } }]
              },
              {
                "id": "12:48", "name": "Guest card", "type": "RECTANGLE",
                "absoluteBoundingBox": { "x": 240, "y": 328, "width": 128, "height": 68 },
                "cornerRadius": 10,
                "fills": [{ "type": "SOLID", "color": { "r": 1, "g": 1, "b": 1, "a": 1 } }],
                "strokes": [{ "type": "SOLID", "color": { "r": 0.84, "g": 0.87, "b": 0.91, "a": 1 } }]
              },
              {
                "id": "12:49", "name": "Guests", "type": "TEXT",
                "absoluteBoundingBox": { "x": 254, "y": 339, "width": 100, "height": 18 },
                "characters": "GUESTS",
                "style": { "fontFamily": "Inter", "fontSize": 10, "fontWeight": 600 },
                "fills": [{ "type": "SOLID", "color": { "r": 0.37, "g": 0.43, "b": 0.51, "a": 1 } }]
              },
              {
                "id": "12:50", "name": "Guest count", "type": "TEXT",
                "absoluteBoundingBox": { "x": 254, "y": 360, "width": 100, "height": 23 },
                "characters": "2 adults",
                "style": { "fontFamily": "Inter", "fontSize": 15, "fontWeight": 600 },
                "fills": [{ "type": "SOLID", "color": { "r": 0.09, "g": 0.14, "b": 0.22, "a": 1 } }]
              },
              {
                "id": "12:51", "name": "Included", "type": "TEXT",
                "absoluteBoundingBox": { "x": 22, "y": 414, "width": 346, "height": 35 },
                "characters": "✓  Breakfast included     ✓  Wi-Fi     ✓  Luggage storage",
                "style": { "fontFamily": "Inter", "fontSize": 11, "fontWeight": 500 },
                "fills": [{ "type": "SOLID", "color": { "r": 0.19, "g": 0.4, "b": 0.34, "a": 1 } }]
              },
              {
                "id": "12:52", "name": "Price card", "type": "RECTANGLE",
                "absoluteBoundingBox": { "x": 22, "y": 460, "width": 346, "height": 92 },
                "cornerRadius": 10,
                "fills": [{ "type": "SOLID", "color": { "r": 1, "g": 1, "b": 1, "a": 1 } }],
                "strokes": [{ "type": "SOLID", "color": { "r": 0.84, "g": 0.87, "b": 0.91, "a": 1 } }]
              },
              {
                "id": "12:53", "name": "Night rate", "type": "TEXT",
                "absoluteBoundingBox": { "x": 38, "y": 473, "width": 225, "height": 19 },
                "characters": "4 nights × ¥24,500",
                "style": { "fontFamily": "Inter", "fontSize": 12, "fontWeight": 400 },
                "fills": [{ "type": "SOLID", "color": { "r": 0.37, "g": 0.43, "b": 0.51, "a": 1 } }]
              },
              {
                "id": "12:54", "name": "Night total", "type": "TEXT",
                "absoluteBoundingBox": { "x": 270, "y": 473, "width": 80, "height": 19 },
                "characters": "¥98,000",
                "style": { "fontFamily": "Inter", "fontSize": 12, "fontWeight": 500 },
                "fills": [{ "type": "SOLID", "color": { "r": 0.09, "g": 0.14, "b": 0.22, "a": 1 } }]
              },
              {
                "id": "12:55", "name": "Tax", "type": "TEXT",
                "absoluteBoundingBox": { "x": 38, "y": 497, "width": 225, "height": 18 },
                "characters": "Local lodging tax",
                "style": { "fontFamily": "Inter", "fontSize": 12, "fontWeight": 400 },
                "fills": [{ "type": "SOLID", "color": { "r": 0.37, "g": 0.43, "b": 0.51, "a": 1 } }]
              },
              {
                "id": "12:56", "name": "Tax total", "type": "TEXT",
                "absoluteBoundingBox": { "x": 270, "y": 497, "width": 80, "height": 18 },
                "characters": "¥4,800",
                "style": { "fontFamily": "Inter", "fontSize": 12, "fontWeight": 500 },
                "fills": [{ "type": "SOLID", "color": { "r": 0.09, "g": 0.14, "b": 0.22, "a": 1 } }]
              },
              {
                "id": "12:57", "name": "Total", "type": "TEXT",
                "absoluteBoundingBox": { "x": 38, "y": 525, "width": 225, "height": 19 },
                "characters": "Total · pay at property",
                "style": { "fontFamily": "Inter", "fontSize": 12, "fontWeight": 600 },
                "fills": [{ "type": "SOLID", "color": { "r": 0.09, "g": 0.14, "b": 0.22, "a": 1 } }]
              },
              {
                "id": "12:58", "name": "Total amount", "type": "TEXT",
                "absoluteBoundingBox": { "x": 270, "y": 525, "width": 80, "height": 19 },
                "characters": "¥102,800",
                "style": { "fontFamily": "Inter", "fontSize": 12, "fontWeight": 700 },
                "fills": [{ "type": "SOLID", "color": { "r": 0.09, "g": 0.14, "b": 0.22, "a": 1 } }]
              },
              {
                "id": "12:59", "name": "Manage booking button", "type": "RECTANGLE",
                "absoluteBoundingBox": { "x": 22, "y": 574, "width": 346, "height": 48 },
                "cornerRadius": 10,
                "fills": [{ "type": "SOLID", "color": { "r": 0.15, "g": 0.31, "b": 0.55, "a": 1 } }]
              },
              {
                "id": "12:60", "name": "Manage booking label", "type": "TEXT",
                "absoluteBoundingBox": { "x": 22, "y": 586, "width": 346, "height": 24 },
                "characters": "Manage booking",
                "style": { "fontFamily": "Inter", "fontSize": 15, "fontWeight": 600, "textAlignHorizontal": "CENTER" },
                "fills": [{ "type": "SOLID", "color": { "r": 1, "g": 1, "b": 1, "a": 1 } }]
              },
              {
                "id": "12:61", "name": "Confirmation note", "type": "TEXT",
                "absoluteBoundingBox": { "x": 22, "y": 637, "width": 346, "height": 22 },
                "characters": "Confirmation sent to alex@example.com",
                "style": { "fontFamily": "Inter", "fontSize": 11, "fontWeight": 400, "textAlignHorizontal": "CENTER" },
                "fills": [{ "type": "SOLID", "color": { "r": 0.37, "g": 0.43, "b": 0.51, "a": 1 } }]
              }
            ]
          }
        ]
      }
    ]
  }
}
```

JSON mode works offline without a token. The local renderer supports frames, basic shapes, vector
paths, text, and solid fills.

## Figma frame URL

URL mode accepts HTTPS `/design/` or `/file/` frame URLs and needs a personal access token with
`file_content:read` permission. Set it through `CompileOptions.figmaAccessToken`,
`FIGMA_ACCESS_TOKEN`, or `.env` in the working directory. The token is sent only to
`api.figma.com`; returned SVG is embedded in the document.
