import { Chart, type ChartOptions } from "@kamvachart/chart-core";
import { CanvasRenderer, type CanvasRendererOptions } from "./canvas-renderer.js";
import { InteractionController } from "./interaction.js";

export interface CreateChartOptions extends ChartOptions, CanvasRendererOptions {
  /** Attach wheel/drag/crosshair handlers. Default true. */
  interactive?: boolean;
}

/**
 * One-call entry point: wire a Chart to a canvas element.
 *
 *   const chart = createChart(canvas);
 *   chart.setData(candles);
 *
 * Returns the Chart itself — the full public API lives on chart-core;
 * this package only supplies the output surface and input handling.
 * chart.destroy() tears everything down, including what was wired here.
 */
export function createChart(canvas: HTMLCanvasElement, options: CreateChartOptions = {}): Chart {
  const chart = new Chart(options);
  const renderer = new CanvasRenderer(canvas, options);
  chart.attachRenderer(renderer);
  renderer.setResizeCallback(() => chart.invalidate());

  const interaction =
    options.interactive === false ? undefined : new InteractionController(canvas, chart, renderer);
  if (interaction) {
    chart.on("destroy", () => interaction.destroy());
  }
  return chart;
}
