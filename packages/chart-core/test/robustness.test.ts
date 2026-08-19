import { describe, expect, it } from "vitest";
import { Chart } from "../src/chart.js";
import type { Renderer } from "../src/contracts.js";
import type { Candle, LineSeriesPoint } from "../src/types.js";

function candle(time: number, price = 100): Candle {
  return { time, open: price, high: price + 2, low: price - 2, close: price + 1 };
}

function series(count: number): Candle[] {
  return Array.from({ length: count }, (_, i) => candle(i * 1000, 100 + Math.sin(i) * 10));
}

function fakeRenderer(): Renderer {
  return {
    size: { width: 800, height: 400 },
    beginFrame() {},
    endFrame() {},
    render() {},
    destroy() {},
  };
}

describe("Core robustness (v0.1 hardening)", () => {
  it("empty chart tolerates navigation and scale reads", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    expect(() => {
      chart.zoom(2);
      chart.pan(5);
      chart.fit();
      chart.priceScale().getVisibleRange();
      chart.timeScale().getVisibleRange();
    }).not.toThrow();
    expect(chart.priceScale().getVisibleRange()).toEqual({ min: 0, max: 0 });
    chart.destroy();
  });

  it("empty series reject update and accept setData([])", () => {
    const chart = new Chart();
    const candles = chart.addCandlestickSeries();
    candles.setData([]);
    expect(candles.getData()).toHaveLength(0);
    expect(() => candles.update(candle(0))).toThrow(/empty/);
    chart.destroy();
  });

  it("one data point renders and scales", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData([candle(0, 42)]);
    chart.renderFrame();
    const { min, max } = chart.priceScale().getVisibleRange();
    expect(min).toBeLessThan(42);
    expect(max).toBeGreaterThan(42);
    chart.destroy();
  });

  it("duplicate timestamps are rejected in setData/append/updateMany", () => {
    const chart = new Chart();
    const candles = chart.addCandlestickSeries();
    expect(() => candles.setData([candle(0), candle(0)])).toThrow(/strictly increasing/);
    candles.setData([candle(0)]);
    expect(() => candles.append(candle(0))).toThrow(/strictly increasing|time > last/);
    expect(() => candles.updateMany([candle(1), candle(1)])).toThrow(/strictly increasing/);
    chart.destroy();
  });

  it("unsorted data is rejected", () => {
    const chart = new Chart();
    const candles = chart.addCandlestickSeries();
    expect(() => candles.setData([candle(2000), candle(1000)])).toThrow(/strictly increasing/);
    chart.destroy();
  });

  it("invalid numeric values are rejected", () => {
    const chart = new Chart();
    const candles = chart.addCandlestickSeries();
    expect(() => candles.setData([{ time: Number.NaN, open: 1, high: 2, low: 0, close: 1 }])).toThrow(/finite/);
    expect(() =>
      candles.setData([{ time: 0, open: Number.NaN, high: 2, low: 0, close: 1 }]),
    ).toThrow(/finite/);
    const line = chart.addLineSeries();
    expect(() => line.setData([{ time: 0, value: Number.POSITIVE_INFINITY }])).toThrow(/finite/);
    chart.destroy();
  });

  it("negative values scale and render", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(series(5).map((c, i) => candle(i * 1000, -50 + i * 10)));
    chart.renderFrame();
    expect(chart.priceScale().getVisibleRange().min).toBeLessThan(-50);
    chart.destroy();
  });

  it("removing the primary (last) series leaves the chart usable", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(series(10));
    chart.renderFrame();
    // "candles-1" is the eager primary series.
    chart.removeSeries("candles-1");
    expect(() => {
      chart.zoom(1.5);
      chart.pan(1);
      chart.fit();
      chart.renderFrame(); // bails on empty data, must not throw
    }).not.toThrow();
    chart.destroy();
  });

  it("removing a hidden series is a no-op-safe cleanup", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(series(5));
    const line = chart.addLineSeries({});
    line.setData([{ time: 0, value: 1 }, { time: 4000, value: 2 }]);
    line.setVisible(false);
    line.remove();
    // Double removal is idempotent.
    line.remove();
    chart.renderFrame();
    expect(chart.priceScale().getVisibleRange().max).toBeLessThan(500);
    chart.destroy();
  });

  it("updating a removed series throws", () => {
    const chart = new Chart();
    const line = chart.addLineSeries();
    line.setData([{ time: 0, value: 1 }]);
    line.remove();
    expect(() => line.update({ time: 0, value: 2 })).toThrow(/removed/);
    chart.destroy();
  });

  it("multiple series with different time ranges share one axis", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(series(10)); // 0 .. 9000
    const line = chart.addLineSeries({});
    line.setData([{ time: 1000, value: 5 }, { time: 7000, value: 9 }]);
    chart.renderFrame();
    const { from, to } = chart.timeScale().getVisibleRange();
    expect(from).toBe(0);
    expect(to).toBe(9000);
    chart.destroy();
  });

  it("repeated subscribe/unsubscribe is safe and idempotent", () => {
    const chart = new Chart();
    let count = 0;
    const off = chart.subscribe("click", () => count++);
    off();
    off(); // double unsubscribe must not throw
    chart.emitClick(100, 100);
    expect(count).toBe(0);
    const off2 = chart.subscribe("crosshairMove", () => count++);
    const off3 = chart.subscribe("crosshairMove", () => count++);
    off2();
    off3();
    chart.emit("pointer:move", { x: 50, y: 50 });
    expect(count).toBe(0);
    chart.destroy();
  });

  it("destroy cleans up and is idempotent", () => {
    const chart = new Chart();
    let destroyed = 0;
    chart.on("destroy", () => destroyed++);
    chart.attachRenderer(fakeRenderer());
    chart.setData(series(10));
    chart.destroy();
    chart.destroy(); // idempotent
    expect(destroyed).toBe(1);
    expect(() => chart.setData(series(1))).toThrow(/destroyed/);
  });

  it("removeSeries unknown id is a safe no-op", () => {
    const chart = new Chart();
    expect(() => chart.removeSeries("nope")).not.toThrow();
    chart.destroy();
  });
});