/**
 * kamvachart — the public v1 facade.
 *
 * Re-exports the real surface of the underlying packages so consumers need a
 * single import:
 *
 *   import { Chart, CanvasRenderer, SMA, EMA, RSI } from "kamvachart";
 *
 * The indicator plugin factories are aliased under their conventional
 * uppercase names (`SMA` = `sma`, ...); every other name is re-exported
 * verbatim from the package that owns it.
 */

// ---- chart-core: engine, state, camera, events -------------------------

export {
  Chart,
  type ChartOptions,
  TimeScale,
  PriceScale,
  type PriceScaleDeps,
  Viewport,
  padPriceRange,
  priceTicks,
  timeTickIndices,
} from "@kamvachart/chart-core";
export type {
  Candle,
  LineSeriesPoint,
  Series,
  SeriesOptions,
  CandlestickOptions,
  LineOptions,
  SeriesType,
  Renderer,
  RenderSurface,
  RenderableSeries,
  Plugin,
  ChartApi,
  ChartEvents,
  ChartSubscriptions,
  CrosshairPosition,
  CrosshairSeriesDatum,
  VisibleRange,
  VisibleRangePayload,
  ClickPayload,
  TimeScaleApi,
  TimeRange,
  PriceScaleApi,
  PriceRange,
  Size,
  Point,
} from "@kamvachart/chart-core";

// ---- renderer-canvas: Canvas 2D output + DOM interaction ---------------

export {
  CanvasRenderer,
  type CanvasRendererOptions,
  createChart,
  type CreateChartOptions,
  InteractionController,
  darkTheme,
  lightTheme,
  type Theme,
  drawBackground,
  drawGrid,
  drawCandles,
  drawLineSeries,
  drawAxes,
  drawCrosshair,
  defaultFormatters,
  type AxisFormatters,
} from "@kamvachart/renderer-canvas";

// ---- indicators: plugin factories (uppercase aliases) ------------------

import { sma, ema, rsi } from "@kamvachart/indicators";

/** Alias of `sma` — simple moving average plugin factory. */
export const SMA = sma;
/** Alias of `ema` — exponential moving average plugin factory. */
export const EMA = ema;
/** Alias of `rsi` — relative strength index plugin factory. */
export const RSI = rsi;

export {
  bollingerBands,
  macd,
  vwap,
  atr,
  ichimoku,
  indicatorColors,
  indicatorPlugin,
  type IndicatorPluginOptions,
} from "@kamvachart/indicators";
// Pure computation (headless / backtests / unit tests) — no Plugin involved.
export {
  computeSMA,
  computeEMA,
  computeRSI,
  computeBollinger,
  computeMACD,
  computeVWAP,
  computeATR,
  computeIchimoku,
} from "@kamvachart/indicators";
export type {
  SmaOptions,
  EmaOptions,
  RsiOptions,
  BollingerOptions,
  MacdOptions,
  VwapOptions,
  AtrOptions,
  IchimokuOptions,
  IchimokuPeriods,
  LineStyle,
  IndicatorSeries,
  IndicatorLine,
  IndicatorArea,
  IndicatorResult,
  IndicatorValueDomain,
  BollingerValues,
  MacdValues,
  IchimokuValues,
} from "@kamvachart/indicators";
