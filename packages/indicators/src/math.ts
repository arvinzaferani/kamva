/**
 * Pure indicator computations.
 *
 * Each function takes the candle series and returns series aligned to
 * candle indices (`undefined` before warmup). They hold no state and
 * perform no drawing, so they are trivially unit-testable and reusable
 * outside the chart (e.g. in a server-side backtester).
 */
import type { Candle } from "@kamvachart/chart-core";
import type { IndicatorSeries } from "./types.js";

function seriesOf(length: number): (number | undefined)[] {
  return new Array<number | undefined>(length);
}

/** Simple Moving Average of closes. */
export function computeSMA(candles: readonly Candle[], period: number): IndicatorSeries {
  const out = seriesOf(candles.length);
  if (period <= 0) return out;
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    const close = candles[i]?.close;
    if (close === undefined) continue;
    sum += close;
    if (i >= period) sum -= candles[i - period]?.close ?? 0;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Exponential Moving Average of closes, seeded with an SMA of the first period. */
export function computeEMA(candles: readonly Candle[], period: number): IndicatorSeries {
  const out = seriesOf(candles.length);
  if (candles.length === 0 || period <= 0) return out;
  const k = 2 / (period + 1);
  const seedCount = Math.min(period, candles.length);
  let seed = 0;
  for (let i = 0; i < seedCount; i++) seed += candles[i]?.close ?? 0;
  const start = seedCount - 1;
  let prev = seed / seedCount;
  out[start] = prev;
  for (let i = start + 1; i < candles.length; i++) {
    prev = (candles[i]?.close ?? prev) * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** EMA of an arbitrary value series, seeding from the first defined values. */
function emaOfValues(values: IndicatorSeries, period: number): IndicatorSeries {
  const out = seriesOf(values.length);
  if (values.length === 0 || period <= 0) return out;
  const k = 2 / (period + 1);
  let start = -1;
  let seed = 0;
  let seen = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === undefined) continue;
    if (start === -1) start = i;
    seed += v;
    seen++;
    if (seen === period) break;
  }
  if (start === -1 || seen === 0) return out;
  const seedEnd = start + seen - 1;
  let prev = seed / seen;
  out[seedEnd] = prev;
  for (let i = seedEnd + 1; i < values.length; i++) {
    const v = values[i];
    if (v === undefined) continue;
    prev = v * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

function rsiFromAverages(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** Relative Strength Index with Wilder's smoothing. */
export function computeRSI(candles: readonly Candle[], period: number): IndicatorSeries {
  const out = seriesOf(candles.length);
  if (candles.length <= period || period <= 0) return out;
  const k = 1 / period;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = (candles[i]?.close ?? 0) - (candles[i - 1]?.close ?? 0);
    if (diff >= 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain *= k;
  avgLoss *= k;
  out[period] = rsiFromAverages(avgGain, avgLoss);
  for (let i = period + 1; i < candles.length; i++) {
    const diff = (candles[i]?.close ?? 0) - (candles[i - 1]?.close ?? 0);
    avgGain = avgGain * (1 - k) + Math.max(diff, 0) * k;
    avgLoss = avgLoss * (1 - k) + Math.max(-diff, 0) * k;
    out[i] = rsiFromAverages(avgGain, avgLoss);
  }
  return out;
}

export interface BollingerValues {
  readonly middle: IndicatorSeries;
  readonly upper: IndicatorSeries;
  readonly lower: IndicatorSeries;
}

/** Bollinger Bands around an SMA close. */
export function computeBollinger(
  candles: readonly Candle[],
  period = 20,
  multiplier = 2,
): BollingerValues {
  const middle = computeSMA(candles, period);
  const upper = seriesOf(candles.length);
  const lower = seriesOf(candles.length);
  if (period <= 0) return { middle, upper, lower };
  for (let i = period - 1; i < candles.length; i++) {
    const m = middle[i];
    if (m === undefined) continue;
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = (candles[j]?.close ?? 0) - m;
      sum += d * d;
    }
    const sd = Math.sqrt(sum / period);
    upper[i] = m + multiplier * sd;
    lower[i] = m - multiplier * sd;
  }
  return { middle, upper, lower };
}

export interface MacdValues {
  readonly macd: IndicatorSeries;
  readonly signal: IndicatorSeries;
  readonly histogram: IndicatorSeries;
}

/** MACD: fast EMA minus slow EMA, its signal line, and the histogram. */
export function computeMACD(
  candles: readonly Candle[],
  fast = 12,
  slow = 26,
  signal = 9,
): MacdValues {
  if (fast >= slow) throw new Error("computeMACD: fast must be less than slow");
  const fastEma = computeEMA(candles, fast);
  const slowEma = computeEMA(candles, slow);
  const macd = seriesOf(candles.length);
  for (let i = 0; i < candles.length; i++) {
    const f = fastEma[i];
    const s = slowEma[i];
    if (f !== undefined && s !== undefined) macd[i] = f - s;
  }
  const signalLine = emaOfValues(macd, signal);
  const histogram = seriesOf(candles.length);
  for (let i = 0; i < candles.length; i++) {
    const m = macd[i];
    const s = signalLine[i];
    if (m !== undefined && s !== undefined) histogram[i] = m - s;
  }
  return { macd, signal: signalLine, histogram };
}

/** Volume-Weighted Average Price, cumulative from the start of the series. */
export function computeVWAP(candles: readonly Candle[]): IndicatorSeries {
  const out = seriesOf(candles.length);
  let cumPv = 0;
  let cumV = 0;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (c === undefined) continue;
    const typical = (c.high + c.low + c.close) / 3;
    const volume = c.volume ?? 0;
    cumPv += typical * volume;
    cumV += volume;
    if (cumV > 0) out[i] = cumPv / cumV;
  }
  return out;
}

/** Average True Range with Wilder's smoothing. */
export function computeATR(candles: readonly Candle[], period: number): IndicatorSeries {
  const out = seriesOf(candles.length);
  if (candles.length <= period || period <= 0) return out;
  const trueRange = (i: number): number => {
    const c = candles[i];
    const prev = candles[i - 1];
    if (c === undefined || prev === undefined) return 0;
    return Math.max(
      c.high - c.low,
      Math.abs(c.high - prev.close),
      Math.abs(c.low - prev.close),
    );
  };
  let atr = 0;
  for (let i = 1; i <= period; i++) atr += trueRange(i);
  atr /= period;
  out[period] = atr;
  for (let i = period + 1; i < candles.length; i++) {
    atr = (atr * (period - 1) + trueRange(i)) / period;
    out[i] = atr;
  }
  return out;
}

export interface IchimokuOptions {
  readonly conversionPeriods?: number;
  readonly basePeriods?: number;
  readonly spanBPeriods?: number;
  readonly displacement?: number;
}

export interface IchimokuValues {
  readonly tenkan: IndicatorSeries;
  readonly kijun: IndicatorSeries;
  readonly senkouA: IndicatorSeries;
  readonly senkouB: IndicatorSeries;
  readonly chikou: IndicatorSeries;
}

/**
 * Ichimoku Cloud. Tenkan/Kijun/senkou values are aligned to their source
 * candle index; the drawing layer applies the displacement offset (senkou
 * spans shift +displacement ahead, chikou -displacement behind).
 */
export function computeIchimoku(
  candles: readonly Candle[],
  options?: IchimokuOptions,
): IchimokuValues {
  const conversion = options?.conversionPeriods ?? 9;
  const base = options?.basePeriods ?? 26;
  const spanB = options?.spanBPeriods ?? 52;

  const midpoint = (period: number, end: number): number | undefined => {
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = end - period + 1; j <= end; j++) {
      const c = candles[j];
      if (c === undefined) continue;
      if (c.high > hi) hi = c.high;
      if (c.low < lo) lo = c.low;
    }
    if (hi === -Infinity || lo === Infinity) return undefined;
    return (hi + lo) / 2;
  };

  const tenkan = seriesOf(candles.length);
  const kijun = seriesOf(candles.length);
  const senkouA = seriesOf(candles.length);
  const senkouB = seriesOf(candles.length);
  const chikou = seriesOf(candles.length);

  for (let i = 0; i < candles.length; i++) {
    if (i >= conversion - 1) tenkan[i] = midpoint(conversion, i);
    if (i >= base - 1) kijun[i] = midpoint(base, i);
    if (i >= spanB - 1) senkouB[i] = midpoint(spanB, i);
    const t = tenkan[i];
    const k = kijun[i];
    if (t !== undefined && k !== undefined) senkouA[i] = (t + k) / 2;
    chikou[i] = candles[i]?.close;
  }

  return { tenkan, kijun, senkouA, senkouB, chikou };
}
