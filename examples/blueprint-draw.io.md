# Диаграмма draw.io JSON

Экспортируйте диаграмму через **File → Export as → JSON** и вставьте содержимое в блок `drawio`. Для нескольких страниц используйте `page=<id>`. Параметр `direction=LR` задаёт направление слева направо; по умолчанию используется `TB`.

```drawio page=release direction=LR
{
  "version": "26.0",
  "pages": [
    {
      "id": "release",
      "name": "Релиз",
      "cells": [
        { "id": "layer-1", "type": "layer" },
        { "id": "build", "type": "group", "parent": "layer-1", "label": "Сборка и тесты" },
        { "id": "compile", "type": "node", "parent": "build", "label": "Собрать" },
        { "id": "test", "type": "node", "parent": "build", "label": "Проверить" },
        {
          "id": "compile-test",
          "type": "edge",
          "parent": "build",
          "source": "compile",
          "target": "test",
          "label": "успешно"
        },
        { "id": "publish", "type": "node", "parent": "layer-1", "label": "Опубликовать" },
        {
          "id": "test-publish",
          "type": "edge",
          "parent": "layer-1",
          "source": "test",
          "target": "publish",
          "label": "релиз"
        }
      ]
    }
  ]
}
```

Компилятор сохраняет подписи и связи, затем строит новую inline SVG-диаграмму с автоматической раскладкой. Исходная геометрия и стили из draw.io JSON не переносятся.
