import { describe, expect, it } from "vitest";
import { padPriceRange, Viewport } from "../src/viewport.js";

const size = { width: 800, height: 400 };

describe("Viewport", () => {
  const vp = new Viewport(size, { from: 0, to: 100 }, { min: 50, max: 150 });

  it("maps index to x linearly", () => {
    expect(vp.xForIndex(0)).toBe(0);
    expect(vp.xForIndex(50)).toBe(400);
    expect(vp.xForIndex(100)).toBe(800);
  });

  it("maps price to y with inverted axis", () => {
    expect(vp.yForPrice(150)).toBe(0);
    expect(vp.yForPrice(100)).toBe(200);
    expect(vp.yForPrice(50)).toBe(400);
  });

  it("round-trips both axes", () => {
    expect(vp.indexForX(vp.xForIndex(33))).toBeCloseTo(33);
    expect(vp.priceForY(vp.yForPrice(123.45))).toBeCloseTo(123.45);
  });

  it("reports candle width", () => {
    expect(vp.candleWidth).toBe(8);
  });

  it("handles degenerate price range without dividing by zero", () => {
    const flat = new Viewport(size, { from: 0, to: 10 }, { min: 100, max: 100 });
    expect(flat.yForPrice(100)).toBe(200);
  });
});

describe("padPriceRange", () => {
  it("pads symmetrically", () => {
    expect(padPriceRange({ min: 100, max: 200 }, 0.1)).toEqual({ min: 90, max: 210 });
  });

  it("produces a non-empty range for flat prices", () => {
    const padded = padPriceRange({ min: 100, max: 100 }, 0.05);
    expect(padded.max).toBeGreaterThan(padded.min);
  });
});
