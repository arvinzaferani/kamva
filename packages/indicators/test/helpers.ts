import type { Candle } from "@kamvachart/chart-core";

/** Candles whose OHLC all equal the given close. */
export function closes(values: readonly number[]): Candle[] {
  return values.map((close, i) => ({
    time: i * 1000,
    open: close,
    high: close,
    low: close,
    close,
  }));
}

export function candle(
  time: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume?: number,
): Candle {
  return { time, open, high, low, close, volume };
}
