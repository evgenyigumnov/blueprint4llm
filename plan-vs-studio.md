# План расширения blueprint4llm для Visual Studio Code

> В этом плане «VS Studio» означает Visual Studio Code (VS Code), настольную версию. Расширение открывает предпросмотр Markdown рядом с редактором и использует существующий рендерер `blueprint4llm`.

## Цель и границы

Пользователь открывает `.md`-файл, запускает команду **Blueprint: Open Preview to the Side** и видит тот же документ, что создаёт `blueprint4llm`: Markdown, локальные изображения, Mermaid и Wiremark. Предпросмотр обновляется при редактировании, в том числе до сохранения файла.

Первая версия предназначена для настольного VS Code и файлов `.md` на диске. Она не заменяет текстовый редактор, не редактирует Markdown визуально и не публикуется в Marketplace в рамках реализации самого расширения.

## Что уже есть в проекте

| Возможность | Текущая точка входа |
|---|---|
| Компиляция текста Markdown в полный HTML-документ | `compileMarkdown()` в `src/compiler.ts` |
| Mermaid и Wiremark в SVG | `src/renderers/mermaid.ts`, `src/renderers/wiremark.ts` |
| Проверка ссылок и SVG, безопасное экранирование HTML | `src/plugins/remark-safe-links.ts`, `src/svg/` и `src/compiler.ts` |
| Сбор локальных изображений в результат компиляции | `src/assets.ts`; `CompiledBlueprint.assets` содержит байты и метаданные |
| Повторная сборка и просмотр сохранённого файла в браузере | `startPreviewServer()` в `src/server.ts` |
| Экспорт в PDF | `renderPdf()` в `src/pdf.ts` |

Для предпросмотра внутри редактора следует вызывать `compileMarkdown()` напрямую с текстом из `TextDocument.getText()`. `startPreviewServer()` читает файл с диска, поэтому не увидит несохранённые изменения без доработки своего контракта.

## Выбор UI и способа интеграции

Сделать расширение в отдельном пакете `vscode-extension/`, не смешивая его зависимости и manifest с CLI. Использовать `WebviewPanel`, открываемую в соседней колонке, и переиспользовать HTML, созданный компилятором.

