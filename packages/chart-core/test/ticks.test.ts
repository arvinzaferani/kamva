import { describe, expect, it } from "vitest";
import { priceTicks, timeTickIndices } from "../src/ticks.js";

describe("priceTicks", () => {
  it("produces round-number ticks covering the range", () => {
    const ticks = priceTicks(0, 100, 5);
    expect(ticks).toEqual([0, 20, 40, 60, 80, 100]);
  });

  it("stays within the requested range", () => {
    const ticks = priceTicks(97.3, 158.9, 8);
    expect(ticks.length).toBeGreaterThan(2);
    for (const t of ticks) {
      expect(t).toBeGreaterThanOrEqual(97.3);
      expect(t).toBeLessThanOrEqual(158.9 + 1e-9);
    }
  });

  it("returns empty for degenerate input", () => {
    expect(priceTicks(5, 5)).toEqual([]);
    expect(priceTicks(10, 5)).toEqual([]);
  });
});

describe("timeTickIndices", () => {
  it("returns integer indices within range", () => {
    const ticks = timeTickIndices(0, 100, 10);
    expect(ticks.length).toBeLessThanOrEqual(11);
    for (const t of ticks) {
      expect(Number.isInteger(t)).toBe(true);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(100);
    }
  });

  it("never returns negative indices for a partially visible left edge", () => {
    const ticks = timeTickIndices(-10, 50, 10);
    expect(ticks.every((t) => t >= 0)).toBe(true);
  });
});
