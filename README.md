# blueprint4llm

`blueprint4llm` помогает наглядно читать и проверять планы разработки, написанные человеком или ИИ-агентом. Он превращает обычный Markdown в HTML или PDF, заранее отрисовывая диаграммы Mermaid, PlantUML, draw.io JSON, Pencil `.pen` и Balsamiq Mockups 3 JSON, а также макеты интерфейсов Wiremark: так проще увидеть, как устроена система и как будут выглядеть её экраны. Для работы над черновиком есть локальный предпросмотр с автообновлением и загрузкой актуального PDF. Markdown остаётся исходником, сам инструмент не вызывает LLM.

## Почему `blueprint4llm`

`blueprint` — это технический план продукта: текст, таблицы, диаграммы и макеты интерфейсов. `4llm` читается как «for LLM»: Markdown удобен и для LLM-агентов, которые создают или меняют план, и для людей, которые его проверяют. Название отражает назначение инструмента: сделать такие планы наглядными для чтения и обсуждения как для человека так и для LLM-агентов.

## Требования и установка

- Node.js `>=22.13.0`.
- npm и браузер Chrome, установленный через Puppeteer.

Сборка из клона репозитория:

```bash
npm install
npm ci
npx puppeteer browsers install chrome
npm run build
```

Для команды `blueprint4llm` можно создать глобальную npm-ссылку из каталога проекта:

```bash
npm link
blueprint4llm --help
```

Без ссылки CLI доступен через `node dist/cli.js`.

## Использование

Сборка HTML (формат по умолчанию):

```bash
blueprint4llm examples/blueprint.md --out=./dist-preview/blueprint.html
```

Экспорт в PDF:

```bash
blueprint4llm examples/blueprint.md --out=./dist-pdf/blueprint.pdf --format=pdf
```

`--out` указывает полный путь выходного файла; родительские каталоги создаются автоматически. CLI создаёт один формат за запуск. SVG Mermaid, PlantUML, Wiremark, draw.io, Pencil и Balsamiq встраиваются в HTML, отдельные SVG-файлы не создаются. Локальные изображения сохраняются в `assets/` рядом с HTML. Созданный HTML можно открыть напрямую через `file://`.

Проверка перед ревью или публикацией, например в CI:

```bash
blueprint4llm examples/blueprint.md --check
```

`--check` разбирает Markdown, запускает рендереры диаграмм и проверяет локальные изображения, но не создаёт HTML или PDF. Предупреждения выводятся в stderr; ошибки проверки завершают команду с кодом `1`.

Локальный предпросмотр с автоматическим обновлением:

```bash
blueprint4llm examples/blueprint.md --serve
blueprint4llm examples/blueprint.md --serve --port=8081
```

Сервер слушает только `127.0.0.1`, отслеживает Markdown и используемые локальные изображения и завершает работу по `Ctrl+C`. Предпросмотр растягивается по ширине окна браузера. Рядом со ссылкой Download PDF находится переключатель Dark mode; выбор темы сохраняется в браузере. PDF строится при первом запросе и кэшируется до изменения документа. Браузер автоматически не открывается.

### Предпросмотр в Visual Studio Code

Пакет расширения находится в `vscode-extension/`. Установите собранный VSIX командой `code --install-extension <путь-к-файлу.vsix>`, откройте файл `.md` и выполните **Blueprint: Open Preview to the Side** из Command Palette или заголовка редактора. Предпросмотр компилирует текущий буфер, обновляется после правок с задержкой 200 мс и показывает ошибки компиляции, не закрывая панель. Задержку можно изменить настройкой `blueprint4llm.preview.debounceMs`.

Для сборки VSIX и требований к Chrome смотрите [инструкцию расширения](vscode-extension/README.md).

## Формат Markdown

Поддерживаются CommonMark и GitHub Flavored Markdown: заголовки, списки, таблицы, чекбоксы, ссылки, изображения, цитаты и блоки кода. Диаграммы задаются fenced-блоками:

