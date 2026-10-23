# blueprint4llm

**语言：** [English](README.md) | [Русский](README.ru.md) | [Español](README.es.md) | [中文](README.zh.md) | [हिन्दी](README.hi.md) | [Français](README.fr.md) | [العربية](README.ar.md)

**Markdown 计划 → 图表、界面原型、数据图、HTML 和 PDF。**

你可以独立编写计划，也可以借助智能代理。实施前先检查系统和界面。
Markdown 始终是唯一可信来源；CLI 无需调用 LLM 即可进行渲染。

![Markdown 源文件及其渲染出的 Mermaid 图表、Balsamiq 界面和请求状态图](https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/markdown-to-visual.png)

## 示例

查看 [`plan.md`](examples/representative-plan.md)，并对比其 [HTML](https://evgenyigumnov.github.io/blueprint4llm/examples/representative-plan.html) 和 [PDF](https://evgenyigumnov.github.io/blueprint4llm/examples/representative-plan.pdf) 渲染结果。

## 快速开始

### 与 Codex 或 Claude Code 搭配使用

在项目目录中使用 [skills CLI](https://github.com/vercel-labs/skills) 安装 `blueprint4llm` skill：

```bash
# Codex
npx skills add evgenyigumnov/blueprint4llm --skill blueprint4llm --agent codex

# Claude Code
npx skills add evgenyigumnov/blueprint4llm --skill blueprint4llm --agent claude-code
```

安装程序需要 **Node.js ≥22.20.0** 和 npm。默认只为当前项目安装；添加 `--global` 可在所有项目中使用。Codex 将项目 skill 存放在 `.agents/skills/`，Claude Code 使用 `.claude/skills/`。

在智能代理中调用该 skill：

```text
# Codex
$blueprint4llm 为任务队列创建可视化计划。

# Claude Code
/blueprint4llm 为任务队列创建可视化计划。
```

该 skill 会引导代理编写可视化计划、验证并渲染计划，然后检查每个视觉内容。渲染需要 `blueprint4llm` CLI 和 Puppeteer 的 Chrome；下一节介绍如何安装和运行 CLI。

### 直接使用 CLI

需要 **Node.js ≥22.13.0**、npm 和 Puppeteer 的 Chrome。

```bash
npm install --global blueprint4llm
```

将下面内容保存为 `plan.md`：

````markdown
# 请求处理流程

```d2
form: 请求表单
api: API 验证
queue: 处理队列

form -> api
api -> queue
```
````

```bash
blueprint4llm plan.md --serve
```

打开终端输出的 URL，通常为 `http://127.0.0.1:8080/`。保存 Markdown 或引用的本地图像后，预览会刷新。工具栏提供深色模式和 PDF 下载。按 `Ctrl+C` 停止服务。

Chrome 通常会自动安装。如果安装脚本被阻止，请手动安装：

```bash
npm exec --yes --package=puppeteer@25.14.0 -- puppeteer browsers install chrome
```

## 工作原理

![Markdown 计划经过验证后可生成实时预览、HTML 或 PDF 文档，也可生成独立的 SVG、PNG 或 JPEG 图像](https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/workflow.svg)

## 格式

可在 CommonMark 和 GitHub Flavored Markdown 中使用围栏代码块：文本、表格、列表、链接、图像和代码。普通代码块会进行语法高亮。

| 格式       | 围栏标记                | 输入和支持范围                                                                                                                 |
| ---------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| D2         | `d2`                    | 使用内置 WebAssembly 离线渲染独立 D2 源码。支持容器、连接、样式、SQL 表、UML 类和时序图。                                      |
| Mermaid    | `mermaid`               | 流程、时序、类、状态和 ER 图；支持时采用纵向布局。                                                                             |
| Graphviz   | `graphviz`, `dot`       | 在 worker 中将单个独立 DOT 图渲染为 SVG。支持经过验证的 `dot`、`neato`、`circo`、`fdp`、`osage`、`patchwork` 和 `twopi` 引擎。 |
| PlantUML   | `plantuml`              | 标准 `@start…` / `@end…` 图表。本地引擎，不需要 Java、外部 include 或网络请求。                                                |
| draw.io    | `drawio`, `draw.io`     | 结构化 JSON，包含节点、分组、标签和边。自动布局；无需 XML。                                                                    |
| Pencil     | `pencil`, `pen`         | 内嵌 `.pen` JSONC，schema 2.21。支持画框、分组、形状、路径和文本；不支持图像、组件、渐变或效果。                               |
| Balsamiq   | `balsamiq`              | 一个包含常用控件的 Mockups 3 mockup。保留位置和文本；不支持 `.bmpr`、`.bmml`、资源或符号。                                     |
| Figma      | `figma`                 | 在本地渲染 REST API JSON，或通过 Figma API 导出 frame URL。URL 模式需要令牌。                                                  |
| OpenAPI    | `openapi`               | 将 OpenAPI 3.1.1 YAML 或 JSON 渲染为静态 API 参考文档，包含操作和组件 schema。                                                 |
| Excalidraw | `excalidraw`            | 严格的 `.excalidraw` JSON v2。保留位置、旋转、分组、形状、文本和普通箭头；不支持的项目会显示占位内容。                         |
| Vega-Lite  | `vega-lite`, `vegalite` | 使用内嵌数据的 Vega-Lite 6 规范；本地渲染为静态 SVG。                                                                          |
| ECharts    | `echarts`               | 使用受支持的静态图表配置的严格 JSON；本地渲染为 SVG。                                                                          |

下方为每种受支持格式提供了视觉示例。所有图中的标签均为英文。

| 格式                                         |                                                                                                   预览                                                                                                   | 格式                                           |                                                                                           预览                                                                                            |
| -------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | ---------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| [D2](examples/blueprint-d2.md)               |        <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/d2.svg" alt="买家应用、API 网关、订单、库存、支付、事件和邮件服务之间的 D2 结账时序" width="440">        | [Mermaid](examples/blueprint-mermaid.md)       |        <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/mermaid.svg" alt="导入状态机，包含验证、嵌套执行、退避重试和死信处理" width="440">        |
| [Graphviz](examples/blueprint-graphviz.md)   |          <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/graphviz.svg" alt="分组事件溯源图，包含 schema 质量门、隔离、重放、存储和消费者" width="440">          | [PlantUML](examples/blueprint-plantuml.md)     |  <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/plantuml.svg" alt="事件响应流程，包含 SLO 检测、决策分支、并行恢复工作和后续跟进" width="440">  |
| [draw.io](examples/blueprint-draw.io.md)     |             <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/drawio.svg" alt="包裹生命周期图，分组展示商务、支付、履约、追踪和客户支持" width="440">             | [Pencil](examples/blueprint-pencil.md)         |    <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/pencil.svg" alt="可靠性仪表板，包含导航、服务指标、双序列延迟图和健康状态表" width="440">     |
| [Balsamiq](examples/blueprint-balsamiq.md)   | <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/balsamiq.svg" alt="支持问题分流仪表板，包含可搜索的优先队列、SLA 背景、选中工单以及分配和回复控件" width="440"> | [Figma](examples/blueprint-figma.md)           | <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/figma.svg" alt="京都移动行程，包含目的地卡片、住宿详情、客人数、价格明细和预订操作" width="440"> |
| [OpenAPI](examples/blueprint-openapi.md)     |           <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/openapi.svg" alt="包裹操作 API 参考，包含发货、追踪、分页操作和可复用 schema" width="440">            | [Excalidraw](examples/blueprint-excalidraw.md) |  <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/excalidraw.svg" alt="三阶段发布路线图：探索、私有测试版、逐步推广和证据评估关卡" width="440">   |
| [Vega-Lite](examples/blueprint-vega-lite.md) |        <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/vega-lite.svg" alt="两个区域的月度 p95 延迟趋势图层，显示观测范围和 200 毫秒 SLO 线" width="440">        | [ECharts](examples/blueprint-echarts.md)       |         <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/echarts.svg" alt="热力图对比六个流量时段内连续七天的 API p95 延迟" width="440">          |

### Figma frame

JSON 模式需要根 `DOCUMENT`，无需令牌即可离线使用。在围栏元数据中使用 `node=12:34` 选择 frame。本地渲染器支持容器、基本形状、矢量路径、文本和纯色填充；渐变、效果、遮罩和图像请使用 URL 模式。

URL 模式接受指向 `/design/` 或 `/file/` frame 的 HTTPS 链接。使用具有 `file_content:read` 权限的个人访问令牌。令牌按此顺序查找：`CompileOptions.figmaAccessToken`、`FIGMA_ACCESS_TOKEN`，然后是当前工作目录中的 `.env`。令牌只会发送到 `api.figma.com`；导出的 SVG 会嵌入结果。

## 命令

| 任务           | 命令                                                                   |
| -------------- | ---------------------------------------------------------------------- |
| 实时预览       | `blueprint4llm plan.md --serve --port=8080`                            |
| CI 验证        | `blueprint4llm plan.md --check`                                        |
| 验证并生成报告 | `blueprint4llm plan.md --check --report-json=diagnostics.json`         |
| 导出并生成报告 | `blueprint4llm plan.md --out=plan.html --report-json=diagnostics.json` |
| 导出 HTML      | `blueprint4llm plan.md --out=plan.html`                                |
| 导出并显示计数 | `blueprint4llm plan.md --out=plan.html --diagnostics-summary`          |
| 导出 PDF       | `blueprint4llm plan.md --out=plan.pdf --format=pdf`                    |
| 导出 SVG       | `blueprint4llm plan.md --out=visual.svg --format=svg`                  |
| 导出 PNG       | `blueprint4llm plan.md --out=visual.png --format=png`                  |
| 导出 JPEG      | `blueprint4llm plan.md --out=visual.jpeg --format=jpeg`                |

图像导出要求**恰好包含一个受支持的视觉代码块**；快速开始中的示例符合条件。`--out` 会创建父目录。每次执行只生成一种格式，默认是 HTML。`--check` 会验证 Markdown、图表和本地图像，但不会写入 HTML 或资源。可选参数 `--report-json=<file>` 会以原子方式写入 UTF-8 JSON 报告，可与 `--check` 及单次导出配合使用。报告路径必须与输入和输出路径不同，也不能是它们的符号链接别名。`--report-json` 不能与 `--serve` 一起使用。

生成的文档默认不显示错误和警告总数。对 HTML、PDF 导出或实时预览添加 `--diagnostics-summary` 即可显示。失败的图表会在原位置显示完整错误信息；其他 Markdown 和有效图表仍然可用。即使图表出错，HTML 和 PDF 仍会保存，命令随后以代码 `1` 退出。如果图表有错，SVG、PNG 和 JPEG 导出不会替换已存在的文件。只有警告时退出代码为 `0`。无效参数（包括报告路径冲突）会以代码 `2` 退出。

报告包含 `schemaVersion: 1`、值为 `ok` 或 `error` 的 `status`、汇总计数和有序诊断。每条诊断包括 `severity`、稳定的 `code`、`scope`、源路径、可选的 Markdown 坐标与图表标识，以及完整消息。代码包括 `diagram.render`、`diagram.limit`、`diagram.svg`、`renderer.warning`、`document.read`、`document.compile`、`output.render` 和 `output.write`。可选的 `outputs` 对象列出本次执行实际保存的文件。例如，`--check` 报告不含 `outputs` 字段。

致命的文档或导出错误会终止相应操作。如果请求了 JSON 报告且仍可写入，报告会记录文档或输出诊断。报告无法写入时，会向 stderr 输出错误并以代码 `1` 退出；此前已保存的 HTML 或 PDF 仍可使用。参见 [`examples/blueprint-diagnostics.md`](examples/blueprint-diagnostics.md)，其中展示了两个独立的图表错误以及它们之间的一个有效图表。

实时预览会将失败图表留在文档中，PDF 使用同一份已编译文档。只有开启 `--diagnostics-summary` 才会显示总数。修复源文件后，下一次构建会移除诊断。致命的文档错误会显示诊断页，直到源文件修复。

## 输出与限制

| 主题              | 行为                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| HTML              | 嵌入图表 SVG；本地图像复制到相邻的 `assets/` 目录。可直接在浏览器中打开结果。                                                  |
| PDF               | A4 页面，使用本地 Noto Sans 字体并支持选择文本。宽 D2 图表使用横向页面。导出前需将外部图像保存到本地。                         |
| 图像路径          | 相对路径以 Markdown 文件为基准。拒绝指向其目录外部的路径和符号链接。                                                           |
| 离线使用          | 本地渲染器无需网络；Figma URL 块会在编译时获取数据。HTML 中的外部图像仍需联网。                                                |
| 安全              | 原始 HTML 会被转义。SVG 会检查是否含有活动内容和外部资源。不支持用户脚本和图形编辑。                                           |
| 文档限制          | Markdown 最大 5 MiB、视觉块 100 个，通常每块最大 256 KiB。                                                                     |
| JSON 限制         | draw.io、Pencil、Figma：1 MiB 和 10,000 个单元格/节点。Balsamiq：256 KiB 和 3,000 个控件。                                     |
| Vega-Lite 限制    | 源码 256 KiB、64 层、50,000 个 AST 节点、10,000 行源数据、100 个展开视图和转换、50,000 行/项计算结果，以及 4 MiB SVG。         |
| OpenAPI 限制      | 源码 256 KiB、200 个操作、500 个命名 schema、2,000 个引用、5,000 行布局和 4 MiB SVG。                                          |
| 超时              | Mermaid、PlantUML 和 Vega-Lite：30 秒。draw.io 布局：5 秒。PDF：60 秒。                                                        |
| Linux 上的 Chrome | 需要 Chrome 系统库。沙盒启动失败时会使用 `--no-sandbox` 重试。设置 `BLUEPRINT4LLM_DISABLE_CHROME_SANDBOX=1` 可强制使用此模式。 |

## 智能代理和编辑器工作流

| 工作流                                                                               | 设置                                                                                                                                                                              |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 编码代理                                                                             | 使用 `blueprint4llm` skill；Codex 和 Claude Code 的安装与调用方式见[快速开始](#快速开始)。                                                                                        |
| [VS Code](https://github.com/evgenyigumnov/blueprint4llm/tree/main/vscode-extension) | 使用 `code --install-extension <file.vsix>` 安装构建好的 VSIX。打开 Markdown 文件并运行 **Blueprint: Open Preview to the Side**。使用 **Blueprint: Export Preview as PDF** 保存。 |

VS Code 预览会在延迟 200 毫秒后编译未保存的更改，可通过 `blueprint4llm.preview.debounceMs` 配置。需要桌面版 VS Code ≥1.101.0 和 Puppeteer 的 Chrome。

## 程序化 API

使用 `npm install blueprint4llm` 在本地安装，然后导入 ESM 导出：

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

| 导出项                                        | 用途                                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `compileMarkdown(markdown, options)`          | 返回 `html`、`title`、`assets`、兼容旧版的 `warnings`/`errors` 字符串数组及结构化 `diagnostics`。 |
| `renderPdf(compiled, { signal }?)`            | 生成 PDF 字节；将其作为 `pdf` 传给 `writeBlueprintOutput()`。                                     |
| `writeBlueprintOutput(path, options)`         | 写入含资源的 HTML 和/或 PDF，并返回绝对输出路径。                                                 |
| `startPreviewServer({ input, port, signal })` | 返回 `url`、`port` 和异步 `close()` 方法。                                                        |

`warnings` 和 `errors` 仍是供现有调用方使用的格式化字符串数组。`diagnostics` 增加结构化记录；为兼容旧版编译器实现，公共类型中的该字段为可选项，旧实现仍可只返回字符串数组。内置编译器始终返回 `diagnostics`。在 `CompileOptions` 中设置 `includeDiagnosticsSummary: true` 可在生成的 HTML 中加入无障碍计数，默认关闭。`startPreviewServer()` 也接受此选项。

## 开发

从仓库克隆目录执行：

```bash
npm ci
npx puppeteer browsers install chrome
npm run build
npm run typecheck
npm run lint
npm run format:check
npm test
```

使用 `node dist/cli.js` 直接运行 CLI，或使用 `npm link` 全局安装命令。要构建 VSIX，请在 `vscode-extension/` 目录中运行 `npm install` 和 `npm run package`。