Встроенный Markdown Preview VS Code расширяется через `markdown-it` plugins. `blueprint4llm` использует `remark`/`unified`, собственную обработку изображений и асинхронный рендеринг Mermaid. Webview сохраняет существующее поведение проекта без переноса конвейера на другой парсер. Подробнее: [Markdown Extension API](https://code.visualstudio.com/api/extension-guides/markdown-extension) и [Webview API](https://code.visualstudio.com/api/extension-guides/webview).

Для статической страницы предпросмотра отключить JavaScript в Webview. Сформировать Content Security Policy, разрешить только необходимые стили и изображения, задать узкий `localResourceRoots`. Локальные изображения из `CompiledBlueprint.assets` записывать в отдельную временную папку расширения, URL `assets/<outputName>` заменять на `webview.asWebviewUri(...)`, папку ограничить корнем ресурсов Webview и удалять после закрытия панели. Внешние HTTP(S)-изображения разрешать политикой CSP, как в текущем HTML-рендерере.

Для кеширования Mermaid добавить публичный экспорт `DiagramRenderCache` из корневого API либо небольшой публичный preview-session API. Кешировать только результаты диаграмм между пересборками одного документа.

## Основной экран

Редактор остаётся стандартным редактором VS Code; расширение показывает справа результат компиляции. Каждая Wiremark-диаграмма ниже описывает один отдельный экранный макет.

~~~wireframe
Wireframe #blueprint-preview landscape
  Stack row gap=2 padding=2
    Card
      CardHeader title="Редактор Markdown"
      CardContent
        Stack column gap=1
          Typography caption "blueprint.md · Markdown"
          Typography body1 "# Blueprint: обработка заявки"
          Typography body2 "## Компоненты"
          Typography body2 "| API | Проверяет и сохраняет заявку |"
          Typography body2 "## Поток обработки"
          Typography body2 "```mermaid · flowchart LR · User → API → Queue```"
          Typography caption "Изменения в редакторе сразу попадают в предпросмотр"
    Card
      CardHeader title="Blueprint Preview"
      CardContent
        Stack column gap=1
          Typography caption "Автообновление · Последняя сборка успешна"
          Typography h3 "Blueprint: обработка заявки"
          Typography h4 "Компоненты"
          Table
            TableHead
              TableRow
                TableCell "Компонент"
                TableCell "Ответственность"
            TableBody
              TableRow
                TableCell "API"
                TableCell "Проверяет и сохраняет заявку"
          Typography h4 "Поток обработки"
          Typography body2 "Скомпилированная диаграмма Mermaid / Wiremark"
~~~

## Экран ошибки сборки

При ошибке компиляции оставить панель открытой и показать диагностику с путём к файлу и строкой, если они доступны. После исправления документа автоматически вернуть нормальный предпросмотр.

~~~wireframe
Wireframe #blueprint-preview-error landscape
  Stack column gap=2 padding=3
    Typography h3 "Не удалось построить предпросмотр"
    Alert "blueprint.md:18: Mermaid: ошибка синтаксиса" severity=error
    Typography body2 "Исправьте блок диаграммы. Предпросмотр обновится после следующего изменения."
    Card
      CardHeader title="Диагностика"
      CardContent
        Typography body2 "```mermaid"
        Typography body2 "flowchart LR"
        Typography body2 "A -->"
~~~

## Поток данных и обновления

~~~mermaid
flowchart LR
    A[Пользователь открывает .md] --> B[Команда Blueprint Preview]
    B --> C[Extension host получает TextDocument]
    C --> D[compileMarkdown: текущий буфер + путь документа]
    D --> E{Компиляция успешна?}
    E -- Да --> F[Подготовить локальные изображения и CSP]
    F --> G[Обновить WebviewPanel]
    E -- Нет --> H[Показать диагностику]
    I[Изменение текста] --> J[Debounce 200 мс]
    J --> K[Отменить устаревшую сборку]
    K --> D
    L[Закрытие панели] --> M[Отменить сборку и очистить кеш / временные файлы]
~~~

## Структура пакета расширения

```text
vscode-extension/
├── package.json                 # VS Code manifest, команды, меню, настройки
├── tsconfig.json
├── src/
│   ├── extension.ts             # регистрация команды и VS Code подписок
│   ├── preview-controller.ts    # сессии по документам, debounce, отмена и кеш
│   ├── webview-html.ts          # CSP, URL локальных ресурсов и экран ошибки
│   └── diagnostics.ts           # преобразование ошибок в UI / Output Channel
└── test/
    ├── preview-controller.test.ts
    └── webview-html.test.ts
```

Зависимость от `blueprint4llm` подключить как локальный пакет монорепозитория для разработки и как production dependency при сборке VSIX. Сборка расширения должна включать все необходимые runtime-пакеты Mermaid/Wiremark, но исключать `vscode` API из бандла. Перед выбором bundler проверить, что Mermaid CLI и Puppeteer находят собственные файлы и Chrome после упаковки.

## Команды и настройки расширения

| ID / настройка | Назначение |
|---|---|
| `blueprint4llm.openPreview` | Открыть или сфокусировать предпросмотр активного Markdown-файла |
| `blueprint4llm.exportPdf` | Экспортировать текущий результат предпросмотра в PDF; этап 4 |
| `blueprint4llm.preview.debounceMs` | Задержка перед пересборкой, по умолчанию около 200 мс |

## Проверки и тесты

- Unit-тесты контроллера: debounce, изоляция документов, отмена старой сборки, порядок завершения сборок и закрытие панели.
- Unit-тесты HTML-адаптера: CSP, URL локальных ресурсов, отсутствие исполняемых скриптов, безопасная обработка диагностического текста.
- Тесты VS Code API: команда доступна только для Markdown, повторный вызов не создаёт лишнюю панель, изменения несохранённого документа обновляют её.
- Ручная проверка в Extension Development Host: обычный Markdown, Mermaid, Wiremark, локальные изображения, ошибочная диаграмма, тёмная и high contrast темы, закрытие и повторное открытие панели.
- Проверка release artifact: собрать VSIX и установить его в чистый профиль VS Code, проверить диагностику отсутствующего Chrome и работу с установленным Chrome.
- Существующие `npm test`, `npm run build`, `npm run typecheck`, `npm run lint` и `npm run format:check` должны оставаться зелёными; проверки расширения добавить отдельными скриптами в `vscode-extension/package.json`.

## Критерии готовности первой версии

- Команда открывает предпросмотр активного `.md` справа от редактора.
- Изменение текста обновляет панель без сохранения файла и не приводит к отображению устаревшего результата.
- Mermaid и Wiremark выглядят так же, как в HTML, собранном CLI/API.
- Локальные изображения доступны только через разрешённые Webview URI; сырой HTML из Markdown не исполняется.
- Ошибки показывают понятное сообщение и не закрывают панель; после исправления показывается актуальный результат.
- Закрытие панели освобождает её подписки, кеш и временные файлы.
- VSIX работает в заявленных версиях VS Code и документирует установку Chrome, необходимого Mermaid renderer.

## Ссылки

- [Исходный код и README blueprint4llm](README.md)
- [VS Code: Markdown Extension API](https://code.visualstudio.com/api/extension-guides/markdown-extension)
- [VS Code: Webview API и рекомендации по CSP](https://code.visualstudio.com/api/extension-guides/webview)
- [Wiremark: инструкция для LLM и синтаксис блоков](https://docs.wiremark.dev/wiremark-llm.md)

## Этапы реализации

### 1. Проверка runtime и упаковки

- Создать минимальный пакет `vscode-extension/` и проверить запуск расширения в Extension Development Host.
- Проверить требование `blueprint4llm`: Node.js `>=22.13.0`, Mermaid CLI, Puppeteer и установленный Chrome. Уточнить, совместим ли Node runtime целевой версии VS Code с этим требованием.
- Собрать тестовый VSIX и проверить, что зависимости и Mermaid CLI разрешаются из установленного пакета. Браузер Chrome не встраивать автоматически; при его отсутствии показать понятную инструкцию установки из README.
- Зафиксировать минимальную версию VS Code и поддерживаемые ОС после проверки Node/Puppeteer.

### 2. Контроллер предпросмотра

- Зарегистрировать команду `blueprint4llm.openPreview` и добавить её в Command Palette, меню редактора и заголовок Markdown-файла.
- Создавать или повторно открывать отдельный `WebviewPanel` для URI документа; открывать панель рядом с редактором.
- Компилировать текущий несохранённый текст через `compileMarkdown(text, { sourceFile, diagramCache, signal })`.
- Подписаться на `workspace.onDidChangeTextDocument`, фильтровать события по URI открытых панелей, объединять частые изменения debounce около 200 мс.
- При новом изменении отменять старую сборку через `AbortController`; обновлять панель только результатом самой свежей версии документа.
- Передавать предупреждения и ошибки Mermaid/Wiremark в Output Channel и отображать существенные ошибки в предпросмотре.
- При закрытии Webview отменять текущую компиляцию, снимать подписки, очищать кеш диаграмм и удалять временные изображения.

### 3. HTML для Webview

- Переиспользовать `CompiledBlueprint.html`, не запускать HTTP-сервер и не поднимать отдельный браузерный процесс для предпросмотра.
- Переписать URL локальных изображений на Webview-URI файлов из временной папки расширения; писать туда только `CompiledBlueprint.assets` текущего документа.
- Вставить CSP до содержимого документа: без скриптов и соединений; стили ограничить встроенными стилями проекта, изображения — Webview-URI, data URI и HTTP(S), как в текущем рендерере.
- Сохранить семантику компилятора: CommonMark/GFM, безопасные ссылки, экранирование raw HTML, inline SVG диаграмм и таблицы.
- При сборочной ошибке рендерить отдельную страницу диагностики; не вставлять необработанные данные Markdown в HTML.
- Поддержать светлую, тёмную и high contrast темы VS Code CSS-переменными и классами темы Webview.

### 4. Экспорт PDF и дополнительные функции

- После стабильного предпросмотра добавить команду `Blueprint: Export Preview as PDF` через имеющийся `renderPdf()`.
- Сохранять PDF через стандартный диалог VS Code; передавать тот же `CompiledBlueprint`, что показан в Webview.
- Добавить настройку внешних изображений и формата автообновления только если это потребуется по обратной связи.
- Поддержку VS Code Web, Codespaces и других удалённых/виртуальных файловых систем рассматривать отдельно: текущие Mermaid renderer и компилятор используют Node API и локальные пути.
