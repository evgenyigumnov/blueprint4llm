# Figma Design в Blueprint

Блок `figma` принимает локальный ответ Figma REST API в JSON или ссылку на один кадр Figma Design.

## JSON без сети и токена

JSON должен содержать корневой узел `DOCUMENT`. Если в документе несколько кадров верхнего уровня, задайте нужный ID через `node=ID` в метаданных блока.

```figma
{
  "name": "Профиль пользователя",
  "document": {
    "id": "0:0",
    "name": "Document",
    "type": "DOCUMENT",
    "children": [
      {
        "id": "1:1",
        "name": "Page 1",
        "type": "CANVAS",
        "children": [
          {
            "id": "12:34",
            "name": "Профиль",
            "type": "FRAME",
            "absoluteBoundingBox": { "x": 0, "y": 0, "width": 360, "height": 220 },
            "fills": [
              { "type": "SOLID", "color": { "r": 1, "g": 1, "b": 1, "a": 1 } }
            ],
            "children": [
              {
                "id": "12:35",
                "name": "Заголовок",
                "type": "TEXT",
                "absoluteBoundingBox": { "x": 24, "y": 24, "width": 300, "height": 34 },
                "characters": "Профиль пользователя",
                "style": { "fontFamily": "Inter", "fontSize": 24, "fontWeight": 600 },
                "fills": [
                  { "type": "SOLID", "color": { "r": 0.12, "g": 0.12, "b": 0.12, "a": 1 } }
                ]
              },
              {
                "id": "12:36",
                "name": "Кнопка сохранения",
                "type": "RECTANGLE",
                "absoluteBoundingBox": { "x": 24, "y": 88, "width": 312, "height": 48 },
                "cornerRadius": 8,
                "fills": [
                  { "type": "SOLID", "color": { "r": 0.1, "g": 0.35, "b": 0.85, "a": 1 } }
                ]
              },
              {
                "id": "12:37",
                "name": "Подпись кнопки",
                "type": "TEXT",
                "absoluteBoundingBox": { "x": 118, "y": 101, "width": 124, "height": 24 },
                "characters": "Сохранить",
                "style": { "fontFamily": "Inter", "fontSize": 16, "fontWeight": 600 },
                "fills": [
                  { "type": "SOLID", "color": { "r": 1, "g": 1, "b": 1, "a": 1 } }
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

## Кадр по ссылке

Для URL-режима нужен персональный токен Figma с разрешением `file_content:read`. Задайте его через `CompileOptions.figmaAccessToken`, переменную окружения `FIGMA_ACCESS_TOKEN` или `.env` в текущей папке. Порядок поиска токена приведён в [README](../README.md#figma-frames).

```figma
https://www.figma.com/design/zLHKskbfyMxqt2Clt6iYui/test?node-id=1-2&t=ZyN0zfK7kUYBitwx-4
```

Параметр `t` остаётся частью исходной ссылки и не отправляется в Figma API. Во время компиляции API возвращает временный SVG URL; компилятор скачивает SVG и встраивает его в документ. JSON-режим не обращается к сети.
