/**
 * kamvachart — public v1 facade (curated).
 *
 *   npm install kamvachart
 *   import { createChart, sma, ema, rsi } from "kamvachart";
 *
 * Only this surface is part of the v1 contract. It is deliberately minimal:
 * the underlying packages expose more (Viewport, PriceScale, tick helpers,
 * raw layers, ...); consumers who need those can depend on the scoped
 * packages directly.
 *
 * Names are the REAL exports from the owning packages — nothing is invented
 * here. Note the pure-math functions are `computeBollinger` / `computeIchimoku`
 * (not computeBollingerBands / computeIchimoku).
 */

// ---- engine -----------------------------------------------------------

export { Chart } from "@kamvachart/chart-core";
// Minimal types every consumer of the facade needs to type their code.
export type {
  ChartOptions,
  Candle,
  LineSeriesPoint,
  Series,
  SeriesOptions,
  Plugin,
  ChartApi,
  ChartEvents,
  ChartSubscriptions,
  CrosshairPosition,
  VisibleRange,
  TimeScaleApi,
  PriceScaleApi,
  PriceRange,
} from "@kamvachart/chart-core";

// ---- canvas output ----------------------------------------------------

export { createChart, CanvasRenderer } from "@kamvachart/renderer-canvas";
export type { CreateChartOptions, CanvasRendererOptions } from "@kamvachart/renderer-canvas";

// ---- indicators -------------------------------------------------------

export {
  sma,
  ema,
  rsi,
  macd,
  bollingerBands,
  vwap,
  atr,
  ichimoku,
} from "@kamvachart/indicators";

// Pure computation (headless / backtests / unit tests) — no Plugin involved.
export {
  computeSMA,
  computeEMA,
  computeRSI,
  computeMACD,
  computeBollinger,
  computeVWAP,
  computeATR,
  computeIchimoku,
} from "@kamvachart/indicators";

// Option types for the plugin factories above.
export type {
  SmaOptions,
  EmaOptions,
  RsiOptions,
  MacdOptions,
  BollingerOptions,
  VwapOptions,
  AtrOptions,
  IchimokuOptions,
} from "@kamvachart/indicators";