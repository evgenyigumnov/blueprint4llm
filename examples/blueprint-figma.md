# Пример Figma

Встроенный JSON Figma рендерится локально и не требует токена:

```figma node=1:2
{
  "name": "test",
  "document": {
    "id": "0:0",
    "name": "Document",
    "type": "DOCUMENT",
    "children": [
      {
        "id": "0:1",
        "name": "Page 1",
        "type": "CANVAS",
        "children": [
          {
            "id": "1:2",
            "name": "Profile card",
            "type": "FRAME",
            "absoluteBoundingBox": { "x": 0, "y": 0, "width": 320, "height": 180 },
            "fills": [
              { "type": "SOLID", "color": { "r": 1, "g": 1, "b": 1, "a": 1 } }
            ],
            "children": [
              {
                "id": "1:3",
                "name": "Title",
                "type": "TEXT",
                "absoluteBoundingBox": { "x": 24, "y": 24, "width": 240, "height": 32 },
                "characters": "Профиль",
                "style": { "fontFamily": "Inter", "fontSize": 24, "fontWeight": 600 },
                "fills": [
                  { "type": "SOLID", "color": { "r": 0.12, "g": 0.12, "b": 0.12, "a": 1 } }
                ]
              },
              {
                "id": "1:4",
                "name": "Save button",
                "type": "RECTANGLE",
                "absoluteBoundingBox": { "x": 24, "y": 88, "width": 272, "height": 48 },
                "cornerRadius": 8,
                "fills": [
                  { "type": "SOLID", "color": { "r": 0.1, "g": 0.35, "b": 0.85, "a": 1 } }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}
```

Ссылочный вариант загружает кадр через Figma REST API. Для него нужен `FIGMA_ACCESS_TOKEN` с правом чтения файла. Токен можно задать через параметр `figmaAccessToken`, переменную окружения `FIGMA_ACCESS_TOKEN` или файл `.env` в текущей папке.

```figma
https://www.figma.com/design/zLHKskbfyMxqt2Clt6iYui/test?node-id=1-2&t=ZyN0zfK7kUYBitwx-4
```
