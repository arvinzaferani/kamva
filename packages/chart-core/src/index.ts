/**
 * @kamvachart/chart-core — framework-agnostic charting engine core.
 *
 * Owns: state, viewport, camera, events, plugin system.
 * Never owns: DOM, canvas, frameworks (see ARCHITECTURE.md).
 */
export type {
  Candle,
  LineSeriesPoint,
  VisibleRange,
  PriceRange,
  Size,
  Point,
} from "./types.js";
export { EventBus, type EventHandler } from "./event-bus.js";
export { DataStore } from "./data-store.js";
export { Camera } from "./camera.js";
export {
  SeriesImpl,
  type Series,
  type SeriesOptions,
  type CandlestickOptions,
  type LineOptions,
  type SeriesType,
} from "./series.js";
export { Viewport, padPriceRange } from "./viewport.js";
export { priceTicks, timeTickIndices } from "./ticks.js";
export type {
  Renderer,
  RenderSurface,
  RenderableSeries,
  Plugin,
  ChartApi,
  ChartEvents,
  CrosshairPosition,
  VisibleRangePayload,
  ClickPayload,
} from "./contracts.js";
export { Chart, type ChartOptions } from "./chart.js";
