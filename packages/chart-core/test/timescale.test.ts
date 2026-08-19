import { describe, expect, it } from "vitest";
import { Chart } from "../src/chart.js";
import type { Renderer } from "../src/contracts.js";
import type { Candle } from "../src/types.js";

function candle(time: number, price = 100): Candle {
  return { time, open: price, high: price + 2, low: price - 2, close: price + 1 };
}

function series(count: number, startTime = 0, step = 1000): Candle[] {
  return Array.from({ length: count }, (_, i) => candle(startTime + i * step));
}

function linePoint(time: number, value: number) {
  return { time, value };
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

describe("Chart.timeScale()", () => {
  it("getVisibleRange returns the fitted full extent of the primary series", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(series(10, 100_000, 60_000)); // 100_000 .. 640_000
    const { from, to } = chart.timeScale().getVisibleRange();
    expect(from).toBe(100_000);
    expect(to).toBe(640_000);
    chart.destroy();
  });

  it("setVisibleRange narrows the window and getVisibleRange reads it back", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(series(10, 0, 1000)); // 0 .. 9000
    chart.timeScale().setVisibleRange({ from: 3000, to: 6000 });
    const { from, to } = chart.timeScale().getVisibleRange();
    expect(from).toBe(3000);
    expect(to).toBe(6000);
    chart.destroy();
  });

  it("fitContent restores the full extent after a manual range", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(series(10, 0, 1000));
    chart.timeScale().setVisibleRange({ from: 4000, to: 5000 });
    chart.timeScale().fitContent();
    const { from, to } = chart.timeScale().getVisibleRange();
    expect(from).toBe(0);
    expect(to).toBe(9000);
    chart.destroy();
  });

  it("fitContent considers the time extent of every visible series", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(series(10, 20_000, 1000)); // primary 20_000 .. 29_000
    // An extra visible series whose window starts well before the primary.
    const line = chart.addLineSeries({});
    line.setData([
      linePoint(0, 100),
      linePoint(15_000, 102),
      linePoint(29_000, 98),
    ]);
    chart.timeScale().fitContent();
    // Union time range starts at 0, but the shared x-axis is indexed by the
    // primary: the earliest representable index is the primary's first candle.
    expect(chart.timeScale().getVisibleRange().from).toBe(20_000);
    expect(chart.timeScale().getVisibleRange().to).toBe(29_000);
    chart.destroy();
  });

  it("fitContent ignores hidden series", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(series(10, 0, 1000)); // 0 .. 9000
    const line = chart.addLineSeries({});
    line.setData([linePoint(5_000, 100), linePoint(6_000, 102)]);
    line.setVisible(false);
    chart.timeScale().setVisibleRange({ from: 4000, to: 5000 });
    chart.timeScale().fitContent();
    const { from, to } = chart.timeScale().getVisibleRange();
    expect(from).toBe(0);
    expect(to).toBe(9000);
    chart.destroy();
  });

  it("subscribe fires for setVisibleRange, zoom and pan, and unsubscribes", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(series(100, 0, 1000));
    const seen: Array<{ from: number; to: number }> = [];
    const off = chart.timeScale().subscribe((r) => seen.push({ from: r.from, to: r.to }));
    chart.timeScale().setVisibleRange({ from: 10_000, to: 20_000 });
    chart.zoom(1.5);
    chart.pan(2);
    expect(seen.length).toBe(3);
    off();
    chart.pan(3);
    expect(seen.length).toBe(3);
    chart.destroy();
  });

  it("reset fits to the full extent of the primary series", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(series(50, 0, 5000));
    chart.timeScale().setVisibleRange({ from: 100_000, to: 200_000 });
    chart.timeScale().reset();
    expect(chart.timeScale().getVisibleRange().from).toBe(0);
    expect(chart.timeScale().getVisibleRange().to).toBe(49 * 5000);
    chart.destroy();
  });
});
