/**
 * @kamvachart/chart-core — framework-agnostic charting engine core.
 *
 * Owns: state, viewport, camera, events, plugin system.
 * Never owns: DOM, canvas, frameworks (see ARCHITECTURE.md).
 */
export type { Candle, VisibleRange, PriceRange, Size, Point } from "./types.js";
export { EventBus, type EventHandler } from "./event-bus.js";
export { DataStore } from "./data-store.js";
export { Camera } from "./camera.js";
export { Viewport, padPriceRange } from "./viewport.js";
export { priceTicks, timeTickIndices } from "./ticks.js";
export type {
  Renderer,
  Plugin,
  PluginDrawContext,
  ChartApi,
  ChartEvents,
} from "./contracts.js";
export { Chart, type ChartOptions } from "./chart.js";
