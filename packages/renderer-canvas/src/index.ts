/**
 * @kamvachart/renderer-canvas — Canvas 2D output and DOM interaction
 * for KamvaChart. Depends only on @kamvachart/chart-core.
 */
export { CanvasRenderer, type CanvasRendererOptions } from "./canvas-renderer.js";
export { InteractionController } from "./interaction.js";
export { createChart, type CreateChartOptions } from "./create-chart.js";
export { darkTheme, lightTheme, type Theme } from "./theme.js";
export {
  drawBackground,
  drawGrid,
  drawCandles,
  drawLineSeries,
  drawAxes,
  drawCrosshair,
  defaultFormatters,
  type AxisFormatters,
} from "./layers.js";
