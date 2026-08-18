import { describe, expect, it } from "vitest";
import { computeRSI } from "../src/math.js";
import { closes } from "./helpers.js";

describe("computeRSI", () => {
  it("returns 100 for a strictly rising series", () => {
    const out = computeRSI(closes([1, 2, 3, 4, 5, 6, 7]), 3);
    expect(out[0]).toBeUndefined();
    expect(out[1]).toBeUndefined();
    expect(out[2]).toBeUndefined();
    expect(out[3]).toBe(100);
    expect(out[6]).toBe(100);
  });

  it("returns 0 for a strictly falling series", () => {
    const out = computeRSI(closes([7, 6, 5, 4, 3, 2, 1]), 3);
    expect(out[3]).toBe(0);
    expect(out[6]).toBe(0);
  });

  it("applies Wilder smoothing on a mixed series", () => {
    // diffs: +1, +1, -1, -1, +1, +1
    const out = computeRSI(closes([1, 2, 3, 2, 1, 2, 3]), 3);
    expect(out[3]).toBeCloseTo(66.6667, 3);
    expect(out[4]).toBeCloseTo(44.4444, 3);
    expect(out[5]).toBeCloseTo(62.963, 3);
    expect(out[6]).toBeCloseTo(75.3086, 3);
  });
});
