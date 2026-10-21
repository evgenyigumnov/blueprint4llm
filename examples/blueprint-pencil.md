# Pencil-макет профиля

Документ Pencil находится прямо в fenced-блоке. Компилятор строит из него безопасный SVG без сети.

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
          "content": "Профиль",
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
              "content": "Сохранить",
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

Поддерживаются frame/group, rectangle, ellipse, polygon, path и text; координаты корневых объектов могут быть отрицательными. Внешние файлы, картинки, переменные, импорты, компоненты, скрипты, эффекты и градиенты отклоняются с диагностикой.
