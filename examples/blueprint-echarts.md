# Apache ECharts

ECharts blocks use strict JSON and render as static SVG. The examples below cover the supported
series, a mixed bar and line chart, and a local tabular dataset.

## Запросы и целевой показатель

```echarts width=800 height=450
{
  "title": { "text": "Запросы по кварталам", "left": "center" },
  "legend": { "data": ["Факт", "Цель"], "top": 42 },
  "grid": { "left": 72, "right": 30, "top": 92, "bottom": 56 },
  "xAxis": { "type": "category", "data": ["Q1", "Q2", "Q3", "Q4"], "name": "Квартал" },
  "yAxis": { "type": "value", "name": "Запросы, тыс." },
  "series": [
    {
      "type": "bar",
      "name": "Факт",
      "data": [120, 200, 150, 180],
      "itemStyle": {
        "color": {
          "type": "linear",
          "x": 0,
          "y": 0,
          "x2": 0,
          "y2": 1,
          "colorStops": [
            { "offset": 0, "color": "#5470c6" },
            { "offset": 1, "color": "#91cc75" }
          ]
        },
        "borderRadius": 4
      },
      "label": { "show": true, "position": "top" }
    },
    {
      "type": "line",
      "name": "Цель",
      "data": [140, 170, 175, 215],
      "smooth": true,
      "symbolSize": 9
    }
  ]
}
```

## Доля заявок по каналам

```echarts
{
  "title": { "text": "Каналы обращений", "left": "center" },
  "legend": { "orient": "vertical", "left": "left", "top": "middle" },
  "series": [
    {
      "type": "pie",
      "radius": ["35%", "68%"],
      "center": ["58%", "55%"],
      "label": { "show": true, "formatter": "{b}: {d}%" },
      "data": [
        { "name": "Веб", "value": 42 },
        { "name": "Мобильное приложение", "value": 31 },
        { "name": "Телефон", "value": 18 },
        { "name": "Другое", "value": 9 }
      ]
    }
  ]
}
```

## Ошибки в зависимости от нагрузки

```echarts
{
  "title": { "text": "Ошибки и задержка" },
  "grid": { "left": 70, "right": 24, "top": 58, "bottom": 48 },
  "xAxis": { "type": "value", "name": "Запросы в секунду" },
  "yAxis": { "type": "value", "name": "Ошибки, %" },
  "series": [
    {
      "type": "scatter",
      "name": "Замеры",
      "symbolSize": 13,
      "data": [[120, 0.2], [180, 0.3], [260, 0.7], [340, 1.6], [420, 2.4], [500, 4.2]]
    }
  ]
}
```

## Профиль сервиса

```echarts
{
  "title": { "text": "Оценка готовности" },
  "radar": {
    "indicator": [
      { "name": "Надёжность", "max": 100 },
      { "name": "Скорость", "max": 100 },
      { "name": "Наблюдаемость", "max": 100 },
      { "name": "Безопасность", "max": 100 },
      { "name": "Поддержка", "max": 100 }
    ],
    "shape": "polygon"
  },
  "series": [
    {
      "type": "radar",
      "name": "Текущая оценка",
      "data": [{ "name": "Платформа", "value": [88, 76, 82, 93, 71] }],
      "areaStyle": { "opacity": 0.2 },
      "label": { "show": true }
    }
  ]
}
```

## P95 latency по дням и окнам нагрузки

```echarts width=800 height=450
{
  "title": { "text": "API latency by day and traffic window", "subtext": "p95 response time · milliseconds" },
  "textStyle": { "fontFamily": "Arial" },
  "grid": { "left": 86, "right": 34, "top": 78, "bottom": 56 },
  "xAxis": { "type": "category", "data": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
  "yAxis": { "type": "category", "data": ["00–04", "04–08", "08–12", "12–16", "16–20", "20–24"] },
  "visualMap": {
    "min": 50,
    "max": 280,
    "dimension": 2,
    "orient": "horizontal",
    "left": "center",
    "bottom": 8,
    "text": ["Slow", "Fast"],
    "inRange": { "color": ["#d9f0ee", "#8fcac6", "#4f88a7", "#f0ad66", "#cf5c57"] }
  },
  "series": [
    {
      "type": "heatmap",
      "name": "p95 latency",
      "label": { "show": true, "fontSize": 10, "color": "#17324d" },
      "data": [
        [0, 0, 62], [1, 0, 58], [2, 0, 60], [3, 0, 57], [4, 0, 65], [5, 0, 72], [6, 0, 68],
        [0, 1, 78], [1, 1, 75], [2, 1, 81], [3, 1, 74], [4, 1, 92], [5, 1, 86], [6, 1, 79],
        [0, 2, 154], [1, 2, 166], [2, 2, 172], [3, 2, 184], [4, 2, 205], [5, 2, 126], [6, 2, 118],
        [0, 3, 178], [1, 3, 192], [2, 3, 208], [3, 3, 214], [4, 3, 246], [5, 3, 142], [6, 3, 130],
        [0, 4, 221], [1, 4, 234], [2, 4, 268], [3, 4, 255], [4, 4, 279], [5, 4, 164], [6, 4, 151],
        [0, 5, 130], [1, 5, 142], [2, 5, 149], [3, 5, 158], [4, 5, 171], [5, 5, 106], [6, 5, 98]
      ],
      "itemStyle": { "borderWidth": 2, "borderColor": "#ffffff" },
      "emphasis": { "disabled": true }
    }
  ]
}
```

## Текущая готовность

```echarts
{
  "title": { "text": "Готовность релиза", "left": "center" },
  "series": [
    {
      "type": "gauge",
      "min": 0,
      "max": 100,
      "progress": { "show": false, "width": 16 },
      "axisLine": { "lineStyle": { "width": 16, "color": [[0.55, "#ee6666"], [0.8, "#fac858"], [1, "#91cc75"]] } },
      "axisTick": { "show": false },
      "splitLine": { "length": 12 },
      "axisLabel": { "distance": 20 },
      "detail": { "formatter": "{value}%", "fontSize": 28, "offsetCenter": [0, "68%"] },
      "data": [{ "name": "Готово", "value": 76 }]
    }
  ]
}
```

## Локальный dataset

```echarts
{
  "title": { "text": "Ожидаемый рост запросов" },
  "dataset": {
    "dimensions": ["Квартал", "Факт", "Прогноз"],
    "source": [
      ["Q1", 120, 135],
      ["Q2", 160, 180],
      ["Q3", 190, 215],
      ["Q4", 220, 250]
    ]
  },
  "legend": { "data": ["Факт", "Прогноз"], "top": 42 },
  "grid": { "left": 70, "right": 24, "top": 88, "bottom": 48 },
  "xAxis": { "type": "category" },
  "yAxis": { "type": "value", "name": "Тысяч запросов" },
  "series": [
    { "type": "bar", "name": "Факт", "encode": { "x": "Квартал", "y": "Факт" } },
    { "type": "line", "name": "Прогноз", "smooth": true, "encode": { "x": "Квартал", "y": "Прогноз" } }
  ]
}
```
