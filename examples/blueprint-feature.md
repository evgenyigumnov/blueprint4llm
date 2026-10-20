# SharePoint Search Connector — визуальный план

> Визуальная версия плана из `plan.sharepoint.md`. В ней основной сценарий показан как UI-прототипы и диаграммы; короткие пояснения фиксируют контракт и оставшиеся работы.

## Состояние по исходному плану

| Сервер и OAuth | Web UI | Rust-воркер SharePoint | Проверка с Microsoft tenant |
|---|---|---|---|
| ✅ Реализованы по сводке и разделу B | ✅ Реализован по сводке и разделу C | ⏳ Отдельная реализация ещё нужна | ⏳ Live-проверка не выполнялась |

Пока нет воркера, полноценная индексация и поиск документов SharePoint не заработают. Статус `ONLINE` в прототипе — целевое состояние полного сценария после подключения воркера.

> **Сверка статуса.** В сводке и пунктах B.5–B.8 сказано, что OAuth, Graph-доступ и проверка выбранной библиотеки реализованы. В пунктах A.1–A.2 остались формулировки о незавершённой Graph-проверке. Здесь за основу взят более поздний статус из сводки и раздела B; перед следующим релизом стоит сверить эти два пункта с кодом.

## Путь администратора

~~~mermaid
flowchart LR
    A[Добавить коннектор] --> B[Сохранить выключенный черновик]
    B --> C[Авторизация Microsoft]
    C --> D{Доступ к сайту подтверждён?}
    D -- Нет --> E[Показать причину и повторить авторизацию]
    E --> C
    D -- Да --> F[Загрузить библиотеки сайта]
    F --> G[Выбрать одну библиотеку]
    G --> H[Необязательно: ограничить папку]
    H --> I[Проверить настройки и включить]
    I --> J{Библиотека доступна?}
    J -- Нет --> K[Попросить выбрать доступную библиотеку]
    K --> F
    J -- Да --> L[Отправить configure воркеру]
    L --> M{Воркер SharePoint установлен?}
    M -- Нет --> N[Нет индексации и результатов]
    M -- Да --> O[Индексировать и искать документы]
~~~

## UI-прототипы

