# blueprint4llm

`blueprint4llm` помогает наглядно читать и проверять планы разработки, написанные человеком или ИИ-агентом. Он превращает обычный Markdown в HTML или PDF, заранее отрисовывая диаграммы Mermaid и PlantUML, а также макеты интерфейсов Wiremark: так проще увидеть, как устроена система и как будут выглядеть её экраны. Для работы над черновиком есть локальный предпросмотр с автообновлением и загрузкой актуального PDF. Markdown остаётся исходником, сам инструмент не вызывает LLM.

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

`--out` указывает полный путь выходного файла; родительские каталоги создаются автоматически. CLI создаёт один формат за запуск. SVG Mermaid, PlantUML и Wiremark встраиваются в HTML, отдельные SVG-файлы не создаются. Локальные изображения сохраняются в `assets/` рядом с HTML. Созданный HTML можно открыть напрямую через `file://`.

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

Для Mermaid renderer задаёт вертикальное направление (`TB`/`TD`) для типов диаграмм, которые поддерживают настройку направления. У типов с фиксированной компоновкой, например `sequenceDiagram`, сохраняется их естественная раскладка.

PlantUML-блок содержит одну диаграмму с обычными директивами `@start...` и `@end...`. Движок `@plantuml/core@1.2026.9` работает локально в Chromium, который уже используется для PDF и предпросмотра; отдельная установка Java не требуется. Рендеринг не отправляет исходник на сервер и работает без сети. Внешние запросы, локальные `!include`, `!includeurl` и стандартные библиотеки отключены. Размер SVG ограничен 8192 px по стороне, одновременно выполняются не более двух PlantUML-рендеров.

Другие блоки кода остаются обычным подсвечиваемым HTML-кодом. Произвольный HTML в Markdown экранируется. SVG всех диаграмм проходят общую проверку на активные элементы, обработчики событий и внешние ресурсы; небезопасные URL в ссылках удаляются.

Локальные изображения разрешаются относительно каталога Markdown и копируются в `assets/` рядом с выходным HTML-файлом. Сборка запрещает выход из каталога проекта через `..` или symlink. Внешние HTTP(S)-картинки остаются внешними в HTML. Для PDF они не разрешены: сохраните такую картинку локально и используйте относительный путь. PDF собирается в A4 с локальным Noto Sans; текст и ссылки остаются доступными в PDF.

## Ограничения

- Размер исходного Markdown — до 5 MiB, до 100 диаграмм и до 256 KiB исходника на одну диаграмму.
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
