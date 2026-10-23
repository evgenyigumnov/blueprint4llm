# Задержка API по окружениям

Встроенные данные и строгий JSON дают один и тот же статический график в CLI, preview, VS Code и PDF.

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "title": "Задержка API по окружениям",
  "description": "Сравнение p95 задержки в миллисекундах",
  "width": 480,
  "height": 240,
  "data": {
    "values": [
      { "environment": "Dev", "latency": 85 },
      { "environment": "Stage", "latency": 120 },
      { "environment": "Prod", "latency": 95 }
    ]
  },
  "mark": "bar",
  "encoding": {
    "x": { "field": "environment", "type": "nominal", "title": "Окружение" },
    "y": { "field": "latency", "type": "quantitative", "title": "p95, мс" },
    "color": { "field": "environment", "type": "nominal", "legend": null }
  }
}
```

Статические столбцы показывают 85, 120 и 95 мс для Dev, Stage и Prod. Экспорт отдельного графика:

```bash
blueprint4llm examples/blueprint-vega-lite.md --check
blueprint4llm examples/blueprint-vega-lite.md --out=vega-lite.svg --format=svg
```
