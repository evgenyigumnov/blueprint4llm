# Request workflow

Review the flow and the screen before implementation.

## Request flow

```mermaid
flowchart TD
    Form[Request form] --> API[API validation]
    API --> Queue[Processing queue]
```

## New request screen

```balsamiq
{
  "mockup": {
    "measuredW": 421,
    "measuredH": 301,
    "controls": {
      "control": [
        {
          "ID": "control-1",
          "typeID": "Rectangle",
          "x": 0,
          "y": 0,
          "w": 420,
          "h": 300,
          "zOrder": 0,
          "properties": {
            "color": "#ffffff"
          }
        },
        {
          "ID": "control-2",
          "typeID": "Label",
          "x": 16,
          "y": 16,
          "w": 388,
          "h": 34,
          "zOrder": 1,
          "properties": {
            "text": "New request",
            "size": 22,
            "bold": true
          }
        },
        {
          "ID": "control-3",
          "typeID": "TextInput",
          "x": 16,
          "y": 66,
          "w": 388,
          "h": 36,
          "zOrder": 2,
          "properties": {
            "text": "Title"
          }
        },
        {
          "ID": "control-4",
          "typeID": "TextInput",
          "x": 16,
          "y": 118,
          "w": 388,
          "h": 36,
          "zOrder": 3,
          "properties": {
            "text": "Description"
          }
        },
        {
          "ID": "control-5",
          "typeID": "Button",
          "x": 16,
          "y": 170,
          "w": 146,
          "h": 38,
          "zOrder": 4,
          "properties": {
            "text": "Submit request",
            "bold": true
          }
        }
      ]
    }
  }
}
```
