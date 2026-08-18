import type { Candle, PriceRange } from "./types.js";

/**
 * Owns the candle series.
 *
 * Invariant: candles are sorted by strictly increasing `time`.
 * Lookups use binary search; append/update of the last candle are O(1),
 * so real-time streams never pay for a re-sort.
 */
export class DataStore {
  private candles: Candle[] = [];

  get size(): number {
    return this.candles.length;
  }

  /** Read-only view of the series. Do not mutate. */
  get all(): readonly Candle[] {
    return this.candles;
  }

  at(index: number): Candle | undefined {
    return this.candles[index];
  }

  get first(): Candle | undefined {
    return this.candles[0];
  }

  get last(): Candle | undefined {
    return this.candles[this.candles.length - 1];
  }

  /** Replace the entire series. Input is copied and validated as sorted. */
  setData(candles: readonly Candle[]): void {
    for (let i = 1; i < candles.length; i++) {
      const prev = candles[i - 1];
      const curr = candles[i];
      if (prev !== undefined && curr !== undefined && curr.time <= prev.time) {
        throw new Error(
          `Candles must be sorted by strictly increasing time (index ${i}: ${curr.time} <= ${prev.time})`,
        );
      }
    }
    this.candles = [...candles];
  }

  /**
   * Append a candle newer than the current last one.
   * Throws if `candle.time` is not strictly greater than the last time.
   */
  append(candle: Candle): void {
    const last = this.last;
    if (last !== undefined && candle.time <= last.time) {
      throw new Error(
        `append() requires time > last candle time (${candle.time} <= ${last.time}); use update() for the last candle`,
      );
    }
    this.candles.push(candle);
  }

  /**
   * Replace the last candle (typical for real-time tick updates).
   * Throws on an empty series or a time mismatch with the last candle.
   */
  update(candle: Candle): void {
    const lastIndex = this.candles.length - 1;
    const last = this.candles[lastIndex];
    if (last === undefined) {
      throw new Error("update() called on an empty series");
    }
    if (candle.time !== last.time) {
      throw new Error(
        `update() requires time to match the last candle (${candle.time} !== ${last.time}); use append() for new candles`,
      );
    }
    this.candles[lastIndex] = candle;
  }

  /**
   * Index of the last candle with `time <= t`, or -1 if all candles are newer.
   * Binary search: O(log n).
   */
  indexAtTime(t: number): number {
    let lo = 0;
    let hi = this.candles.length - 1;
    let result = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const candle = this.candles[mid];
      if (candle !== undefined && candle.time <= t) {
        result = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return result;
  }

  /**
   * Min/max price over candle indices [from, to] (clamped, inclusive).
   * Returns undefined when the range does not intersect the series.
   */
  priceRange(from: number, to: number): PriceRange | undefined {
    const lo = Math.max(0, Math.floor(from));
    const hi = Math.min(this.candles.length - 1, Math.ceil(to));
    if (lo > hi) return undefined;
    let min = Infinity;
    let max = -Infinity;
    for (let i = lo; i <= hi; i++) {
      const c = this.candles[i];
      if (c === undefined) continue;
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
    }
    if (min === Infinity) return undefined;
    return { min, max };
  }

  clear(): void {
    this.candles = [];
  }
}
