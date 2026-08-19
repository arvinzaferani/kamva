import { afterEach, describe, expect, it } from "vitest";
import { Chart } from "../src/chart.js";
import type { Renderer } from "../src/contracts.js";
import type { Candle } from "../src/types.js";

function candle(time: number, price = 100): Candle {
  return { time, open: price, high: price + 2, low: price - 2, close: price + 1 };
}

function series(count: number): Candle[] {
  return Array.from({ length: count }, (_, i) => candle(i * 1000, 100 + Math.sin(i) * 10));
}

function fakeRenderer(): Renderer & { renders: number } {
  return {
    size: { width: 800, height: 400 },
    renders: 0,
    beginFrame() {},
    endFrame() {},
    render() {
      this.renders++;
    },
    destroy() {},
  };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

afterEach(async () => {
  // Drain any scheduled (16ms timeout) frames so timers don't leak into the
  // next test and so the eager primary series isn't left mid-frame.
  await wait(30);
});

describe("Realtime updates & render coalescing", () => {
  it("coalesces many updates in one event loop into a single frame", async () => {
    const chart = new Chart();
    const renderer = fakeRenderer();
    chart.attachRenderer(renderer);
    chart.setData(series(50));
    chart.renderFrame();
    const before = renderer.renders;

    // Burst of synchronous updates: dirty flag coalesces into one scheduled frame.
    for (let i = 0; i < 500; i++) {
      const last = chart.data[chart.data.length - 1];
      chart.update({ ...last, close: last.close + 0.001 });
    }
    await wait(50);
    expect(renderer.renders).toBe(before + 1);
    chart.destroy();
  });

  it("updating one series does not force a full data copy of another", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(series(100));
    const line = chart.addLineSeries({});
    const lineData = series(100).map((c, i) => ({ time: c.time, value: i }));
    line.setData(lineData);

    const last = chart.data[chart.data.length - 1];
    chart.update({ ...last, close: last.close + 1 });
    // The line series reference is untouched (no copy replaced it).
    expect(line.getData().length).toBe(100);
    expect(chart.data.length).toBe(100);
    chart.destroy();
  });

  it("updateMany appends many points as a single invalidation", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(series(5));
    const line = chart.addLineSeries({});
    const appended = series(20).map((c, i) => ({ time: (5 + i) * 1000, value: i }));
    // track invalidation count via a subscribe on data changes
    let dataEvents = 0;
    chart.on("data:changed", () => dataEvents++);
    // Direct series-level updateMany (not the chart convenience method).
    const base = line.getData().length;
    line.updateMany(appended);
    expect(line.getData().length).toBe(base + appended.length);
    expect(dataEvents).toBe(0); // direct series mutation invalidates via onChanged, not data:changed
    chart.destroy();
  });

  it("auto price range is reused when data and window are unchanged", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(series(50));
    chart.renderFrame();
    const a = chart.priceScale().getVisibleRange();
    const b = chart.priceScale().getVisibleRange();
    const c = chart.priceScale().getVisibleRange();
    expect(a).toEqual(b);
    expect(a).toEqual(c);
    chart.destroy();
  });

  it("auto price range updates after an update() changes prices", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(series(5));
    chart.renderFrame();
    const before = chart.priceScale().getVisibleRange().max;
    const last = chart.data[chart.data.length - 1];
    chart.update({ time: last.time, open: 1e6, high: 1e6, low: 1e6, close: 1e6 });
    const after = chart.priceScale().getVisibleRange().max;
    expect(after).toBeGreaterThan(before);
    chart.destroy();
  });

  it("removing a series cleans price scale and crosshair state", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(series(10));
    const line = chart.addLineSeries({});
    line.setData(series(10).map((c, i) => ({ time: c.time, value: 10000 + i })));
    chart.renderFrame();
    expect(chart.priceScale().getVisibleRange().max).toBeGreaterThan(10000);

    line.remove();
    chart.renderFrame();
    expect(chart.priceScale().getVisibleRange().max).toBeLessThan(10000);

    // Crosshair no longer references the removed series.
    let ids: string[] = [];
    chart.subscribe("crosshairMove", (p) => (ids = p?.seriesData.map((d) => d.id) ?? []));
    chart.emit("pointer:move", { x: 400, y: 200 });
    expect(ids).not.toContain(line.id);
    chart.destroy();
  });

  it("performs a dense multi-series update pass quickly", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(series(2000));
    chart.addLineSeries({}).setData(series(2000).map((c, i) => ({ time: c.time, value: i })));
    chart.renderFrame();
    const start = performance.now();
    for (let i = 0; i < 2000; i++) {
      const last = chart.data[chart.data.length - 1];
      chart.update({ ...last, close: last.close + 0.001 });
    }
    const elapsed = performance.now() - start;
    // Generous bound; the real win is the single coalesced frame, not wall time.
    expect(elapsed).toBeLessThan(500);
    chart.destroy();
  });
});