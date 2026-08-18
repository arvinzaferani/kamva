import { describe, expect, it } from "vitest";
import { computeIchimoku } from "../src/math.js";
import { closes } from "./helpers.js";

describe("computeIchimoku", () => {
  const values = computeIchimoku(
    closes([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    { conversionPeriods: 2, basePeriods: 3, spanBPeriods: 4 },
  );

  it("computes tenkan as the 2-period midpoint", () => {
    expect(values.tenkan[0]).toBeUndefined();
    expect(values.tenkan[1]).toBeCloseTo(1.5, 6);
    expect(values.tenkan[2]).toBeCloseTo(2.5, 6);
  });

  it("computes kijun as the 3-period midpoint", () => {
    expect(values.kijun[1]).toBeUndefined();
    expect(values.kijun[2]).toBeCloseTo(2, 6);
    expect(values.kijun[3]).toBeCloseTo(3, 6);
  });

  it("computes senkouA from tenkan and kijun", () => {
    expect(values.senkouA[2]).toBeCloseTo((2.5 + 2) / 2, 6);
    expect(values.senkouA[3]).toBeCloseTo((3.5 + 3) / 2, 6);
  });

  it("computes senkouB from the span-B midpoint", () => {
    expect(values.senkouB[2]).toBeUndefined();
    expect(values.senkouB[3]).toBeCloseTo(2.5, 6);
  });

  it("keeps chikou aligned to its source candle", () => {
    expect(values.chikou[0]).toBeCloseTo(1, 6);
    expect(values.chikou[9]).toBeCloseTo(10, 6);
  });
});
