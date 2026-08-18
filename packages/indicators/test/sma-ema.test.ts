import { describe, expect, it } from "vitest";
import { computeEMA, computeSMA } from "../src/math.js";
import { closes } from "./helpers.js";

describe("computeSMA", () => {
  it("returns undefined before the period and the average afterwards", () => {
    const out = computeSMA(closes([1, 2, 3, 4, 5]), 3);
    expect(out[0]).toBeUndefined();
    expect(out[1]).toBeUndefined();
    expect(out[2]).toBeCloseTo(2);
    expect(out[3]).toBeCloseTo(3);
    expect(out[4]).toBeCloseTo(4);
  });

  it("handles an empty series", () => {
    expect(computeSMA([], 5)).toHaveLength(0);
  });
});

describe("computeEMA", () => {
  it("seeds with the SMA and smooths with 2/(n+1)", () => {
    const out = computeEMA(closes([1, 2, 3, 4, 5]), 3);
    expect(out[0]).toBeUndefined();
    expect(out[1]).toBeUndefined();
    expect(out[2]).toBeCloseTo(2);
    expect(out[3]).toBeCloseTo(3);
    expect(out[4]).toBeCloseTo(4);
  });

  it("tracks a rising series, lagging the latest close", () => {
    // A jump at the end is smoothed out: the EMA lags well below the last close.
    const out = computeEMA(closes([1, 2, 3, 4, 5, 6, 7, 8, 9, 100]), 5);
    expect(out[9]).toBeGreaterThan(9);
    expect(out[9]).toBeLessThan(100);
  });
});
