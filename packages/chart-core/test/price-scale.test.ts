import { describe, expect, it } from "vitest";
import { Chart } from "../src/chart.js";
import type { Renderer } from "../src/contracts.js";
import type { Candle } from "../src/types.js";

const H = 400;

/** A candle centered on `price` with a 2-unit high/low band. */
function candle(time: number, price: number): Candle {
  return { time, open: price, high: price + 2, low: price - 2, close: price + 1 };
}

function candles(prices: number[], startTime = 0, step = 1000): Candle[] {
  return prices.map((p, i) => candle(startTime + i * step, p));
}

function fakeRenderer(): Renderer {
  return {
    size: { width: 800, height: H },
    beginFrame() {},
    endFrame() {},
    render() {},
    destroy() {},
  };
}

describe("PriceScale", () => {
  it("maps value to coordinate and back under a fixed manual range", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.priceScale().setVisibleRange({ min: 0, max: 100 });
    const ps = chart.priceScale();
    expect(ps.valueToCoordinate(100)).toBe(0);
    expect(ps.valueToCoordinate(0)).toBe(400);
    expect(ps.valueToCoordinate(50)).toBe(200);
    expect(ps.coordinateToValue(0)).toBe(100);
    expect(ps.coordinateToValue(400)).toBe(0);
    expect(ps.coordinateToValue(200)).toBe(50);
    chart.destroy();
  });

  it("set/get visible range round-trips a manual override", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.priceScale().setVisibleRange({ min: 90, max: 120 });
    expect(chart.priceScale().getVisibleRange()).toEqual({ min: 90, max: 120 });
    chart.destroy();
  });

  it("panPrice shifts the range and takes manual control from auto-scale", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(candles([100, 110, 105, 120, 115])); // auto band ~98..122
    const auto = chart.priceScale().getVisibleRange();
    chart.panPrice(50);
    const shifted = chart.priceScale().getVisibleRange();
    expect(shifted.min).toBeCloseTo(auto.min + 50);
    expect(shifted.max).toBeCloseTo(auto.max + 50);
    expect(shifted).not.toEqual(auto);
    // Manual control persists: a data change no longer re-fits automatically.
    chart.update(candle(4000, 1000));
    expect(chart.priceScale().getVisibleRange()).toEqual(shifted);
    chart.destroy();
  });

  it("a manual band is fully sticky across horizontal window changes", () => {
    // A manual range must never be moved by the chart itself: after a vertical
    // pan the band stays exactly where the user left it, even as the camera
    // pans (and clamps at the data edges) underneath.
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(candles(Array.from({ length: 50 }, (_, i) => 100 + i)));
    chart.priceScale().setVisibleRange({ min: 100, max: 160 });
    chart.panPrice(30); // user drags the band up by exactly 30
    const held = chart.priceScale().getVisibleRange();
    expect(held.min).toBe(130);
    expect(held.max).toBe(190);

    // Pan all the way to the start edge (and past it, where the camera
    // clamps): the band must not be re-fitted or snapped back.
    for (let i = 0; i < 100; i++) {
      chart.pan(1);
      chart.renderFrame();
      expect(chart.priceScale().getVisibleRange()).toEqual(held);
    }
    chart.destroy();
  });

  it("a vertical pan holds at the horizontal edge", () => {
    // When the camera is clamped at the start of the data, a vertical pan
    // must still stick. Previously the auto-follow recomputed on release and
    // yanked the band back to its original spot ("میپره سر جای اول").
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(candles(Array.from({ length: 50 }, (_, i) => 100 + i)));
    chart.timeScale().setVisibleRange({ from: 0, to: 10000 }); // left edge
    chart.renderFrame();
    const before = chart.priceScale().getVisibleRange();

    chart.panPrice(-25); // drag the band down
    const held = chart.priceScale().getVisibleRange();
    expect(held.min).toBe(before.min - 25);
    expect(held.max).toBe(before.max - 25);

    // Release + redraw: nothing re-fits it back to the original spot.
    chart.renderFrame();
    expect(chart.priceScale().getVisibleRange()).toEqual(held);
    chart.destroy();
  });

  it("rejects invalid visible ranges", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    expect(() => chart.priceScale().setVisibleRange({ min: 100, max: 100 })).toThrow(/min < max/);
    expect(() => chart.priceScale().setVisibleRange({ min: 120, max: 90 })).toThrow(/min < max/);
    expect(() =>
      chart.priceScale().setVisibleRange({ min: Number.NaN, max: 90 }),
    ).toThrow(/finite/);
    chart.destroy();
  });

  it("auto-scales across all visible candles with padding", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(candles([100, 110, 105, 120, 115])); // low band 98..122
    const { min, max } = chart.priceScale().getVisibleRange();
    expect(min).toBeLessThan(98);
    expect(max).toBeGreaterThan(122);
    const y = chart.priceScale().valueToCoordinate(122);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(H);
    chart.destroy();
  });

  it("lets multiple series share one coordinate system and auto-scale", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(candles([0, 10, 5, 8])); // primary
    const line = chart.addLineSeries({});
    line.setData([{ time: 0, value: 500 }, { time: 3000, value: 600 }]);
    chart.renderFrame();
    const { min, max } = chart.priceScale().getVisibleRange();
    expect(min).toBeLessThan(0); // from primary
    expect(max).toBeGreaterThan(600); // from line
    // Both share the same pixel mapping: the line's 550 sits inside the pane.
    const y = chart.priceScale().valueToCoordinate(550);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(H);
    chart.destroy();
  });

  it("ignores hidden series during auto-scaling", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(candles([100, 105, 110]));
    const giant = chart.addLineSeries({});
    giant.setData([{ time: 0, value: 1e6 }, { time: 2000, value: 2e6 }]);
    giant.setVisible(false);
    chart.renderFrame();
    const { max } = chart.priceScale().getVisibleRange();
    expect(max).toBeLessThan(1000); // hidden series must not inflate the range
    chart.destroy();
  });

  it("recomputes auto-scale when a series is removed", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(candles([100, 105]));
    const giant = chart.addLineSeries({});
    giant.setData([{ time: 0, value: 10_000 }, { time: 1000, value: 20_000 }]);
    chart.renderFrame();
    expect(chart.priceScale().getVisibleRange().max).toBeGreaterThan(20_000);
    giant.remove();
    chart.renderFrame();
    const { max } = chart.priceScale().getVisibleRange();
    expect(max).toBeLessThan(500); // back to the primary's band
    chart.destroy();
  });

  it("recomputes auto-scale when data is updated", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(candles([100]));
    chart.update(candle(0, 1000));
    const { min, max } = chart.priceScale().getVisibleRange();
    expect(min).toBeLessThan(998);
    expect(max).toBeGreaterThan(1002);
    chart.destroy();
  });

  it("fit returns to auto-scaling after a manual range", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(candles([100, 110]));
    chart.priceScale().setVisibleRange({ min: 0, max: 1000 });
    expect(chart.priceScale().getVisibleRange()).toEqual({ min: 0, max: 1000 });
    chart.fit();
    const { min, max } = chart.priceScale().getVisibleRange();
    expect(min).toBeLessThan(98);
    expect(max).toBeGreaterThan(112);
    chart.destroy();
  });

  it("keeps a narrow manual band from jumping when data pokes out both sides", () => {
    // Data alternates between two far-apart price levels, so the visible union
    // is much taller than the 10-unit manual band — data overflows BOTH the top
    // and the bottom. A manual band is sticky, so panning must never move it
    // (which used to flip it between hug-top/hug-bottom and jump ~1000 units).
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(candles(Array.from({ length: 400 }, (_, i) => (i % 2 === 0 ? 0 : 1000))));
    chart.priceScale().setVisibleRange({ min: 495, max: 505 });
    chart.renderFrame();
    expect(chart.priceScale().getVisibleRange()).toEqual({ min: 495, max: 505 });

    let prev = chart.priceScale().getVisibleRange();
    let maxJump = 0;
    for (let step = 0; step < 400; step++) {
      chart.pan(-1);
      chart.renderFrame();
      const cur = chart.priceScale().getVisibleRange();
      maxJump = Math.max(maxJump, Math.abs(cur.min - prev.min), Math.abs(cur.max - prev.max));
      expect(cur.min).toBeLessThan(cur.max);
      prev = cur;
    }
    expect(maxJump).toBeLessThan(1); // band stays put, no flip
    chart.destroy();
  });

  describe("edge cases", () => {
    it("empty data yields NaN conversions and a zero range", () => {
      const chart = new Chart();
      chart.attachRenderer(fakeRenderer());
      expect(chart.priceScale().getVisibleRange()).toEqual({ min: 0, max: 0 });
      expect(Number.isNaN(chart.priceScale().valueToCoordinate(100))).toBe(true);
      expect(Number.isNaN(chart.priceScale().coordinateToValue(100))).toBe(true);
      chart.destroy();
    });

    it("single-value data keeps a finite, usable range", () => {
      const chart = new Chart();
      chart.attachRenderer(fakeRenderer());
      chart.setData(candles([42]));
      const { min, max } = chart.priceScale().getVisibleRange();
      expect(min).toBeLessThan(42);
      expect(max).toBeGreaterThan(42);
      const y = chart.priceScale().valueToCoordinate(42);
      expect(Number.isFinite(y)).toBe(true);
      chart.destroy();
    });

    it("identical min/max values are padded apart", () => {
      const chart = new Chart();
      chart.attachRenderer(fakeRenderer());
      chart.setData(candles([50, 50, 50]));
      const { min, max } = chart.priceScale().getVisibleRange();
      expect(max - min).toBeGreaterThan(0);
      expect(Number.isFinite(chart.priceScale().valueToCoordinate(50))).toBe(true);
      chart.destroy();
    });

    it("negative prices auto-scale correctly", () => {
      const chart = new Chart();
      chart.attachRenderer(fakeRenderer());
      chart.setData(candles([-10, -30, -50, -25]));
      const { min, max } = chart.priceScale().getVisibleRange();
      expect(min).toBeLessThan(-52);
      expect(max).toBeGreaterThan(-8);
      chart.destroy();
    });

    it("very small values auto-scale correctly", () => {
      const chart = new Chart();
      chart.attachRenderer(fakeRenderer());
      const vals = [0.000001, 0.000002, 0.0000015];
      chart.setData(
        vals.map((v, i) => ({
          time: i * 1000,
          open: v,
          high: v * 1.01,
          low: v * 0.99,
          close: v,
        })),
      );
      const { min, max } = chart.priceScale().getVisibleRange();
      expect(min).toBeGreaterThan(0);
      expect(max).toBeGreaterThan(min);
      expect(Number.isFinite(chart.priceScale().valueToCoordinate(0.0000015))).toBe(true);
      chart.destroy();
    });

    it("very large values auto-scale correctly", () => {
      const chart = new Chart();
      chart.attachRenderer(fakeRenderer());
      const vals = [1e12, 2e12, 1.5e12];
      chart.setData(
        vals.map((v, i) => ({
          time: i * 1000,
          open: v,
          high: v * 1.01,
          low: v * 0.99,
          close: v,
        })),
      );
      const { min, max } = chart.priceScale().getVisibleRange();
      expect(min).toBeLessThan(1e12);
      expect(max).toBeGreaterThan(2e12);
      expect(Number.isFinite(chart.priceScale().valueToCoordinate(1.5e12))).toBe(true);
      chart.destroy();
    });
  });
});