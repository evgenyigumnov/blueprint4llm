# blueprint4llm

**भाषाएँ:** [English](README.md) | [Русский](README.ru.md) | [Español](README.es.md) | [中文](README.zh.md) | [हिन्दी](README.hi.md) | [Français](README.fr.md) | [العربية](README.ar.md)

**Markdown योजनाएँ → आरेख, UI प्रोटोटाइप, चार्ट, HTML और PDF।**

योजना स्वयं लिखें या किसी एजेंट की मदद लें। लागू करने से पहले सिस्टम और स्क्रीन की समीक्षा करें।
Markdown ही सत्य का मुख्य स्रोत रहता है; CLI LLM को कॉल किए बिना इसे रेंडर करता है।

![Markdown स्रोत के साथ रेंडर किया गया Mermaid आरेख, Balsamiq स्क्रीन और अनुरोध स्थिति चार्ट](https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/markdown-to-visual.png)

## उदाहरण

एक प्रतिनिधि [`plan.md`](examples/representative-plan.md) देखें और इसके रेंडर किए गए [HTML](https://evgenyigumnov.github.io/blueprint4llm/examples/representative-plan.html) तथा [PDF](https://evgenyigumnov.github.io/blueprint4llm/examples/representative-plan.pdf) आउटपुट की तुलना करें।

## जल्दी शुरू करें

### Codex या Claude Code के साथ उपयोग करें

अपने प्रोजेक्ट डायरेक्टरी में [skills CLI](https://github.com/vercel-labs/skills) से `blueprint4llm` skill इंस्टॉल करें:

```bash
# Codex
npx skills add evgenyigumnov/blueprint4llm --skill blueprint4llm --agent codex

# Claude Code
npx skills add evgenyigumnov/blueprint4llm --skill blueprint4llm --agent claude-code
```

इंस्टॉलर के लिए **Node.js ≥22.20.0** और npm चाहिए। डिफ़ॉल्ट रूप से skill मौजूदा प्रोजेक्ट में इंस्टॉल होती है; सभी प्रोजेक्ट में उपयोग करने के लिए `--global` जोड़ें। Codex प्रोजेक्ट skills को `.agents/skills/` में रखता है; Claude Code `.claude/skills/` का उपयोग करता है।

अपने एजेंट में skill चलाएँ:

```text
# Codex
$blueprint4llm किसी टास्क कतार के लिए विज़ुअल योजना बनाएँ।

# Claude Code
/blueprint4llm किसी टास्क कतार के लिए विज़ुअल योजना बनाएँ।
```

यह skill एजेंट को विज़ुअल योजना लिखने, उसे जाँचने और रेंडर करने, फिर हर दृश्य की समीक्षा करने में मदद करती है। रेंडरिंग के लिए `blueprint4llm` CLI और Puppeteer का Chrome चाहिए; अगला अनुभाग CLI इंस्टॉल और चलाने का तरीका बताता है।

### सीधे CLI का उपयोग करें

इसके लिए **Node.js ≥22.13.0**, npm और Puppeteer का Chrome चाहिए।

```bash
npm install --global blueprint4llm
```

इसे `plan.md` के रूप में सहेजें:

````markdown
# अनुरोध कार्यप्रवाह

```d2
form: अनुरोध फ़ॉर्म
api: API सत्यापन
queue: प्रोसेसिंग कतार

form -> api
api -> queue
```
````

```bash
blueprint4llm plan.md --serve
```

दिखाए गए URL को खोलें, सामान्यतः `http://127.0.0.1:8080/`। Markdown या संदर्भित स्थानीय छवि सहेजने पर प्रीव्यू रीफ़्रेश होता है। टूलबार में डार्क मोड और PDF डाउनलोड उपलब्ध हैं। `Ctrl+C` से रोकें।

Chrome आम तौर पर अपने आप इंस्टॉल हो जाता है। यदि इंस्टॉल स्क्रिप्ट ब्लॉक हुई हों, तो इसे हाथ से इंस्टॉल करें:

```bash
npm exec --yes --package=puppeteer@25.14.0 -- puppeteer browsers install chrome
```

## यह कैसे काम करता है

![Markdown योजना की जाँच करके लाइव प्रीव्यू, HTML या PDF दस्तावेज़, अथवा एकल SVG, PNG या JPEG दृश्य बनाया जाता है](https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/workflow.svg)

## फ़ॉर्मैट

CommonMark और GitHub Flavored Markdown के साथ fenced code blocks का उपयोग करें: पाठ, तालिकाएँ, सूचियाँ,
लिंक, चित्र और कोड। सामान्य code blocks में syntax highlighting होती है।

| फ़ॉर्मैट   | Fence                   | इनपुट और समर्थन                                                                                                                                            |
| ---------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D2         | `d2`                    | बंडल WebAssembly से स्वायत्त D2 सोर्स ऑफ़लाइन रेंडर होता है। कंटेनर, कनेक्शन, स्टाइल, SQL तालिकाएँ, UML क्लास और सीक्वेंस समर्थित हैं।                     |
| Mermaid    | `mermaid`               | फ़्लो, सीक्वेंस, क्लास, स्टेट और ER आरेख। जहाँ संभव हो, वर्टिकल लेआउट उपयोग होता है।                                                                       |
| Graphviz   | `graphviz`, `dot`       | एक स्वायत्त DOT ग्राफ़ worker में SVG के रूप में रेंडर होता है। सत्यापित `dot`, `neato`, `circo`, `fdp`, `osage`, `patchwork` और `twopi` इंजन समर्थित हैं। |
| PlantUML   | `plantuml`              | मानक `@start…` / `@end…` आरेख। स्थानीय इंजन; Java, बाहरी includes या नेटवर्क अनुरोध नहीं चाहिए।                                                            |
| draw.io    | `drawio`, `draw.io`     | नोड, समूह, लेबल और edges वाला संरचित JSON। स्वचालित लेआउट; XML नहीं।                                                                                       |
| Pencil     | `pencil`, `pen`         | एम्बेडेड `.pen` JSONC, schema 2.21। फ़्रेम, समूह, आकार, पथ और पाठ समर्थित; चित्र, घटक, ग्रेडिएंट और प्रभाव समर्थित नहीं।                                   |
| Balsamiq   | `balsamiq`              | सामान्य नियंत्रणों वाला एक Mockups 3 mockup। स्थिति और पाठ सुरक्षित रहते हैं; `.bmpr`, `.bmml`, एसेट और प्रतीक समर्थित नहीं।                               |
| Figma      | `figma`                 | REST API JSON स्थानीय रूप से रेंडर करें या Figma API से frame URL निर्यात करें। URL मोड में token चाहिए।                                                   |
| OpenAPI    | `openapi`               | OpenAPI 3.1.1 YAML या JSON स्थिर API संदर्भ में रेंडर होता है, जिसमें operations और component schemas शामिल हैं।                                           |
| Excalidraw | `excalidraw`            | सख्त `.excalidraw` JSON v2। स्थिति, घुमाव, समूह, आकार, पाठ और सामान्य तीर सुरक्षित रहते हैं; असमर्थित आइटम placeholder से दिखते हैं।                       |
| Vega-Lite  | `vega-lite`, `vegalite` | एम्बेडेड डेटा वाली Vega-Lite 6 specifications; स्थानीय रूप से स्थिर SVG में रेंडर होती हैं।                                                                |
| ECharts    | `echarts`               | समर्थित स्थिर चार्ट प्रोफ़ाइल का सख्त JSON; स्थानीय रूप से SVG में रेंडर होता है।                                                                          |

हर समर्थित फ़ॉर्मैट का दृश्य उदाहरण नीचे है। चित्रों के सभी लेबल अंग्रेज़ी में हैं।

| फ़ॉर्मैट                                     |                                                                                                               प्रीव्यू                                                                                                                | फ़ॉर्मैट                                       |                                                                                                              प्रीव्यू                                                                                                              |
| -------------------------------------------- | :-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | ---------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| [D2](examples/blueprint-d2.md)               |            <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/d2.svg" alt="खरीदार ऐप, API गेटवे, ऑर्डर, इन्वेंटरी, भुगतान, इवेंट और ईमेल सेवाओं के बीच D2 चेकआउट क्रम" width="440">             | [Mermaid](examples/blueprint-mermaid.md)       |          <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/mermaid.svg" alt="सत्यापन, नेस्टेड निष्पादन, बैकऑफ़ पुनः प्रयास और डेड-लेटर हैंडलिंग वाली आयात स्टेट मशीन" width="440">          |
| [Graphviz](examples/blueprint-graphviz.md)   |         <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/graphviz.svg" alt="स्कीमा गुणवत्ता जाँच, क्वारंटीन, रीप्ले, स्टोरेज और उपभोक्ताओं के साथ समूहित इवेंट वंशावली" width="440">          | [PlantUML](examples/blueprint-plantuml.md)     |       <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/plantuml.svg" alt="SLO पहचान, निर्णय मार्ग, समानांतर रिकवरी कार्य और अनुवर्ती कदमों वाला घटना-प्रतिक्रिया क्रम" width="440">        |
| [draw.io](examples/blueprint-draw.io.md)     |            <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/drawio.svg" alt="व्यापार, भुगतान, पूर्ति, ट्रैकिंग और ग्राहक सहायता वाला समूहित पार्सल जीवनचक्र मानचित्र" width="440">            | [Pencil](examples/blueprint-pencil.md)         |     <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/pencil.svg" alt="नेविगेशन, सेवा मेट्रिक्स, दो-श्रृंखला लेटेंसी चार्ट और स्वास्थ्य तालिका वाला विश्वसनीयता डैशबोर्ड" width="440">      |
| [Balsamiq](examples/blueprint-balsamiq.md)   | <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/balsamiq.svg" alt="खोजने योग्य प्राथमिकता कतार, SLA संदर्भ, चुना हुआ टिकट और असाइनमेंट तथा उत्तर नियंत्रण वाला सहायता डैशबोर्ड" width="440"> | [Figma](examples/blueprint-figma.md)           | <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/figma.svg" alt="क्योटो मोबाइल यात्रा योजना में गंतव्य कार्ड, ठहरने की जानकारी, अतिथि संख्या, मूल्य विवरण और बुकिंग कार्रवाई" width="440"> |
| [OpenAPI](examples/blueprint-openapi.md)     |          <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/openapi.svg" alt="पार्सल संचालन API संदर्भ में शिपमेंट, ट्रैकिंग, पेजिनेशन और दोबारा उपयोग होने वाले स्कीमा" width="440">           | [Excalidraw](examples/blueprint-excalidraw.md) |                   <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/excalidraw.svg" alt="तीन चरणों का लॉन्च रोडमैप: खोज, निजी बीटा, रोलआउट और साक्ष्य जाँच" width="440">                    |
| [Vega-Lite](examples/blueprint-vega-lite.md) |             <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/vega-lite.svg" alt="दो क्षेत्रों के मासिक p95 लेटेंसी रुझान, देखी गई सीमाएँ और 200 मिलीसेकंड SLO रेखा" width="440">              | [ECharts](examples/blueprint-echarts.md)       |                <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/echarts.svg" alt="छह ट्रैफ़िक समय-खंडों में सात दिनों की API p95 लेटेंसी की तुलना करता हीटमैप" width="440">                |

### Figma फ़्रेम

JSON मोड में root `DOCUMENT` चाहिए और यह token के बिना ऑफ़लाइन काम करता है। फ़ेंस मेटाडेटा में `node=12:34` देकर फ़्रेम चुनें। स्थानीय renderer कंटेनर, बुनियादी आकार, vector paths, पाठ और ठोस रंग भराव समर्थित करता है; ग्रेडिएंट, प्रभाव, masks और चित्रों के लिए URL मोड चुनें।

URL मोड HTTPS `/design/` या `/file/` फ़्रेम URL स्वीकार करता है। `file_content:read` अनुमति वाला personal access token उपयोग करें। Token इस क्रम में खोजा जाता है: `CompileOptions.figmaAccessToken`, `FIGMA_ACCESS_TOKEN`, फिर मौजूदा working directory की `.env` फ़ाइल। Token केवल `api.figma.com` को भेजा जाता है; निर्यात किए गए SVG परिणाम में एम्बेड होते हैं।

## कमांड

| कार्य                  | कमांड                                                                  |
| ---------------------- | ---------------------------------------------------------------------- |
| लाइव प्रीव्यू          | `blueprint4llm plan.md --serve --port=8080`                            |
| CI के लिए सत्यापन      | `blueprint4llm plan.md --check`                                        |
| रिपोर्ट के साथ सत्यापन | `blueprint4llm plan.md --check --report-json=diagnostics.json`         |
| रिपोर्ट सहित निर्यात   | `blueprint4llm plan.md --out=plan.html --report-json=diagnostics.json` |
| HTML निर्यात           | `blueprint4llm plan.md --out=plan.html`                                |
| गणना सहित निर्यात      | `blueprint4llm plan.md --out=plan.html --diagnostics-summary`          |
| PDF निर्यात            | `blueprint4llm plan.md --out=plan.pdf --format=pdf`                    |
| SVG निर्यात            | `blueprint4llm plan.md --out=visual.svg --format=svg`                  |
| PNG निर्यात            | `blueprint4llm plan.md --out=visual.png --format=png`                  |
| JPEG निर्यात           | `blueprint4llm plan.md --out=visual.jpeg --format=jpeg`                |

चित्र निर्यात के लिए **ठीक एक समर्थित दृश्य ब्लॉक** चाहिए; शुरुआती उदाहरण इस शर्त को पूरा करता है। `--out` parent directories बनाता है। हर invocation एक फ़ॉर्मैट बनाता है; डिफ़ॉल्ट HTML है। `--check` HTML या assets लिखे बिना Markdown, आरेख और स्थानीय चित्रों की जाँच करता है। वैकल्पिक `--report-json=<file>` UTF-8 JSON रिपोर्ट को atomic तरीके से लिखता है। यह `--check` और एकल निर्यात के साथ काम करता है। रिपोर्ट का पथ input और output पथों से अलग होना चाहिए, symlink aliases सहित। `--report-json` को `--serve` के साथ उपयोग नहीं किया जा सकता।

डिफ़ॉल्ट रूप से बने दस्तावेज़ कुल errors और warnings नहीं दिखाते। इसे शामिल करने के लिए HTML या PDF निर्यात और लाइव प्रीव्यू में `--diagnostics-summary` जोड़ें। विफल आरेख अपनी जगह पूरा संदेश दिखाता है; अन्य Markdown और सही आरेख उपलब्ध रहते हैं। आरेख में त्रुटि होने पर भी HTML और PDF सहेजे जाते हैं, फिर कमांड code `1` से समाप्त होता है। त्रुटि वाले आरेख के लिए SVG, PNG और JPEG निर्यात मौजूदा फ़ाइल को नहीं बदलता। केवल warnings हों तो exit code `0` है। अमान्य arguments, रिपोर्ट-पथ टकराव समेत, code `2` देते हैं।

रिपोर्ट में `schemaVersion: 1`, `ok` या `error` वाला `status`, सारांश गणनाएँ और क्रमबद्ध diagnostics होते हैं। हर diagnostic में `severity`, स्थिर `code`, `scope`, source path, वैकल्पिक Markdown coordinates और आरेख पहचान, तथा पूरा संदेश होता है। Codes हैं `diagram.render`, `diagram.limit`, `diagram.svg`, `renderer.warning`, `document.read`, `document.compile`, `output.render` और `output.write`। वैकल्पिक `outputs` object उन फ़ाइलों को सूचीबद्ध करता है जिन्हें invocation ने वास्तव में सहेजा। उदाहरण के लिए, `--check` रिपोर्ट में `outputs` फ़ील्ड नहीं होता।

दस्तावेज़ या निर्यात की fatal त्रुटियाँ उस कार्रवाई को रोक देती हैं। JSON रिपोर्ट माँगी गई हो और फिर भी लिखी जा सकती हो, तो उसमें document या output diagnostic होगा। रिपोर्ट न लिख पाने पर stderr पर संदेश आता है और exit code `1` होता है; पहले से सहेजी HTML या PDF उपलब्ध रहती है। [`examples/blueprint-diagnostics.md`](examples/blueprint-diagnostics.md) में दो स्वतंत्र आरेख त्रुटियों के बीच एक सही आरेख दिखाया गया है।

लाइव प्रीव्यू में विफल आरेख वहीं दिखते रहते हैं और PDF उसी compiled document का उपयोग करता है। कुल संख्या केवल `--diagnostics-summary` से दिखती है। स्रोत सुधारने के बाद अगला build diagnostics हटा देता है। स्रोत ठीक होने तक fatal document error diagnostic page दिखाता है।

## आउटपुट और सीमाएँ

| विषय             | व्यवहार                                                                                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTML             | आरेख SVG एम्बेड करता है; स्थानीय चित्र पास के `assets/` फ़ोल्डर में कॉपी होते हैं। आउटपुट ब्राउज़र में सीधे खोलें।                                                                |
| PDF              | स्थानीय Noto Sans फ़ॉन्ट और चुने जा सकने वाले पाठ के साथ A4 पेज। चौड़े D2 आरेख landscape पेज उपयोग करते हैं। बाहरी चित्र निर्यात से पहले स्थानीय रूप में सहेजें।                  |
| चित्र पथ         | Relative paths Markdown फ़ाइल से resolve होते हैं। उसके फ़ोल्डर से बाहर जाने वाले path और symlink अस्वीकार होते हैं।                                                              |
| ऑफ़लाइन उपयोग    | स्थानीय renderers को नेटवर्क नहीं चाहिए; Figma URL blocks compilation के दौरान डेटा लेते हैं। HTML में बाहरी चित्रों के लिए कनेक्शन चाहिए।                                        |
| सुरक्षा          | Raw HTML escape होता है। SVG को सक्रिय सामग्री और बाहरी resources के लिए जाँचा जाता है। User scripts और graphical editing समर्थित नहीं हैं।                                       |
| दस्तावेज़ सीमाएँ | 5 MiB Markdown, 100 दृश्य ब्लॉक और सामान्यतः प्रति ब्लॉक 256 KiB।                                                                                                                 |
| JSON सीमाएँ      | draw.io, Pencil और Figma: 1 MiB तथा 10,000 cells/nodes। Balsamiq: 256 KiB तथा 3,000 controls।                                                                                     |
| Vega-Lite सीमाएँ | 256 KiB स्रोत, 64 स्तर, 50,000 AST nodes, 10,000 source rows, 100 expanded views और transforms, 50,000 computed rows/items, और 4 MiB SVG।                                         |
| OpenAPI सीमाएँ   | 256 KiB स्रोत, 200 operations, 500 नामित schemas, 2,000 references, 5,000 layout lines और 4 MiB SVG।                                                                              |
| समय-सीमा         | Mermaid, PlantUML और Vega-Lite: 30 सेकंड। draw.io layout: 5 सेकंड। PDF: 60 सेकंड।                                                                                                 |
| Linux में Chrome | Chrome system libraries चाहिए। Sandbox startup विफल हो तो `--no-sandbox` से दोबारा प्रयास होता है। यह मोड अनिवार्य करने के लिए `BLUEPRINT4LLM_DISABLE_CHROME_SANDBOX=1` सेट करें। |

## एजेंट और एडिटर कार्यप्रवाह

| कार्यप्रवाह  | सेटअप                                                                                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Coding agent | `blueprint4llm` skill उपयोग करें; Codex और Claude Code को इंस्टॉल और चलाने के लिए [जल्दी शुरू करें](#जल्दी-शुरू-करें) देखें।                                                                                 |
| VS Code      | बने हुए VSIX को `code --install-extension <file.vsix>` से इंस्टॉल करें। Markdown फ़ाइल खोलें और **Blueprint: Open Preview to the Side** चलाएँ। PDF सहेजने के लिए **Blueprint: Export Preview as PDF** चुनें। |

VS Code प्रीव्यू 200 ms की देरी के बाद बिना सहेजे बदलाव compile करता है; इसे `blueprint4llm.preview.debounceMs` से कॉन्फ़िगर करें। Desktop VS Code ≥1.101.0 और Puppeteer का Chrome चाहिए।

## प्रोग्रामेटिक API

`npm install blueprint4llm` से स्थानीय रूप में इंस्टॉल करें, फिर ESM exports उपयोग करें:

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

| Export                                        | उद्देश्य                                                                                                   |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `compileMarkdown(markdown, options)`          | `html`, `title`, `assets`, पुराने `warnings`/`errors` string arrays और structured `diagnostics` लौटाता है। |
| `renderPdf(compiled, { signal }?)`            | PDF bytes बनाता है; उन्हें `pdf` के रूप में `writeBlueprintOutput()` में दें।                              |
| `writeBlueprintOutput(path, options)`         | assets सहित HTML और/या PDF लिखता है और absolute output paths लौटाता है।                                    |
| `startPreviewServer({ input, port, signal })` | `url`, `port` और asynchronous `close()` method लौटाता है।                                                  |

मौजूदा consumers के लिए `warnings` और `errors` formatted string arrays बने रहते हैं। `diagnostics` structured records जोड़ता है; public result types में यह optional है ताकि पुराने compiler implementations केवल string arrays दे सकें। Built-in compiler हमेशा `diagnostics` लौटाता है। बने HTML में सुलभ गणना जोड़ने के लिए `CompileOptions` में `includeDiagnosticsSummary: true` सेट करें; यह डिफ़ॉल्ट रूप से बंद है। `startPreviewServer()` भी यही option लेता है।

## विकास

Repository clone से:

```bash
npm ci
npx puppeteer browsers install chrome
npm run build
npm run typecheck
npm run lint
npm run format:check
npm test
```

CLI को सीधे `node dist/cli.js` से चलाएँ या कमांड को globally उपलब्ध कराने के लिए `npm link` उपयोग करें। VSIX बनाने के लिए `vscode-extension/` से `npm install` और `npm run package` चलाएँ।
