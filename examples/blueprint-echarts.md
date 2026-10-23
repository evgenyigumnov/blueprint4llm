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

## Тепловая карта по дням и часам

```echarts width=800 height=450
{
  "title": { "text": "Среднее время ответа, мс" },
  "grid": { "left": 72, "right": 30, "top": 58, "bottom": 48 },
  "xAxis": { "type": "category", "data": ["Пн", "Вт", "Ср", "Чт", "Пт"] },
  "yAxis": { "type": "category", "data": ["Утро", "День", "Вечер"] },
  "visualMap": {
    "min": 40,
    "max": 240,
    "dimension": 2,
    "orient": "horizontal",
    "left": "center",
    "bottom": 4,
    "inRange": { "color": ["#e0f3f8", "#91bfdb", "#4575b4", "#d73027"] }
  },
  "series": [
    {
      "type": "heatmap",
      "name": "Время ответа",
      "label": { "show": true },
      "data": [[0, 0, 65], [1, 0, 80], [2, 0, 92], [3, 0, 78], [4, 0, 70], [0, 1, 110], [1, 1, 145], [2, 1, 160], [3, 1, 132], [4, 1, 118], [0, 2, 180], [1, 2, 205], [2, 2, 230], [3, 2, 195], [4, 2, 170]]
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
