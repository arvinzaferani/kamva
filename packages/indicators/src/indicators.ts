/**
 * Official indicator plugins. Each factory returns a chart-core Plugin —
 * add it with `chart.use(...)`. All drawing goes through the public
 * Plugin.draw surface, so no renderer import lives here (ARCHITECTURE.md:
 * indicators = plugins only).
 */
import type { Plugin } from "@kamvachart/chart-core";
import {
  computeATR,
  computeBollinger,
  computeEMA,
  computeIchimoku,
  computeMACD,
  computeRSI,
  computeSMA,
  computeVWAP,
  type IchimokuOptions as IchimokuPeriods,
} from "./math.js";
import { indicatorPlugin } from "./plugin.js";
import type { IndicatorSeries, IndicatorValueDomain } from "./types.js";

/** Default palette shared by the official indicators. Override per-indicator. */
export const indicatorColors = {
  blue: "#2962ff",
  teal: "#26a69a",
  orange: "#ff9800",
  red: "#ef5350",
  purple: "#9c27b0",
  gray: "#787b86",
  green: "#089981",
} as const;

export interface LineStyle {
  readonly color?: string;
  readonly width?: number;
  readonly dashed?: boolean;
}

function assertPositiveInt(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer (got ${value})`);
  }
}

// ---- overlays (share the price scale) ------------------------------------

export interface SmaOptions extends LineStyle {
  readonly period: number;
}

/** Simple Moving Average overlay. */
export function sma(options: SmaOptions): Plugin {
  assertPositiveInt(options.period, "sma: period");
  return indicatorPlugin({
    name: `sma(${options.period})`,
    compute: (candles) => ({
      lines: [
        {
          values: computeSMA(candles, options.period),
          color: options.color ?? indicatorColors.teal,
          width: options.width ?? 1.5,
        },
      ],
    }),
  });
}

export interface EmaOptions extends LineStyle {
  readonly period: number;
}

/** Exponential Moving Average overlay. */
export function ema(options: EmaOptions): Plugin {
  assertPositiveInt(options.period, "ema: period");
  return indicatorPlugin({
    name: `ema(${options.period})`,
    compute: (candles) => ({
      lines: [
        {
          values: computeEMA(candles, options.period),
          color: options.color ?? indicatorColors.blue,
          width: options.width ?? 1.5,
        },
      ],
    }),
  });
}

export interface BollingerOptions {
  readonly period?: number;
  readonly multiplier?: number;
  readonly middleColor?: string;
  readonly bandColor?: string;
  readonly width?: number;
}

/** Bollinger Bands overlay. */
export function bollingerBands(options: BollingerOptions = {}): Plugin {
  const period = options.period ?? 20;
  const multiplier = options.multiplier ?? 2;
  assertPositiveInt(period, "bollinger: period");
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    throw new Error(`bollinger: multiplier must be > 0 (got ${multiplier})`);
  }
  const middleColor = options.middleColor ?? indicatorColors.orange;
  const bandColor = options.bandColor ?? indicatorColors.gray;
  return indicatorPlugin({
    name: `bollinger(${period}, ${multiplier})`,
    compute: (candles) => {
      const v = computeBollinger(candles, period, multiplier);
      return {
        lines: [
          { values: v.upper, color: bandColor, width: options.width ?? 1 },
          { values: v.middle, color: middleColor, width: options.width ?? 1.5 },
          { values: v.lower, color: bandColor, width: options.width ?? 1 },
        ],
      };
    },
  });
}

export type VwapOptions = LineStyle;

/** Volume-Weighted Average Price overlay. */
export function vwap(options: VwapOptions = {}): Plugin {
  return indicatorPlugin({
    name: "vwap",
    compute: (candles) => ({
      lines: [
        {
          values: computeVWAP(candles),
          color: options.color ?? indicatorColors.gray,
          width: options.width ?? 1,
          dashed: options.dashed ?? false,
        },
      ],
    }),
  });
}

export interface AtrOptions extends LineStyle {
  readonly period?: number;
}

/** Average True Range overlay. */
export function atr(options: AtrOptions = {}): Plugin {
  const period = options.period ?? 14;
  assertPositiveInt(period, "atr: period");
  return indicatorPlugin({
    name: `atr(${period})`,
    compute: (candles) => ({
      lines: [
        {
          values: computeATR(candles, period),
          color: options.color ?? indicatorColors.orange,
          width: options.width ?? 1.5,
        },
      ],
    }),
  });
}

// ---- oscillators (own value domain, drawn in a bottom band) ---------------

export interface RsiOptions extends LineStyle {
  readonly period?: number;
}

/** RSI oscillator (0–100 band). */
export function rsi(options: RsiOptions = {}): Plugin {
  const period = options.period ?? 14;
  assertPositiveInt(period, "rsi: period");
  const domain: IndicatorValueDomain = { min: 0, max: 100 };
  return indicatorPlugin({
    name: `rsi(${period})`,
    compute: (candles) => ({
      lines: [
        {
          values: computeRSI(candles, period),
          color: options.color ?? indicatorColors.purple,
          width: options.width ?? 1.5,
          valueDomain: domain,
          heightFraction: 0.25,
        },
      ],
    }),
  });
}

export interface MacdOptions {
  readonly fast?: number;
  readonly slow?: number;
  readonly signal?: number;
  readonly macdColor?: string;
  readonly signalColor?: string;
  readonly histogramColor?: string;
  readonly width?: number;
}

/** MACD oscillator (line, signal line and histogram bars). */
export function macd(options: MacdOptions = {}): Plugin {
  const fast = options.fast ?? 12;
  const slow = options.slow ?? 26;
  const signal = options.signal ?? 9;
  assertPositiveInt(fast, "macd: fast");
  assertPositiveInt(slow, "macd: slow");
  assertPositiveInt(signal, "macd: signal");
  if (fast >= slow) throw new Error("macd: fast must be less than slow");

  return indicatorPlugin({
    name: `macd(${fast}, ${slow}, ${signal})`,
    compute: (candles) => {
      const v = computeMACD(candles, fast, slow, signal);
      const domain = valueDomainOf(v.macd, v.signal, v.histogram);
      const shared = { valueDomain: domain, heightFraction: 0.25 };
      return {
        lines: [
          { values: v.macd, color: options.macdColor ?? indicatorColors.blue, width: options.width ?? 1.5, ...shared },
          { values: v.signal, color: options.signalColor ?? indicatorColors.orange, width: options.width ?? 1.5, ...shared },
          { values: v.histogram, color: options.histogramColor ?? indicatorColors.teal, width: 1, bars: true, ...shared },
        ],
      };
    },
  });
}

/** Symmetric value domain covering all three MACD series. */
function valueDomainOf(...series: readonly IndicatorSeries[]): IndicatorValueDomain {
  let maxAbs = 0;
  for (const s of series) {
    for (const v of s) {
      if (v !== undefined && Number.isFinite(v)) {
        const a = Math.abs(v);
        if (a > maxAbs) maxAbs = a;
      }
    }
  }
  const bound = maxAbs * 1.1 || 1;
  return { min: -bound, max: bound };
}

// ---- Ichimoku ------------------------------------------------------------

export interface IchimokuOptions extends IchimokuPeriods {
  readonly tenkanColor?: string;
  readonly kijunColor?: string;
  readonly senkouAColor?: string;
  readonly senkouBColor?: string;
  readonly chikouColor?: string;
  readonly cloudColor?: string;
}

/** Ichimoku Cloud overlay (Tenkan, Kijun, Chikou, leading spans + cloud). */
export function ichimoku(options: IchimokuOptions = {}): Plugin {
  const conversionPeriods = options.conversionPeriods ?? 9;
  const basePeriods = options.basePeriods ?? 26;
  const spanBPeriods = options.spanBPeriods ?? 52;
  const displacement = options.displacement ?? 26;
  assertPositiveInt(conversionPeriods, "ichimoku: conversionPeriods");
  assertPositiveInt(basePeriods, "ichimoku: basePeriods");
  assertPositiveInt(spanBPeriods, "ichimoku: spanBPeriods");
  assertPositiveInt(displacement, "ichimoku: displacement");

  return indicatorPlugin({
    name: `ichimoku(${conversionPeriods}, ${basePeriods}, ${spanBPeriods})`,
    compute: (candles) => {
      const v = computeIchimoku(candles, { conversionPeriods, basePeriods, spanBPeriods, displacement });
      return {
        lines: [
          { values: v.tenkan, color: options.tenkanColor ?? indicatorColors.blue, width: 1 },
          { values: v.kijun, color: options.kijunColor ?? indicatorColors.orange, width: 1 },
          { values: v.chikou, color: options.chikouColor ?? indicatorColors.gray, width: 1, offset: -displacement },
          { values: v.senkouA, color: options.senkouAColor ?? indicatorColors.green, width: 1, offset: displacement },
          { values: v.senkouB, color: options.senkouBColor ?? indicatorColors.red, width: 1, offset: displacement },
        ],
        areas: [
          {
            top: v.senkouA,
            bottom: v.senkouB,
            color: options.cloudColor ?? "rgba(38, 166, 154, 0.12)",
            offset: displacement,
          },
        ],
      };
    },
  });
}
