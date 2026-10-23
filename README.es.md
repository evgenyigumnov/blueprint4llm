# blueprint4llm

**Idiomas:** [English](README.md) | [Русский](README.ru.md) | [Español](README.es.md) | [中文](README.zh.md) | [हिन्दी](README.hi.md) | [Français](README.fr.md) | [العربية](README.ar.md)

**Planes en Markdown → diagramas, prototipos de interfaz, gráficos, HTML y PDF.**

Escribe un plan por tu cuenta o con un agente. Revisa el sistema y las pantallas antes de implementar.
Markdown sigue siendo la fuente de verdad; la CLI lo renderiza sin llamar a un LLM.

![Archivo Markdown junto a su diagrama Mermaid renderizado, una pantalla de Balsamiq y un gráfico de estado de solicitudes](https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/markdown-to-visual.png)

## Ejemplo representativo

Explora [`plan.md`](examples/representative-plan.md) y compara sus resultados en [HTML](examples/representative-plan.html) y [PDF](examples/representative-plan.pdf).

## Inicio rápido

### Usar con Codex o Claude Code

Desde el directorio de tu proyecto, instala la skill `blueprint4llm` con la [CLI de skills](https://github.com/vercel-labs/skills):

```bash
# Codex
npx skills add evgenyigumnov/blueprint4llm --skill blueprint4llm --agent codex

# Claude Code
npx skills add evgenyigumnov/blueprint4llm --skill blueprint4llm --agent claude-code
```

El instalador requiere **Node.js ≥22.20.0** y npm. De forma predeterminada, instala la skill para el proyecto actual; añade `--global` para usarla en todos los proyectos. Codex guarda las skills del proyecto en `.agents/skills/`; Claude Code las guarda en `.claude/skills/`.

Invoca la skill desde tu agente:

```text
# Codex
$blueprint4llm Crea un plan visual para una cola de tareas.

# Claude Code
/blueprint4llm Crea un plan visual para una cola de tareas.
```

La skill guía al agente para redactar un plan visual, validarlo, renderizarlo y revisar cada elemento visual. El renderizado requiere la CLI `blueprint4llm` y Chrome de Puppeteer; la siguiente sección explica cómo instalar y ejecutar la CLI.

### Usar la CLI directamente

Requiere **Node.js ≥22.13.0**, npm y Chrome de Puppeteer.

```bash
npm install --global blueprint4llm
```

Guarda esto como `plan.md`:

````markdown
# Flujo de solicitudes

```d2
form: Formulario de solicitud
api: Validación de API
queue: Cola de procesamiento

form -> api
api -> queue
```
````

```bash
blueprint4llm plan.md --serve
```

Abre la URL que aparece en la terminal, normalmente `http://127.0.0.1:8080/`. Al guardar el Markdown o una imagen local referenciada, la vista previa se actualiza. La barra de herramientas ofrece el modo oscuro y la descarga en PDF. Detén el servidor con `Ctrl+C`.

Chrome suele instalarse automáticamente. Si se bloquearon los scripts de instalación, instálalo manualmente:

```bash
npm exec --yes --package=puppeteer@25.14.0 -- puppeteer browsers install chrome
```

## Cómo funciona

![Un plan Markdown se valida y se convierte en vistas previas interactivas, documentos HTML o PDF, o una imagen independiente en SVG, PNG o JPEG](https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/workflow.svg)

## Formatos

Usa bloques de código cercados junto con CommonMark y GitHub Flavored Markdown: texto, tablas, listas,
enlaces, imágenes y código. Los bloques de código normales reciben resaltado de sintaxis.

| Formato    | Cercado                 | Entrada y compatibilidad                                                                                                                                                         |
| ---------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D2         | `d2`                    | Código D2 autónomo, renderizado sin conexión con WebAssembly incluido. Admite contenedores, conexiones, estilos, tablas SQL, clases UML y secuencias.                            |
| Mermaid    | `mermaid`               | Diagramas de flujo, secuencia, clases, estados y ER. Cuando es posible, usa una disposición vertical.                                                                            |
| Graphviz   | `graphviz`, `dot`       | Un grafo DOT autónomo se renderiza como SVG en un worker. Admite los motores verificados `dot`, `neato`, `circo`, `fdp`, `osage`, `patchwork` y `twopi`.                         |
| PlantUML   | `plantuml`              | Diagramas estándar con `@start…` / `@end…`. Motor local, sin Java, inclusiones externas ni solicitudes de red.                                                                   |
| draw.io    | `drawio`, `draw.io`     | JSON estructurado con nodos, grupos, etiquetas y aristas. Disposición automática; no usa XML.                                                                                    |
| Pencil     | `pencil`, `pen`         | JSONC `.pen` integrado, esquema 2.21. Admite marcos, grupos, formas, trazados y texto; no admite imágenes, componentes, degradados ni efectos.                                   |
| Balsamiq   | `balsamiq`              | Un mockup de Mockups 3 con controles comunes. Conserva las posiciones y el texto; no admite `.bmpr`, `.bmml`, recursos ni símbolos.                                              |
| Figma      | `figma`                 | El JSON de REST API se renderiza localmente, o se exporta un frame mediante su URL y la API de Figma. El modo URL necesita un token.                                             |
| OpenAPI    | `openapi`               | YAML o JSON de OpenAPI 3.1.1 convertido en una referencia estática de API, con operaciones y esquemas de componentes.                                                            |
| Excalidraw | `excalidraw`            | JSON `.excalidraw` estricto de la versión 2. Conserva posiciones, rotaciones, grupos, formas, texto y flechas normales; los elementos no admitidos se sustituyen por marcadores. |
| Vega-Lite  | `vega-lite`, `vegalite` | Especificaciones de Vega-Lite 6 con datos integrados; se renderizan localmente como SVG estático.                                                                                |
| ECharts    | `echarts`               | JSON estricto con el perfil de gráficos estáticos admitido; se renderiza localmente como SVG.                                                                                    |

A continuación hay un ejemplo visual de cada formato compatible. Todas las etiquetas de las imágenes están en inglés.

| Formato                                      |                                                                                                                                   Vista previa                                                                                                                                    | Formato                                        |                                                                                                                        Vista previa                                                                                                                        |
| -------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: | ---------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| [D2](examples/blueprint-d2.md)               | <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/d2.svg" alt="Secuencia de compra D2 entre la aplicación del comprador, la puerta de enlace API y los servicios de pedidos, inventario, pagos, eventos y correo electrónico" width="440"> | [Mermaid](examples/blueprint-mermaid.md)       | <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/mermaid.svg" alt="Máquina de estados de importación con validación, ejecución anidada, reintentos con espera progresiva y cola de mensajes fallidos" width="440"> |
| [Graphviz](examples/blueprint-graphviz.md)   |                 <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/graphviz.svg" alt="Linaje agrupado de eventos con control de calidad de esquemas, cuarentena, reproducción, almacenamiento y consumidores" width="440">                  | [PlantUML](examples/blueprint-plantuml.md)     |         <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/plantuml.svg" alt="Respuesta a incidentes con detección de SLO, vías de decisión, tareas de recuperación en paralelo y seguimiento" width="440">          |
| [draw.io](examples/blueprint-draw.io.md)     |                      <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/drawio.svg" alt="Mapa agrupado del ciclo de vida de un paquete: comercio, pagos, preparación, seguimiento y atención al cliente" width="440">                       | [Pencil](examples/blueprint-pencil.md)         |           <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/pencil.svg" alt="Panel de fiabilidad con navegación, métricas de servicios, gráfico de latencia de dos series y tabla de estado" width="440">           |
| [Balsamiq](examples/blueprint-balsamiq.md)   |      <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/balsamiq.svg" alt="Panel de clasificación de soporte con cola priorizada y buscador, contexto de SLA, ticket seleccionado y controles de asignación y respuesta" width="440">       | [Figma](examples/blueprint-figma.md)           |    <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/figma.svg" alt="Itinerario móvil por Kioto con tarjeta del destino, alojamiento, número de huéspedes, desglose del precio y acción de reserva" width="440">    |
| [OpenAPI](examples/blueprint-openapi.md)     |                         <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/openapi.svg" alt="Referencia de API de operaciones de paquetes con envío, seguimiento, paginación y esquemas reutilizables" width="440">                         | [Excalidraw](examples/blueprint-excalidraw.md) |       <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/excalidraw.svg" alt="Hoja de ruta de lanzamiento en tres etapas: exploración, beta privada, despliegue y punto de control de evidencias" width="440">       |
| [Vega-Lite](examples/blueprint-vega-lite.md) |                    <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/vega-lite.svg" alt="Tendencias mensuales de latencia p95 en dos regiones, con rangos observados y una línea SLO de 200 milisegundos" width="440">                     | [ECharts](examples/blueprint-echarts.md)       |                     <img src="https://raw.githubusercontent.com/evgenyigumnov/blueprint4llm/main/docs/assets/echarts.svg" alt="Mapa de calor de siete días que compara la latencia p95 de API en seis franjas de tráfico" width="440">                     |

### Frames de Figma

El modo JSON requiere un `DOCUMENT` raíz y funciona sin conexión ni token. Selecciona un frame con `node=12:34` en los metadatos del bloque. El renderizador local admite contenedores, formas básicas, trazados vectoriales, texto y rellenos sólidos; para degradados, efectos, máscaras e imágenes, usa el modo URL.

El modo URL acepta enlaces HTTPS a frames `/design/` o `/file/`. Usa un token de acceso personal con el permiso `file_content:read`. El token se busca en este orden: `CompileOptions.figmaAccessToken`, `FIGMA_ACCESS_TOKEN` y, por último, `.env` en el directorio de trabajo actual. El token solo se envía a `api.figma.com`; los SVG exportados se integran en el resultado.

## Comandos

| Tarea                | Comando                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| Vista previa en vivo | `blueprint4llm plan.md --serve --port=8080`                            |
| Validar para CI      | `blueprint4llm plan.md --check`                                        |
| Validar con informe  | `blueprint4llm plan.md --check --report-json=diagnostics.json`         |
| Exportar con informe | `blueprint4llm plan.md --out=plan.html --report-json=diagnostics.json` |
| Exportar HTML        | `blueprint4llm plan.md --out=plan.html`                                |
| Exportar con resumen | `blueprint4llm plan.md --out=plan.html --diagnostics-summary`          |
| Exportar PDF         | `blueprint4llm plan.md --out=plan.pdf --format=pdf`                    |
| Exportar SVG         | `blueprint4llm plan.md --out=visual.svg --format=svg`                  |
| Exportar PNG         | `blueprint4llm plan.md --out=visual.png --format=png`                  |
| Exportar JPEG        | `blueprint4llm plan.md --out=visual.jpeg --format=jpeg`                |

Las exportaciones de imagen requieren **exactamente un bloque visual compatible**; el ejemplo de inicio rápido cumple el requisito. `--out` crea los directorios superiores. Cada ejecución produce un formato; HTML es el predeterminado. `--check` valida Markdown, diagramas e imágenes locales sin escribir HTML ni recursos. La opción `--report-json=<file>` escribe de forma atómica un informe JSON UTF-8. Funciona con `--check` y exportaciones puntuales. La ruta del informe debe ser distinta de las rutas de entrada y salida, incluidas las equivalencias mediante enlaces simbólicos. No se puede usar `--report-json` con `--serve`.

De forma predeterminada, los documentos generados no muestran el total de errores y advertencias. Añade `--diagnostics-summary` a las exportaciones HTML o PDF y a las vistas previas en vivo para incluirlo. Un diagrama con errores conserva el mensaje completo en su posición; el resto del Markdown y los diagramas válidos siguen disponibles. Las exportaciones HTML y PDF se guardan aunque un diagrama tenga errores; después, el comando termina con el código `1`. Las exportaciones SVG, PNG y JPEG no sustituyen un archivo existente si el diagrama contiene errores. Si solo hay advertencias, el código de salida es `0`. Los argumentos no válidos, incluidos los conflictos de rutas del informe, producen el código `2`.

El informe contiene `schemaVersion: 1`, un `status` (`ok` o `error`), recuentos resumidos y diagnósticos ordenados. Cada diagnóstico incluye `severity`, un `code` estable, `scope`, la ruta de origen, coordenadas Markdown opcionales e identidad del diagrama, y el mensaje completo. Los códigos son `diagram.render`, `diagram.limit`, `diagram.svg`, `renderer.warning`, `document.read`, `document.compile`, `output.render` y `output.write`. El objeto opcional `outputs` enumera los archivos que la ejecución guardó realmente. Por ejemplo, los informes de `--check` no tienen el campo `outputs`.

Los errores fatales del documento o de exportación detienen esa operación. Si se solicitó un informe JSON y todavía se puede escribir, incluirá un diagnóstico del documento o de la salida. Si no se puede escribir, se informa en stderr y el comando termina con el código `1`; los archivos HTML o PDF guardados antes siguen disponibles. Consulta [`examples/blueprint-diagnostics.md`](examples/blueprint-diagnostics.md), que contiene dos errores de diagrama independientes y un diagrama válido entre ambos.

En la vista previa en vivo, los diagramas con errores permanecen integrados y el PDF usa el mismo documento compilado. El recuento total solo aparece con `--diagnostics-summary`. Al corregir el origen, los diagnósticos desaparecen en la siguiente compilación. Un error fatal del documento muestra una página de diagnóstico hasta que se corrija el origen.

## Salida y límites

| Tema                  | Comportamiento                                                                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTML                  | Inserta los SVG de los diagramas; copia las imágenes locales a una carpeta `assets/` adyacente. Abre el resultado directamente en un navegador.                                   |
| PDF                   | Páginas A4 con fuentes Noto Sans locales y texto seleccionable. Los diagramas D2 anchos usan páginas apaisadas. Guarda localmente las imágenes externas antes de exportar.        |
| Rutas de imagen       | Las rutas relativas se resuelven desde el archivo Markdown. Se rechazan las rutas y los enlaces simbólicos que salen de su directorio.                                            |
| Uso sin conexión      | Los renderizadores locales no necesitan red; los bloques de URL de Figma obtienen datos durante la compilación. HTML necesita conexión para imágenes externas.                    |
| Seguridad             | El HTML sin procesar se escapa. Se comprueba que los SVG no incluyan contenido activo ni recursos externos. No se admiten scripts del usuario ni edición gráfica.                 |
| Límites del documento | 5 MiB de Markdown, 100 bloques visuales y, normalmente, 256 KiB por bloque.                                                                                                       |
| Límites de JSON       | draw.io, Pencil y Figma: 1 MiB y 10 000 celdas/nodos. Balsamiq: 256 KiB y 3 000 controles.                                                                                        |
| Límites de Vega-Lite  | Fuente de 256 KiB, 64 niveles, 50 000 nodos AST, 10 000 filas de origen, 100 vistas y transformaciones expandidas, 50 000 filas/elementos calculados y SVG de 4 MiB.              |
| Límites de OpenAPI    | Fuente de 256 KiB, 200 operaciones, 500 esquemas con nombre, 2 000 referencias, 5 000 líneas de diseño y SVG de 4 MiB.                                                            |
| Tiempos límite        | Mermaid, PlantUML y Vega-Lite: 30 segundos. Diseño de draw.io: 5 segundos. PDF: 60 segundos.                                                                                      |
| Chrome en Linux       | Requiere bibliotecas del sistema de Chrome. Si falla el inicio en sandbox, se reintenta con `--no-sandbox`. Define `BLUEPRINT4LLM_DISABLE_CHROME_SANDBOX=1` para forzar ese modo. |

## Flujos de trabajo para agentes y editores

| Flujo                  | Configuración                                                                                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agente de programación | Usa la skill `blueprint4llm`; consulta [Inicio rápido](#inicio-rápido) para instalarla y ejecutarla con Codex o Claude Code.                                                                               |
| VS Code                | Instala un VSIX compilado con `code --install-extension <file.vsix>`. Abre un archivo Markdown y ejecuta **Blueprint: Open Preview to the Side**. Usa **Blueprint: Export Preview as PDF** para guardarlo. |

La vista previa de VS Code compila los cambios sin guardar tras 200 ms; el retardo se configura con `blueprint4llm.preview.debounceMs`. Requiere VS Code de escritorio ≥1.101.0 y Chrome de Puppeteer.

## API programática

Instala el paquete localmente con `npm install blueprint4llm` y usa las exportaciones ESM:

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

| Exportación                                   | Propósito                                                                                                             |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `compileMarkdown(markdown, options)`          | Devuelve `html`, `title`, `assets`, los arrays heredados de cadenas `warnings`/`errors` y `diagnostics` estructurado. |
| `renderPdf(compiled, { signal }?)`            | Genera bytes PDF; pásalos como `pdf` a `writeBlueprintOutput()`.                                                      |
| `writeBlueprintOutput(path, options)`         | Escribe HTML o PDF con recursos y devuelve las rutas absolutas de salida.                                             |
| `startPreviewServer({ input, port, signal })` | Devuelve `url`, `port` y un método asíncrono `close()`.                                                               |

`warnings` y `errors` siguen siendo arrays de cadenas formateadas para los consumidores actuales. `diagnostics` añade registros estructurados; es opcional en los tipos públicos para permitir que implementaciones antiguas del compilador sigan devolviendo solo los arrays de cadenas. El compilador incluido siempre devuelve `diagnostics`. Configura `includeDiagnosticsSummary: true` en `CompileOptions` para añadir un recuento accesible al HTML generado. Está desactivado de forma predeterminada. `startPreviewServer()` acepta la misma opción.

## Desarrollo

Desde una copia del repositorio:

```bash
npm ci
npx puppeteer browsers install chrome
npm run build
npm run typecheck
npm run lint
npm run format:check
npm test
```

Ejecuta la CLI directamente con `node dist/cli.js`, o usa `npm link` para instalar el comando de forma global. Para compilar el VSIX, ejecuta `npm install` y `npm run package` desde `vscode-extension/`.
