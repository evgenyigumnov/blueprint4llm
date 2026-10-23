# Offline architecture with D2

This example uses containers, classes, a SQL table, a UML class, and a sequence diagram in one
local D2 block. The ELK layout and static light theme use D2's native `vars.d2-config` settings.

```d2
direction: down

vars: {
  d2-config: {
    layout-engine: elk
    theme-id: 0
  }
}

classes: {
  accent: {
    style.fill: "#dcecff"
    style.stroke: "#315b86"
  }
}

customer: Клиент {
  web: Веб-приложение {
    class: accent
  }
}

backend: Серверная часть {
  gateway: API заказов {
    class: accent
  }
  service: Сервис заказов
  database: Заказы {
    shape: sql_table
    id: int {constraint: primary_key}
    customer_id: int {constraint: foreign_key}
    total: decimal
    status: string
  }
  order: Заказ {
    shape: class
    +id: string
    +total: decimal
    -recalculate(): decimal
  }
}

checkout: Оформление заказа {
  shape: sequence_diagram
  browser: Браузер
  api: API
  worker: Обработчик
  browser -> api: создать заказ
  api -> worker: проверить данные
  worker -> api: готово
  api -> browser: подтвердить
}

customer.web -> backend.gateway: HTTPS
backend.gateway -> backend.service: создать
backend.service -> backend.database: сохранить
backend.service -> backend.order: собрать модель
```

D2 renders offline. This profile rejects imports, external resources, animation, HTML, Markdown, and
LaTeX labels.
