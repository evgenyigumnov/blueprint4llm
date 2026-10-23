# blueprint4llm

**اللغات:** [English](README.md) | [Русский](README.ru.md) | [Español](README.es.md) | [中文](README.zh.md) | [हिन्दी](README.hi.md) | [Français](README.fr.md) | [العربية](README.ar.md)

**خطط Markdown → مخططات، ونماذج أولية للواجهات، ورسوم بيانية، وHTML وPDF.**

اكتب الخطة بنفسك أو بمساعدة وكيل. راجع النظام والشاشات قبل التنفيذ.
يبقى Markdown مصدر الحقيقة؛ وتحوله أداة CLI من دون استدعاء LLM.

![ملف Markdown بجوار مخطط Mermaid المعروض وشاشة Balsamiq ورسم بياني لحالة الطلبات](https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/markdown-to-visual.png)

## مثال

استكشف [`plan.md`](examples/representative-plan.md) وقارن مخرجاته المعروضة بصيغتي [HTML](https://evgenyigumnov.github.io/blueprint4llm/examples/representative-plan.html) و[PDF](https://evgenyigumnov.github.io/blueprint4llm/examples/representative-plan.pdf).

## البدء السريع

### الاستخدام مع Codex أو Claude Code

من مجلد مشروعك، ثبّت مهارة `blueprint4llm` باستخدام [أداة skills CLI](https://github.com/vercel-labs/skills):

```bash
# Codex
npx skills add evgenyigumnov/blueprint4llm --skill blueprint4llm --agent codex

# Claude Code
npx skills add evgenyigumnov/blueprint4llm --skill blueprint4llm --agent claude-code
```

يتطلب المثبّت **Node.js ≥22.20.0** وnpm. يثبّت المهارة للمشروع الحالي افتراضيًا؛ أضف `--global` لاستخدامها في جميع المشاريع. يخزّن Codex مهارات المشروع في `.agents/skills/`، بينما يستخدم Claude Code المسار `.claude/skills/`.

استدعِ المهارة في وكيلك:

```text
# Codex
$blueprint4llm أنشئ خطة مرئية لقائمة انتظار المهام.

# Claude Code
/blueprint4llm أنشئ خطة مرئية لقائمة انتظار المهام.
```

ترشد المهارة الوكيل إلى كتابة خطة مرئية والتحقق منها وعرضها، ثم مراجعة كل عنصر مرئي. يتطلب العرض أداة `blueprint4llm` وChrome الخاص بـPuppeteer؛ يشرح القسم التالي كيفية تثبيت CLI وتشغيلها.

### استخدام CLI مباشرةً

يتطلب **Node.js ≥22.13.0** وnpm وChrome الخاص بـPuppeteer.

```bash
npm install --global blueprint4llm
```

احفظ هذا المحتوى في `plan.md`:

````markdown
# سير معالجة الطلبات

```d2
form: نموذج الطلب
api: التحقق من API
queue: قائمة المعالجة

form -> api
api -> queue
```
````

```bash
blueprint4llm plan.md --serve
```

افتح عنوان URL المطبوع، وغالبًا ما يكون `http://127.0.0.1:8080/`. يتجدد العرض عند حفظ ملف Markdown أو صورة محلية مشار إليها. يوفّر شريط الأدوات الوضع الداكن وتنزيل PDF. أوقف الخادم باستخدام `Ctrl+C`.

يُثبّت Chrome تلقائيًا عادةً. إذا حُظرت برامج التثبيت النصية، ثبّته يدويًا:

```bash
npm exec --yes --package=puppeteer@25.14.0 -- puppeteer browsers install chrome
```

## آلية العمل

![يُتحقق من خطة Markdown ثم تُعرض كمعاينات مباشرة أو مستندات HTML وPDF أو رسم مستقل بصيغة SVG أو PNG أو JPEG](https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/workflow.svg)

## التنسيقات

استخدم كتل التعليمات البرمجية المسيّجة مع CommonMark وGitHub Flavored Markdown: النص والجداول والقوائم
والروابط والصور والتعليمات البرمجية. تُطبّق تلوينات الصياغة على كتل التعليمات البرمجية العادية.

| التنسيق    | سياج الكتلة             | المدخلات والدعم                                                                                                                                     |
| ---------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| D2         | `d2`                    | يُعرض مصدر D2 المستقل دون اتصال باستخدام WebAssembly المضمّن. يدعم الحاويات والروابط والأنماط وجداول SQL وفئات UML والتتابعات.                      |
| Mermaid    | `mermaid`               | مخططات التدفق والتتابع والفئات والحالات وER. يستخدم تخطيطًا رأسيًا حيثما أمكن.                                                                      |
| Graphviz   | `graphviz`, `dot`       | يُعرض رسم DOT مستقل واحد بصيغة SVG داخل عامل. يدعم المحركات المتحقق منها `dot` و`neato` و`circo` و`fdp` و`osage` و`patchwork` و`twopi`.             |
| PlantUML   | `plantuml`              | مخططات `@start…` / `@end…` القياسية. محرك محلي، ولا يحتاج إلى Java أو تضمينات خارجية أو طلبات شبكة.                                                 |
| draw.io    | `drawio`, `draw.io`     | JSON منظّم يتضمن العُقد والمجموعات والتسميات والحواف. تخطيط تلقائي من دون XML.                                                                      |
| Pencil     | `pencil`, `pen`         | JSONC مضمّن بامتداد `.pen` ومخطط 2.21. يدعم الإطارات والمجموعات والأشكال والمسارات والنص؛ ولا يدعم الصور أو المكونات أو التدرجات أو المؤثرات.       |
| Balsamiq   | `balsamiq`              | نموذج Mockups 3 واحد بعناصر تحكم شائعة. يحافظ على المواضع والنص؛ ولا يدعم `.bmpr` أو `.bmml` أو الأصول أو الرموز.                                   |
| Figma      | `figma`                 | يُعرض JSON الخاص بـREST API محليًا أو يُصدّر إطار من URL عبر Figma API. يتطلب وضع URL رمزًا مميزًا.                                                 |
| OpenAPI    | `openapi`               | يُعرض YAML أو JSON وفق OpenAPI 3.1.1 كمرجع API ثابت يتضمن العمليات ومخططات المكونات.                                                                |
| Excalidraw | `excalidraw`            | JSON صارم بصيغة `.excalidraw` v2. يحافظ على المواضع والدوران والمجموعات والأشكال والنص والأسهم العادية؛ وتُستبدل العناصر غير المدعومة بعناصر نائبة. |
| Vega-Lite  | `vega-lite`, `vegalite` | مواصفات Vega-Lite 6 ببيانات مضمنة؛ تُعرض محليًا كـSVG ثابت.                                                                                         |
| ECharts    | `echarts`               | JSON صارم وفق ملف الرسوم الثابتة المدعوم؛ يُعرض محليًا بصيغة SVG.                                                                                   |

فيما يلي مثال مرئي لكل تنسيق مدعوم. جميع التسميات في الصور باللغة الإنجليزية.

| التنسيق                                      |                                                                                                               المعاينة                                                                                                               | التنسيق                                        |                                                                                                           المعاينة                                                                                                            |
| -------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | ---------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| [D2](examples/blueprint-d2.md)               | <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/d2.svg" alt="تسلسل إتمام الشراء في D2 بين تطبيق المشتري وبوابة API وخدمات الطلبات والمخزون والدفع والأحداث والبريد الإلكتروني" width="440"> | [Mermaid](examples/blueprint-mermaid.md)       | <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/mermaid.svg" alt="آلة حالات الاستيراد مع التحقق والتنفيذ المتداخل وإعادة المحاولة بتأخير تصاعدي ومعالجة الرسائل الميتة" width="440"> |
| [Graphviz](examples/blueprint-graphviz.md)   |             <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/graphviz.svg" alt="سلسلة أحداث مجمعة مع بوابة جودة المخطط والعزل وإعادة التشغيل والتخزين والمستهلكين" width="440">              | [PlantUML](examples/blueprint-plantuml.md)     |          <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/plantuml.svg" alt="الاستجابة للحوادث مع كشف SLO ومسارات القرار وأعمال الاسترداد المتوازية والمتابعة" width="440">           |
| [draw.io](examples/blueprint-draw.io.md)     |              <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/drawio.svg" alt="خريطة مجمعة لدورة حياة الطرد تشمل التجارة والمدفوعات والتنفيذ والتتبع ودعم العملاء" width="440">              | [Pencil](examples/blueprint-pencil.md)         |           <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/pencil.svg" alt="لوحة موثوقية تتضمن التنقل ومقاييس الخدمات ومخطط زمن استجابة بسلسلتين وجدول الحالة" width="440">           |
| [Balsamiq](examples/blueprint-balsamiq.md)   |          <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/balsamiq.svg" alt="لوحة فرز الدعم مع قائمة أولويات قابلة للبحث وسياق SLA وتذكرة محددة وأدوات الإسناد والرد" width="440">           | [Figma](examples/blueprint-figma.md)           |     <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/figma.svg" alt="مسار رحلة متنقل في كيوتو مع بطاقة الوجهة وتفاصيل الإقامة وعدد الضيوف وتفصيل السعر وإجراء الحجز" width="440">     |
| [OpenAPI](examples/blueprint-openapi.md)     |          <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/openapi.svg" alt="مرجع API لعمليات الطرود والشحن والتتبع والترقيم الصفحي والمخططات القابلة لإعادة الاستخدام" width="440">          | [Excalidraw](examples/blueprint-excalidraw.md) |   <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/excalidraw.svg" alt="خارطة إطلاق بثلاث مراحل: الاستكشاف والنسخة التجريبية الخاصة والتوسّع وبوابة التحقق من الأدلة" width="440">    |
| [Vega-Lite](examples/blueprint-vega-lite.md) |        <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/vega-lite.svg" alt="اتجاهات شهرية لزمن الاستجابة p95 في منطقتين مع النطاقات المرصودة وخط SLO عند 200 مللي ثانية" width="440">        | [ECharts](examples/blueprint-echarts.md)       |           <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/echarts.svg" alt="خريطة حرارية تقارن زمن استجابة API p95 على مدى سبعة أيام ضمن ست فترات حركة مرور" width="440">            |

### إطارات Figma

يتطلب وضع JSON عنصر `DOCUMENT` جذريًا ويعمل دون اتصال أو رمز مميز. حدّد إطارًا باستخدام `node=12:34` في بيانات سياج الكتلة. يدعم العارض المحلي الحاويات والأشكال الأساسية والمسارات المتجهة والنص والتعبئة بلون موحد؛ استخدم وضع URL للتدرجات والمؤثرات والأقنعة والصور.

يقبل وضع URL روابط HTTPS لإطارات `/design/` أو `/file/`. استخدم رمز وصول شخصيًا بصلاحية `file_content:read`. يُبحث عن الرمز بهذا الترتيب: `CompileOptions.figmaAccessToken` ثم `FIGMA_ACCESS_TOKEN` ثم `.env` في مجلد العمل الحالي. يُرسل الرمز إلى `api.figma.com` فقط؛ وتُضمّن ملفات SVG المصدّرة في النتيجة.

## الأوامر

| المهمة            | الأمر                                                                  |
| ----------------- | ---------------------------------------------------------------------- |
| معاينة مباشرة     | `blueprint4llm plan.md --serve --port=8080`                            |
| التحقق لـCI       | `blueprint4llm plan.md --check`                                        |
| التحقق مع تقرير   | `blueprint4llm plan.md --check --report-json=diagnostics.json`         |
| التصدير مع تقرير  | `blueprint4llm plan.md --out=plan.html --report-json=diagnostics.json` |
| تصدير HTML        | `blueprint4llm plan.md --out=plan.html`                                |
| التصدير مع الملخص | `blueprint4llm plan.md --out=plan.html --diagnostics-summary`          |
| تصدير PDF         | `blueprint4llm plan.md --out=plan.pdf --format=pdf`                    |
| تصدير SVG         | `blueprint4llm plan.md --out=visual.svg --format=svg`                  |
| تصدير PNG         | `blueprint4llm plan.md --out=visual.png --format=png`                  |
| تصدير JPEG        | `blueprint4llm plan.md --out=visual.jpeg --format=jpeg`                |

يتطلب تصدير الصور **كتلة مرئية مدعومة واحدة بالضبط**؛ ومثال البدء السريع يفي بهذا الشرط. ينشئ `--out` المجلدات الأصلية. ينتج كل تشغيل تنسيقًا واحدًا؛ وHTML هو الافتراضي. يتحقق `--check` من Markdown والمخططات والصور المحلية من دون كتابة HTML أو أصول. يكتب الخيار الاختياري `--report-json=<file>` تقرير JSON بترميز UTF-8 بطريقة ذرية. يعمل مع `--check` والتصدير لمرة واحدة. يجب أن يختلف مسار التقرير عن مساري الإدخال والإخراج، بما في ذلك أسماء الروابط الرمزية البديلة. لا يمكن استخدام `--report-json` مع `--serve`.

لا تعرض المستندات المنشأة إجمالي الأخطاء والتحذيرات افتراضيًا. أضف `--diagnostics-summary` إلى تصدير HTML أو PDF والمعاينات المباشرة لإظهار الإجمالي. يعرض المخطط الفاشل رسالته كاملة في موضعه؛ وتبقى بقية Markdown والمخططات السليمة متاحة. تُحفظ مخرجات HTML وPDF حتى عند وجود خطأ في مخطط، ثم ينتهي الأمر برمز `1`. لا يستبدل تصدير SVG أو PNG أو JPEG ملفًا موجودًا عند وجود خطأ في المخطط. تنتهي التحذيرات وحدها برمز `0`. تؤدي الوسيطات غير الصالحة، بما فيها تعارض مسار التقرير، إلى رمز `2`.

يتضمن التقرير `schemaVersion: 1` و`status` بقيمة `ok` أو `error` وأعدادًا موجزة وتشخيصات مرتبة. يتضمن كل تشخيص `severity` و`code` ثابتًا و`scope` ومسار المصدر وإحداثيات Markdown وهوية المخطط عند توفرها، إضافة إلى الرسالة كاملة. الرموز هي `diagram.render` و`diagram.limit` و`diagram.svg` و`renderer.warning` و`document.read` و`document.compile` و`output.render` و`output.write`. يسرد كائن `outputs` الاختياري الملفات التي حفظها التشغيل فعليًا. مثلًا، لا تتضمن تقارير `--check` الحقل `outputs`.

توقف أخطاء المستند أو التصدير الفادحة العملية المعنية. إذا طُلب تقرير JSON وما زال بالإمكان كتابته، فسيتضمن تشخيصًا للمستند أو المخرجات. عند تعذر كتابة التقرير، يُعرض الخطأ على stderr وينتهي الأمر برمز `1`؛ وتظل ملفات HTML أو PDF المحفوظة سابقًا متاحة. راجع [`examples/blueprint-diagnostics.md`](examples/blueprint-diagnostics.md) للاطلاع على مستند فيه خطآن مستقلان للمخططات بينهما مخطط سليم.

في المعاينة المباشرة، تبقى المخططات الفاشلة ضمن المستند ويستخدم PDF المستند المترجم نفسه. لا يظهر الإجمالي إلا مع `--diagnostics-summary`. يؤدي إصلاح المصدر إلى إزالة التشخيصات عند البناء التالي. ويظل خطأ المستند الفادح يعرض صفحة تشخيص حتى إصلاح المصدر.

## المخرجات والحدود

| الموضوع          | السلوك                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HTML             | يضمّن ملفات SVG للمخططات؛ وتُنسخ الصور المحلية إلى مجلد `assets/` مجاور. افتح المخرجات مباشرةً في متصفح.                                                                 |
| PDF              | صفحات A4 بخطوط Noto Sans المحلية ونص قابل للتحديد. تستخدم مخططات D2 العريضة صفحات أفقية. احفظ الصور الخارجية محليًا قبل التصدير.                                         |
| مسارات الصور     | تُحل المسارات النسبية انطلاقًا من ملف Markdown. تُرفض المسارات والروابط الرمزية التي تتجاوز مجلده.                                                                       |
| العمل دون اتصال  | لا تحتاج العوارض المحلية إلى الشبكة؛ وتجلب كتل Figma URL البيانات أثناء التجميع. يحتاج HTML إلى اتصال لعرض الصور الخارجية.                                               |
| الأمان           | يُهرّب HTML الخام. تُفحص ملفات SVG بحثًا عن محتوى نشط وموارد خارجية. لا تُدعم البرامج النصية للمستخدم والتحرير الرسومي.                                                  |
| حدود المستند     | 5 MiB من Markdown، و100 كتلة مرئية، و256 KiB عادةً لكل كتلة.                                                                                                             |
| حدود JSON        | draw.io وPencil وFigma: ‏1 MiB و10,000 خلية/عقدة. Balsamiq: ‏256 KiB و3,000 عنصر تحكم.                                                                                   |
| حدود Vega-Lite   | مصدر 256 KiB، و64 مستوى، و50,000 عقدة AST، و10,000 صف مصدر، و100 عرض وتحويل موسع، و50,000 صف/عنصر محسوب، وSVG بحجم 4 MiB.                                                |
| حدود OpenAPI     | مصدر 256 KiB، و200 عملية، و500 مخطط مسمى، و2,000 مرجع، و5,000 سطر تخطيط، وSVG بحجم 4 MiB.                                                                                |
| المهلات          | Mermaid وPlantUML وVega-Lite: 30 ثانية. تخطيط draw.io: ‏5 ثوانٍ. PDF: ‏60 ثانية.                                                                                         |
| Chrome على Linux | يتطلب مكتبات النظام الخاصة بـChrome. إذا فشل التشغيل داخل sandbox، تُعاد المحاولة باستخدام `--no-sandbox`. اضبط `BLUEPRINT4LLM_DISABLE_CHROME_SANDBOX=1` لفرض هذا الوضع. |

## سير عمل الوكلاء والمحررات

| سير العمل                                                                            | الإعداد                                                                                                                                                                               |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| وكيل البرمجة                                                                         | استخدم مهارة `blueprint4llm`؛ راجع [البدء السريع](#البدء-السريع) لتثبيتها واستدعائها في Codex وClaude Code.                                                                           |
| [VS Code](https://github.com/evgenyigumnov/blueprint4llm/tree/main/vscode-extension) | ثبّت VSIX مبنيًا باستخدام `code --install-extension <file.vsix>`. افتح ملف Markdown وشغّل **Blueprint: Open Preview to the Side**. استخدم **Blueprint: Export Preview as PDF** لحفظه. |

تجمع معاينة VS Code التغييرات غير المحفوظة بعد تأخير 200 ms، ويمكن ضبط التأخير عبر `blueprint4llm.preview.debounceMs`. تتطلب VS Code لسطح المكتب ≥1.101.0 وChrome الخاص بـPuppeteer.

## API البرمجية

ثبّت الحزمة محليًا باستخدام `npm install blueprint4llm` ثم استخدم صادرات ESM:

```js
import { compileMarkdown, writeBlueprintOutput } from 'blueprint4llm';

const compiled = await compileMarkdown('# Plan\n\nReady for review.', {
  sourceFile: './plan.md',
  includeDiagnosticsSummary: true,
});

await writeBlueprintOutput('./plan.html', {
  html: compiled.html,
  assets: compiled.assets,
});
```

| التصدير                                       | الغرض                                                                                                |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `compileMarkdown(markdown, options)`          | يعيد `html` و`title` و`assets` ومصفوفتي السلاسل القديمة `warnings`/`errors` و`diagnostics` المنظّمة. |
| `renderPdf(compiled, { signal }?)`            | ينشئ بايتات PDF؛ مرّرها كقيمة `pdf` إلى `writeBlueprintOutput()`.                                    |
| `writeBlueprintOutput(path, options)`         | يكتب HTML و/أو PDF مع الأصول، ويعيد مسارات الإخراج المطلقة.                                          |
| `startPreviewServer({ input, port, signal })` | يعيد `url` و`port` ودالة `close()` غير متزامنة.                                                      |

تظل `warnings` و`errors` مصفوفتَي سلاسل منسّقة للمستهلكين الحاليين. تضيف `diagnostics` سجلات منظّمة؛ وهي اختيارية في الأنواع العامة كي تتمكن إصدارات المترجم القديمة من إعادة مصفوفات السلاسل فقط. يعيد المترجم المضمّن `diagnostics` دائمًا. اضبط `includeDiagnosticsSummary: true` في `CompileOptions` لإضافة عدد يسهل الوصول إليه إلى HTML الناتج؛ وهو معطل افتراضيًا. يقبل `startPreviewServer()` الخيار نفسه.

## التطوير

من نسخة مستنسخة من المستودع:

```bash
npm ci
npx puppeteer browsers install chrome
npm run build
npm run typecheck
npm run lint
npm run format:check
npm test
```

شغّل CLI مباشرةً باستخدام `node dist/cli.js` أو استخدم `npm link` لإتاحة الأمر عالميًا. لإنشاء VSIX، نفّذ `npm install` و`npm run package` من مجلد `vscode-extension/`.