Ниже каждый экран показан отдельной диаграммой Wiremark, поэтому его можно читать и рендерить независимо. Формат: [Wiremark — инструкция для LLM](https://docs.wiremark.dev/wiremark-llm.md).

~~~wireframe
Wireframe #connectors landscape
  Stack column gap=2 padding=3
    Breadcrumbs
      Link "Настройки"
      Link "Поиск"
      Link "Коннекторы"
    Stack row
      Typography h4 "Поисковые коннекторы"
      Spacer
      Button "Добавить коннектор" contained
    Alert "SharePoint — один сайт и одна библиотека на коннектор." severity=info
    Table
      TableHead
        TableRow
          TableCell "Коннектор"
          TableCell "Область"
          TableCell "Статус"
      TableBody
        TableRow
          TableCell "SharePoint — договоры"
          TableCell "Документы / Договоры"
          TableCell "ONLINE"
        TableRow
          TableCell "OneDrive — Отдел продаж"
          TableCell "Личный диск"
          TableCell "ONLINE"
        TableRow
          TableCell "Dropbox — Архив"
          TableCell "Архив"
          TableCell "PAUSED"
    Card
      CardHeader title="Подключение SharePoint"
      CardContent
        Stack row
          Typography body2 "Учётная запись Microsoft требует повторной авторизации"
          Spacer
          Link "Переподключить"

~~~

### Черновик коннектора

~~~wireframe
Wireframe #draft landscape
  Stack column gap=2 padding=3
    Breadcrumbs
      Link "Коннекторы"
      Link "Новый SharePoint"
    Typography h4 "Новый коннектор SharePoint"
    Stepper orientation=horizontal
      Step label="Сайт" active
      Step label="Авторизация"
      Step label="Библиотека"
      Step label="Настройки"
    Card
      CardHeader title="1. Укажите сайт"
      CardContent
        Stack column gap=2
          TextField "Название коннектора" value="SharePoint — договоры" required
          TextField "URL сайта" value="https://contoso.sharepoint.com/sites/legal" required helperText="Сайт SharePoint Online, например /sites/legal или /teams/legal"
          Alert "Сначала сохраните выключенный черновик. Библиотека появится после авторизации." severity=info
    Stack row
      Button "Отмена" outlined
      Spacer
      Button "Сохранить черновик и продолжить" contained

~~~

### Авторизация Microsoft

~~~wireframe
Wireframe #oauth landscape
  Stack column gap=2 padding=3
    Breadcrumbs
      Link "Коннекторы"
      Link "Настройка SharePoint"
      Link "Авторизация"
    Typography h4 "Подключите рабочую учётную запись"
    Stepper orientation=horizontal
      Step label="Сайт" completed
      Step label="Авторизация" active
      Step label="Библиотека"
      Step label="Настройки"
    Card
      CardHeader title="Доступ Microsoft"
      CardContent
        Stack column gap=2
          Typography body1 "Откройте страницу Microsoft для входа и согласия на Sites.Read.All."
          Typography body2 "После возврата сервер проверит доступ к указанному сайту."
          Button "Авторизовать в Microsoft" contained
          Progress variant=circular value=0
          Alert "Токены остаются на сервере. В браузер возвращается только результат авторизации." severity=info
    Link "Вернуться к черновику"

~~~

### Выбор библиотеки

~~~wireframe
Wireframe #libraries landscape
  Stack column gap=2 padding=3
    Breadcrumbs
      Link "Коннекторы"
      Link "Новый SharePoint"
      Link "Библиотека"
    Typography h4 "Выберите библиотеку"
    Stepper orientation=horizontal
      Step label="Сайт" completed
      Step label="Авторизация" completed
      Step label="Библиотека" active
      Step label="Настройки"
    Card
      CardHeader title="Сайт доступен"
      CardContent
        Typography body2 "https://contoso.sharepoint.com/sites/legal"
        Typography caption "Библиотеки загружены с Microsoft Graph"
        Select "Библиотека документов" value="Документы"
          Option "Документы · 1 248 файлов" selected
          Option "Общие документы · 54 файла"
          Option "Архив · 8 012 файлов"
        Alert "В конфигурации сохраняется ID библиотеки, а не только её отображаемое имя." severity=info
    Stack row
      Button "Назад" outlined
      Spacer
      Button "Продолжить" contained

~~~

### Настройки индексации

~~~wireframe
Wireframe #settings landscape
  Stack column gap=2 padding=3
    Breadcrumbs
      Link "Коннекторы"
      Link "SharePoint — договоры"
      Link "Настройки"
    Typography h4 "Область индексации"
    Stepper orientation=horizontal
      Step label="Сайт" completed
      Step label="Авторизация" completed
      Step label="Библиотека" completed
      Step label="Настройки" active
    Stack row gap=2
      Card
        CardHeader title="Источник"
        CardContent
          Stack column gap=2
            TextField "Сайт" value="https://contoso.sharepoint.com/sites/legal" disabled
            TextField "Библиотека" value="Документы · driveId сохранён" disabled
            TextField "Папка внутри библиотеки (необязательно)" placeholder="Например: /Договоры/2026"
            Alert "Пустой путь или / означает всю библиотеку." severity=info
      Card
        CardHeader title="Индексация"
        CardContent
          Stack column gap=2
            TextField "Интервал опроса (сек.)" value="300" required
            TextField "Максимальный размер файла (байт)" value="52428800" required
            Stack row
              Control checkbox checked
              Typography body2 "Включать скрытые файлы"
            Alert "Значения проверяются сервером до включения." severity=info
    Stack row
      Button "Сохранить как черновик" outlined
      Spacer
      Button "Проверить и включить" contained

~~~

### Подключённый источник

~~~wireframe
Wireframe #online landscape
  Stack column gap=2 padding=3
    Breadcrumbs
      Link "Коннекторы"
      Link "SharePoint — договоры"
    Typography h4 "SharePoint — договоры"
    Alert "ONLINE · доступ к сайту и библиотеке подтверждён" severity=success
    Card
      CardHeader title="Область"
      CardContent
        Stack column gap=1
          Typography body1 "contoso.sharepoint.com/sites/legal"
          Typography body1 "Библиотека: Документы"
          Typography body2 "Папка: /Договоры/2026"
          Typography caption "В runtime воркера передаются короткоживущий access token, siteId, driveId и scope."
    Stack row
      Button "Открыть поиск" contained
      Spacer
      Link "Смоделировать истёкшую авторизацию"

~~~

### Повторная авторизация

~~~wireframe
Wireframe #reauth landscape
  Stack column gap=2 padding=3
    Breadcrumbs
      Link "Коннекторы"
      Link "SharePoint — договоры"
    Typography h4 "Нужно переподключить Microsoft"
    Alert "REAUTH_REQUIRED · доступ отозван или авторизация истекла" severity=error
    Card
      CardHeader title="Данные коннектора сохранены"
      CardContent
        Typography body2 "Проверьте рабочую учётную запись и повторно подтвердите доступ к сайту."
        Typography caption "Если изменилась организация, создайте новую авторизацию для нужного tenant."
    Stack row
      Button "Позже" outlined
      Spacer
      Button "Переподключить" contained

~~~

### Поиск по источникам

~~~wireframe
Wireframe #search landscape
  Stack column gap=2 padding=3
    Breadcrumbs
      Link "Поиск"
      Link "Новый запрос"
    Typography h4 "Поиск по источникам"
    TextField "Что найти?" value="условия расторжения договора" endIcon=Search fullWidth
    Typography subtitle1 "Искать в"
    Stack row
      Chip "SharePoint — договоры"
      Chip "OneDrive — Отдел продаж" variant=outlined
      Chip "Dropbox — Архив" variant=outlined
    Stack row
      Button "Найти" contained
      Spacer
      Typography body2 "Выбраны источники: 3"
    Alert "Визуальный пример результата. Фактический поиск SharePoint требует Rust-воркер." severity=warning
    Card
      CardHeader title="Договор поставки № 2026-041"
      CardContent
        Stack column gap=1
          Typography body2 "SharePoint · Документы / Договоры / 2026"
          Typography body2 "Найден фрагмент: условия расторжения договора..."
          Link "Открыть в SharePoint"
~~~

## Обмен данными и границы безопасности

~~~mermaid
sequenceDiagram
    actor Admin as Администратор
    participant UI as Web UI
    participant Server as Сервер приложения
    participant Entra as Microsoft Entra
    participant Graph as Microsoft Graph
    participant Worker as Rust SharePoint worker

    Admin->>UI: Указать siteUrl и сохранить
    UI->>Server: Создать SharePoint draft (disabled)
    Server-->>UI: connectorId, безопасная конфигурация
    UI->>Server: Начать OAuth для connectorId
    Server-->>UI: URL авторизации + одноразовый state/PKCE
    UI->>Entra: Перейти на вход и согласие
    Entra->>Server: Callback с authorization code и state
    Server->>Entra: Обменять code, проверить Sites.Read.All
    Entra-->>Server: access token + refresh token
    Server->>Graph: Разрешить siteUrl, получить siteId
    Graph-->>Server: siteId и сведения о сайте
    Server->>Server: Зашифрованно сохранить refresh token и привязку сайта
    Server-->>UI: Статус текущей OAuth-транзакции
    UI->>Server: GET /ajax/search/connector/sharepoint/drives
    Server->>Graph: GET /sites/{siteId}/drives (все страницы)
    Graph-->>Server: Доступные библиотеки
    Server-->>UI: Список {id, name, webUrl}
    Admin->>UI: Выбрать driveId и необязательную папку
    UI->>Server: Сохранить конфигурацию и включить
    Server->>Graph: Повторно проверить siteId/driveId и доступ
    Server->>Server: Обновить revision и reconcile
    Server->>Entra: Обновить access token при необходимости
    Entra-->>Server: Короткоживущий access token
    Server->>Worker: connector.configure (siteId, driveId, scope, access token)
    Note over UI,Server: Ни refresh token, ни access token не возвращаются в Web UI или REST
    Worker->>Graph: Delta выбранной библиотеки
    Graph-->>Worker: Изменённые и удалённые элементы
~~~

~~~mermaid
flowchart TD
    subgraph AdminPath["Настройка коннектора"]
      UI[Angular UI] --> REST[Company-scoped REST]
      REST --> OAuth[SharePoint OAuth service]
      OAuth --> Entra[Microsoft Entra]
      OAuth --> Site[Graph: разрешить сайт]
      Site --> Drives[Graph: список drives]
      Drives --> Choice[driveId + rootFolder]
      Choice --> Validate[Повторная проверка перед включением]
    end

    subgraph Runtime["Индексация и поиск"]
      Validate --> Configure[connector.configure]
      Configure --> Worker[Rust SharePoint worker]
      Worker --> Delta[Graph delta для driveId]
      Delta --> Download[Получить содержимое файла]
      Download --> Index[Существующий поисковый индекс]
      Query[Поисковый запрос с connector_ids] --> Index
      Index --> Result[Обычный ConnectorResult]
    end

    Entra -. refresh token зашифрован на сервере .-> OAuth
    Worker -. checkpoint на connector_id + scope .-> Delta
~~~

~~~mermaid
stateDiagram-v2
    [*] --> Draft: Создать выключенный черновик
    Draft --> Authorizing: Начать OAuth
    Authorizing --> Authorized: Callback проверен
    Authorizing --> Draft: Отказ или ошибка state
    Authorized --> LibrarySelected: Выбрать driveId
    LibrarySelected --> Enabled: Проверка сайта и библиотеки прошла
    LibrarySelected --> LibraryError: Библиотека недоступна
    LibraryError --> LibrarySelected: Выбрать другую
    Enabled --> ReauthRequired: AUTH_EXPIRED или отзыв доступа
    ReauthRequired --> Authorizing: Повторное подключение
    Enabled --> Enabled: Обновить токен / configure
~~~

## Контракт одного коннектора

| Поле | Что означает |
|---|---|
| `type` | `sharepoint` — отдельный тип, OneDrive остаётся отдельным коннектором. |
| `siteUrl` | Канонический HTTPS URL одного сайта SharePoint Online. |
| `driveId` | ID одной выбранной библиотеки; пуст до выбора. |
| `rootFolder` | Путь или DriveItem ID внутри библиотеки; пусто или `/` — вся библиотека. |
| `includeHidden`, `maxFileBytes`, `pollIntervalSeconds` | Настройки индексации с валидацией Java и Angular. |
| OAuth credentials | Зашифрованные на сервере refresh token, siteId, tenantId и scope. REST возвращает только признак наличия credentials и безопасный статус. |
| Runtime credentials | Короткоживущий access token, siteId, driveId и scope только в `connector.configure`; refresh token воркеру не передаётся. |

При смене сайта библиотека и статус проверки сбрасываются. Новый сайт требует новой OAuth-привязки; смена tenant требует новой авторизации. Библиотека и папка входят в revision scope, чтобы воркер не продолжал индексировать прежнюю область.

## Оставшаяся работа

~~~mermaid
flowchart LR
    A[Согласовать runtime-контракт] --> B[Реализовать SharePoint worker в Rust]
    B --> C[Читать выбранный drive через Microsoft Graph]
    C --> D[Хранить delta checkpoint по connector_id и scope]
    D --> E[Удалять исчезнувшие документы]
    E --> F[Возвращать существующий ConnectorResult]
    F --> G[Проверить end-to-end на тестовом tenant]
~~~

- Реализовать сканер в Rust-модуле поиска по согласованному runtime-контракту. Формат `ConnectorResult` и механизм выбора цели поиска на сервере не менять.
- Вести отдельный delta checkpoint для каждого `connector_id` и scope; обрабатывать изменения и удаления файлов.
- Различать безопасные состояния: `REAUTH_REQUIRED`, отсутствие доступа, удалённая библиотека, 429 с `Retry-After` и временные ошибки Graph.
- В настройках развёртывания нужны зарегистрированное приложение Microsoft Entra, tenant, callback URL и admin consent для `Sites.Read.All`. Первый вариант OAuth — delegated с `offline_access`.
- После реализации воркера пройти ручной сценарий: OAuth → сайт и библиотека → `ONLINE` → выбрать источник в поиске → получить SharePoint-файл; повторить после истечения токена и отзыва доступа.

## Проверки, записанные в исходном плане

| Проверка | Статус в исходнике |
|---|---|
| `mvn -q -DskipTests compile` в модуле сервера | ✅ Успешно |
| `mvn -q test` в модуле сервера | ✅ Успешно |
| `npm run build -- --configuration development` в модуле Web UI | ✅ Успешно |
| Live-интеграция с реальным Microsoft tenant | ⏳ Не выполнялась |
| Сквозной поиск SharePoint-файла | ⏳ После реализации Rust-воркера |

Критерий безопасности для готового сценария: токены не попадают в REST-ответы, браузер или логи; секреты не хранятся в `configJson`. Существующие OneDrive, Dropbox и IMAP продолжают работать через общий механизм коннекторов.

## Ссылки Graph API

- [Получение сайта по hostname и относительному пути](https://learn.microsoft.com/en-us/graph/api/site-getbypath?view=graph-rest-1.0)
- [Список библиотек сайта](https://learn.microsoft.com/en-us/graph/api/drive-list?view=graph-rest-1.0)
- [Delta для файлов](https://learn.microsoft.com/en-us/graph/api/driveitem-delta?view=graph-rest-1.0) и [скачивание содержимого](https://learn.microsoft.com/en-us/graph/api/driveitem-get-content?view=graph-rest-1.0)
- [Разрешения Graph](https://learn.microsoft.com/en-us/graph/permissions-reference) и [429 / throttling](https://learn.microsoft.com/en-us/graph/throttling)