- `mermaid` — Mermaid через локальный официальный Mermaid CLI.
- `plantuml` — PlantUML через локальный JavaScript/Wasm-движок [`@plantuml/core`](https://github.com/plantuml/plantuml/blob/master/PUBLISHING_NPM.md).
- `wireframe` — канонический идентификатор Blackburn-Labs Wiremark.
- `wiremark` — дополнительный алиас для удобства.
- `drawio` и `draw.io` — структурный JSON-экспорт draw.io с локальной автоматической раскладкой.
- `pencil` и `pen` — встроенный JSONC-документ Pencil версии `2.21`, преобразованный в локальный SVG.
- `balsamiq` — JSON одного mockup из Balsamiq Mockups 3, преобразованный в локальный SVG.

Для Mermaid renderer задаёт вертикальное направление (`TB`/`TD`) для типов диаграмм, которые поддерживают настройку направления. У типов с фиксированной компоновкой, например `sequenceDiagram`, сохраняется их естественная раскладка.

PlantUML-блок содержит одну диаграмму с обычными директивами `@start...` и `@end...`. Движок `@plantuml/core@1.2026.9` работает локально в Chromium, который уже используется для PDF и предпросмотра; отдельная установка Java не требуется. Рендеринг не отправляет исходник на сервер и работает без сети. Внешние запросы, локальные `!include`, `!includeurl` и стандартные библиотеки отключены. Размер SVG ограничен 8192 px по стороне, одновременно выполняются не более двух PlantUML-рендеров.

Обычные fenced-блоки кода с известной Shiki языковой меткой подсвечиваются при компиляции: цветовые токены уже встроены в HTML, поэтому standalone HTML работает без JavaScript и сети. В локальном предпросмотре цвета кода переключаются вместе с тёмной темой; PDF сохраняет светлую палитру. Блок без метки языка или с неизвестной меткой остаётся обычным безопасно экранированным кодом, а inline-код не меняется. Отдельный блок больше 64 КиБ в UTF-8 тоже остаётся обычным экранированным кодом, чтобы ограничить время компиляции. Mermaid, PlantUML, Wiremark, draw.io, Pencil и Balsamiq обрабатываются как диаграммы и встраиваются в виде SVG.

### Макеты Pencil

Вставьте JSONC из `.pen` в fenced-блок `pencil` или `pen`. В первой версии поддерживается встроенный документ схемы `2.21`, без сетевых запросов. Рендерер поддерживает frame и group, прямоугольники, эллипсы, многоугольники, SVG path и текст; также поддерживает однотонную заливку и обводку, прозрачность, поворот, скругления, clipping у frame и простой layout. Текст с `textGrowth: "fixed-width"` переносится по ширине с приблизительной оценкой символов, поэтому перенос может отличаться от pen.dev.

Импорты, ссылки на компоненты, переменные и темы, изображения, градиенты, эффекты и скрипты не поддерживаются. Такие свойства и неизвестные видимые свойства завершают рендеринг с диагностикой. JSONC ограничен 1 MiB, документ — 10 000 узлами и глубиной 100, многоугольник — 256 сторонами, текст — 10 000 строк, итоговый SVG — 4 MiB и 16 384 px на сторону. Пример находится в [`examples/blueprint-pencil.md`](examples/blueprint-pencil.md).

### Макеты Balsamiq

Вставьте JSON одного mockup из Balsamiq Mockups 3 в блок `balsamiq`. Рендерер сохраняет координаты, порядок слоёв и текст, затем строит локальный inline SVG. Пример находится в [`examples/blueprint-balsamiq.md`](examples/blueprint-balsamiq.md).

Поддерживаются `Canvas`, `Label`, `Title`, `SubTitle`, `Paragraph`, `TextInput`, `TextArea`, `Button`, `CheckBox`, `RadioButton`, `ComboBox`, `List`, `Rectangle` и `Line`. Размеры макета берутся из `measuredW`/`measuredH`; совместимые поля `mockupW`/`mockupH` и размеры control `Canvas` служат запасными источниками. JSON ограничен 256 KiB, 3 000 controls и глубиной 100; сторона макета ограничена 4 056 px, SVG — 4 MiB. `.bmpr`, `.bmml`, внешние assets, symbols и точная имитация Balsamiq skin не поддерживаются. Лимит canvas взят из [документации Mockups 3](https://balsamiq.com/assets/product/mockups3fordesktop/balsamiq-mockups-3-for-desktop-documentation.pdf).

### Диаграммы draw.io

Скопируйте JSON через **File → Export as → JSON** в fenced-блок `drawio` или `draw.io`. Пример с узлами, группой и связями есть в [`examples/blueprint-draw.io.md`](examples/blueprint-draw.io.md).

Если экспорт содержит одну страницу, renderer выберет её сам. Для нескольких страниц укажите ID параметром `page=<id>`. Направление задаёт `direction=TB` (сверху вниз, по умолчанию) или `direction=LR` (слева направо). Например: `page=release direction=LR`.

JSON сохраняет связи, подписи и группы, но не геометрию и стили исходного файла. Renderer строит новую схему со стандартными прямоугольниками и направленными стрелками. Поля `html` и `data` не отображаются; подписи остаются обычным текстом. `.drawio` XML пока не поддерживается. Рендеринг локальный, без сетевых запросов; inline SVG используется в HTML, `--serve`, предпросмотре VS Code и PDF. Изменение Markdown автоматически перестраивает предпросмотр.

### Кадры Figma

Блок `figma` принимает ответ Figma REST API в JSON или HTTPS-ссылку на кадр из `/design/` или `/file/`. JSON должен содержать `document` типа `DOCUMENT`; локальный режим не требует токена и сети. Если в документе несколько кадров верхнего уровня, укажите ID кадра в metadata блока: ` ```figma node=12:34 `.

Локальный рендерер поддерживает контейнеры `FRAME`, `GROUP`, `COMPONENT`, `INSTANCE`; фигуры `RECTANGLE`, `ELLIPSE`, `LINE`; текст `TEXT` и векторные пути `VECTOR` с `geometry=paths`. Он отображает solid fills и strokes, прозрачность, скругления и поворот. Градиенты, эффекты, маски, растровые данные из JSON и сложные текстовые переопределения не поддерживаются. Для таких макетов используйте URL-режим или экспортируйте кадр в обычное Markdown-изображение. JSON-блок ограничен 1 MiB, 10 000 узлами и глубиной 100 уровней.

URL-режим требует персональный токен Figma с разрешением `file_content:read`. Компилятор ищет его в таком порядке: `CompileOptions.figmaAccessToken`, `FIGMA_ACCESS_TOKEN`, затем `.env` в текущей рабочей папке. Например:

```ts
const compiled = await compileMarkdown(markdown, {
  sourceFile: '/project/blueprint.md',
  figmaAccessToken: process.env.FIGMA_ACCESS_TOKEN,
});
```

Токен передаётся только `api.figma.com`. API-запрос и скачивание временного SVG выполняются только для URL-блока. Компилятор проверяет SVG и встраивает его в HTML; готовый HTML и PDF не требуют сети. Остальные query-параметры ссылки, включая `t`, не передаются API. Диагностики указывают файл и строку блока и не содержат токен, исходный JSON или временную ссылку. Полный пример JSON и URL находится в [`examples/blueprint-figma.md`](examples/blueprint-figma.md).

Произвольный HTML в Markdown экранируется. SVG всех диаграмм проходят общую проверку на активные элементы, обработчики событий и внешние ресурсы; небезопасные URL в ссылках удаляются.

Локальные изображения разрешаются относительно каталога Markdown и копируются в `assets/` рядом с выходным HTML-файлом. Сборка запрещает выход из каталога проекта через `..` или symlink. Внешние HTTP(S)-картинки остаются внешними в HTML. Для PDF они не разрешены: сохраните такую картинку локально и используйте относительный путь. PDF собирается в A4 с локальным Noto Sans; текст и ссылки остаются доступными в PDF.

## Ограничения

- Размер исходного Markdown — до 5 MiB, до 100 диаграмм и до 256 KiB исходника на одну диаграмму, если renderer не задаёт отдельный лимит.
- Один draw.io JSON-блок ограничен 1 MiB, страница — 10 000 ячейками, документ — 100 страницами. SVG ограничен 4 MiB и 16 384 px на сторону; раскладка завершается по тайм-ауту 5 секунд.
- Mermaid- и PlantUML-блоки ограничены тайм-аутом 30 секунд; сборка PDF — 60 секунд.
- PDF использует установленный Puppeteer Chrome/Chromium и требует подходящих системных библиотек на Linux. Установите браузер командой `npx puppeteer browsers install chrome`.
- Chromium sandbox включён по умолчанию. Если ОС запрещает запуск sandbox, Mermaid и PDF автоматически повторят запуск с `--no-sandbox`. Переменная `BLUEPRINT4LLM_DISABLE_CHROME_SANDBOX=1` оставлена для принудительного запуска без sandbox.
- Raw HTML, выполнение пользовательского JavaScript, графическое редактирование и форматы, кроме HTML/PDF, не входят в текущую версию.
- Отдельные картинки SVG хранятся inline в HTML; соседние `.svg` для диаграмм не создаются.

Ошибки Mermaid, PlantUML и Wiremark включают исходный файл и строку блока. Если PlantUML вернул SVG с ошибкой синтаксиса, оно остаётся видимым в предпросмотре, а диагностика указывает строку внутри диаграммы. Ошибочная сборка в режиме `--serve` показывает диагностику, не завершая сервер; после исправления файла предпросмотр обновится.

## Программный API

Пакет экспортирует компилятор Markdown, PDF renderer, функции записи и сервер предпросмотра:

```ts
import { compileMarkdown, renderPdf, writeBlueprintOutput } from 'blueprint4llm';

const compiled = await compileMarkdown(markdown, {
  sourceFile: '/project/blueprint.md',
});
const pdf = await renderPdf(compiled);

await writeBlueprintOutput('/project/output.html', {
  html: compiled.html,
  assets: compiled.assets,
  pdf,
});
```

`compileMarkdown()` возвращает `CompiledBlueprint` с `html`, `title`, `assets` и предупреждениями. `renderPdf()` принимает этот же результат и необязательный `{ signal: AbortSignal }`. `writeBlueprintOutput(outputFile, options)` записывает содержимое по указанному пути; при передаче обоих форматов создаёт соседний файл второго формата и возвращает абсолютные пути результатов.

`startPreviewServer({ input, port, signal })` запускает предпросмотр и возвращает handle с `url`, выбранным `port` и асинхронным `close()`. Публичные типы `CompiledBlueprint`, `CompileOptions`, `RenderPdfOptions`, `PreviewServerOptions` и `PreviewServerHandle` доступны из корневого экспорта.

## Разработка и проверки

```bash
npm run build
npm run typecheck
npm run lint
npm run format:check
npm test
```

`npm test` сначала собирает `dist/cli.js`, затем запускает unit- и интеграционные тесты; для PDF/CLI smoke-тестов Chrome должен быть установлен. В тестовом Linux-контейнере sandbox явно отключается переменной окружения только для тестовых процессов.
