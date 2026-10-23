export const ECHARTS_WORKER_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads");
const warnings = [];
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;
const rememberWarning = function (...parts) {
  if (warnings.length < 32) warnings.push(parts.map(String).join(" ").slice(0, 2048));
};
console.warn = rememberWarning;
console.error = rememberWarning;
console.log = rememberWarning;
(async function () {
  let chart;
  let response;
  try {
    const [{ init, use }, charts, components, renderers] = await Promise.all([
      import(workerData.modulePaths.core),
      import(workerData.modulePaths.charts),
      import(workerData.modulePaths.components),
      import(workerData.modulePaths.renderers)
    ]);
    use([
      charts.BarChart, charts.LineChart, charts.PieChart, charts.ScatterChart,
      charts.RadarChart, charts.HeatmapChart, charts.GaugeChart,
      components.TitleComponent, components.LegendComponent, components.GridComponent,
      components.DatasetComponent, components.VisualMapComponent, renderers.SVGRenderer
    ]);
    chart = init(null, null, {
      renderer: "svg", ssr: true, width: workerData.width, height: workerData.height
    });
    chart.setOption(workerData.option, { notMerge: true, lazyUpdate: false });
    const svg = chart.renderToSVGString();
    response = { ok: true, svg, warnings };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    response = { ok: false, error: message };
  } finally {
    if (chart) chart.dispose();
    console.warn = originalWarn;
    console.error = originalError;
    console.log = originalLog;
  }
  parentPort.postMessage(response);
})().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  parentPort.postMessage({ ok: false, error: message });
});
`;
