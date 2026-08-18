/**
 * @kamvachart/indicators — official indicator plugins for KamvaChart.
 *
 * Every indicator is a plugin (`chart.use(sma({ period: 20 }))`); see
 * ARCHITECTURE.md (indicators = plugins only). Pure computation functions
 * are also exported for tests, backtests and headless use.
 */
export {
  sma,
  ema,
  rsi,
  bollingerBands,
  macd,
  vwap,
  atr,
  ichimoku,
  indicatorColors,
  type SmaOptions,
  type EmaOptions,
  type RsiOptions,
  type BollingerOptions,
  type MacdOptions,
  type VwapOptions,
  type AtrOptions,
  type IchimokuOptions,
  type LineStyle,
} from "./indicators.js";
export {
  computeSMA,
  computeEMA,
  computeRSI,
  computeBollinger,
  computeMACD,
  computeVWAP,
  computeATR,
  computeIchimoku,
  type BollingerValues,
  type MacdValues,
  type IchimokuValues,
  type IchimokuOptions as IchimokuPeriods,
} from "./math.js";
export {
  indicatorPlugin,
  type IndicatorPluginOptions,
} from "./plugin.js";
export type {
  IndicatorSeries,
  IndicatorLine,
  IndicatorArea,
  IndicatorResult,
  IndicatorValueDomain,
} from "./types.js";
