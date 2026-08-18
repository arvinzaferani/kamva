import { describe, expect, it } from "vitest";
import { computeATR, computeBollinger, computeMACD, computeVWAP } from "../src/math.js";
import { candle, closes } from "./helpers.js";

describe("computeBollinger", () => {
  it("wraps the SMA with ±multiplier standard deviations", () => {
    const { middle, upper, lower } = computeBollinger(closes([1, 2, 3, 2]), 3, 1);
    expect(middle[2]).toBeCloseTo(2);
    expect(upper[2]).toBeCloseTo(2 + Math.sqrt(2 / 3), 6);
    expect(lower[2]).toBeCloseTo(2 - Math.sqrt(2 / 3), 6);
    expect(middle[3]).toBeCloseTo(7 / 3, 6);
    expect(upper[3]).toBeCloseTo(7 / 3 + Math.sqrt(2 / 9), 6);
    expect(lower[3]).toBeCloseTo(7 / 3 - Math.sqrt(2 / 9), 6);
  });
});

describe("computeMACD", () => {
  it("is zero on a constant series after warmup", () => {
    const { macd, signal, histogram } = computeMACD(closes([5, 5, 5, 5, 5, 5, 5, 5]), 2, 4, 2);
    expect(macd[4]).toBe(0);
    expect(macd[7]).toBe(0);
    expect(signal[7]).toBe(0);
    expect(histogram[7]).toBe(0);
  });

  it("computes a known small case", () => {
    const { macd, signal, histogram } = computeMACD(closes([1, 2, 3, 4, 5]), 2, 3, 2);
    expect(macd[2]).toBeCloseTo(0.5, 6);
    expect(macd[3]).toBeCloseTo(0.5, 6);
    expect(macd[4]).toBeCloseTo(0.5, 6);
    expect(signal[3]).toBeCloseTo(0.5, 6);
    expect(signal[4]).toBeCloseTo(0.5, 6);
    expect(histogram[3]).toBeCloseTo(0, 6);
    expect(histogram[4]).toBeCloseTo(0, 6);
  });

  it("throws when fast is not faster than slow", () => {
    expect(() => computeMACD(closes([1, 2, 3]), 5, 4)).toThrow(/fast must be less than slow/);
  });
});

describe("computeVWAP", () => {
  it("accumulates typical price × volume over the series", () => {
    const candles = [
      candle(0, 9, 10, 8, 9, 2),
      candle(1, 12, 14, 10, 12, 3),
    ];
    const out = computeVWAP(candles);
    expect(out[0]).toBeCloseTo(9, 6);
    expect(out[1]).toBeCloseTo(10.8, 6);
  });

  it("is undefined while cumulative volume is zero", () => {
    const out = computeVWAP([candle(0, 9, 10, 8, 9, 0)]);
    expect(out[0]).toBeUndefined();
  });
});

describe("computeATR", () => {
  it("uses Wilder smoothing of the true range", () => {
    const candles = [
      candle(0, 10, 12, 8, 11),
      candle(1, 11, 13, 10, 12),
      candle(2, 12, 15, 11, 14),
      candle(3, 14, 16, 12, 15),
    ];
    const out = computeATR(candles, 2);
    expect(out[0]).toBeUndefined();
    expect(out[1]).toBeUndefined();
    expect(out[2]).toBeCloseTo(3.5, 6);
    expect(out[3]).toBeCloseTo(3.75, 6);
  });
});
