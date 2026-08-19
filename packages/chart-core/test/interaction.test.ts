import { describe, expect, it } from "vitest";
import { Chart } from "../src/chart.js";
import type { Renderer } from "../src/contracts.js";
import type { Candle, LineSeriesPoint } from "../src/types.js";

const W = 800;
const H = 400;

function candle(time: number, price = 100): Candle {
  return { time, open: price, high: price + 2, low: price - 2, close: price + 1 };
}

function series(count: number): Candle[] {
  return Array.from({ length: count }, (_, i) => candle(i * 1000, 100 + Math.sin(i) * 10));
}

function lineAt(times: number[], base = 500): Array<{ time: number; value: number }> {
  return times.map((t, i) => ({ time: t, value: base + i }));
}

function fakeRenderer(): Renderer {
  return {
    size: { width: W, height: H },
    beginFrame() {},
    endFrame() {},
    render() {},
    destroy() {},
  };
}

describe("Interaction & Crosshair", () => {
  it("pointerMove subscription delivers raw pointer positions", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    const seen: Array<{ x: number; y: number }> = [];
    const off = chart.subscribe("pointerMove", (p) => seen.push({ x: p.x, y: p.y }));
    chart.emit("pointer:move", { x: 120, y: 240 });
    chart.emit("pointer:move", { x: 300, y: 80 });
    expect(seen).toEqual([
      { x: 120, y: 240 },
      { x: 300, y: 80 },
    ]);
    off();
    chart.emit("pointer:move", { x: 999, y: 999 });
    expect(seen).toHaveLength(2);
    chart.destroy();
  });

  it("click subscription delivers a domain-resolved click", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(series(10));
    chart.renderFrame();
    let clicked: { time: number; price: number; index: number } | undefined;
    chart.subscribe("click", (c) => (clicked = c));
    chart.emitClick(W / 2, H / 2);
    expect(clicked).toBeDefined();
    expect(clicked!.time).toBeTypeOf("number");
    expect(clicked!.price).toBeTypeOf("number");
    expect(clicked!.index).toBeGreaterThanOrEqual(0);
    chart.destroy();
  });

  it("doubleClick subscription delivers a resolved double click", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(series(10));
    chart.renderFrame();
    let db: { time: number } | undefined;
    chart.subscribe("doubleClick", (c) => (db = c));
    chart.emitDoubleClick(W / 2, H / 2);
    expect(db).toBeDefined();
    expect(db!.time).toBeTypeOf("number");
    chart.destroy();
  });

  it("crosshair carries time, price, and per-series values", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(series(10)); // primary candles, close = price + 1
    const line = chart.addLineSeries({});
    line.setData(series(10).map((c) => ({ time: c.time, value: 50 + c.open })));
    chart.renderFrame();

    let position: import("../src/contracts.js").CrosshairPosition | undefined;
    chart.subscribe("crosshairMove", (p) => (position = p));

    const x = chart.viewport!.xForIndex(5);
    chart.emit("pointer:move", { x, y: H / 2 });

    expect(position).toBeDefined();
    expect(position!.time).toBe(5000); // primary time at index 5
    expect(position!.price).toBeTypeOf("number");
    // Both visible series must report a value under the crosshair.
    expect(position!.seriesData).toHaveLength(2);
    const primary = position!.seriesData.find((d) => d.type === "candles");
    const ln = position!.seriesData.find((d) => d.type === "line");
    expect(primary).toBeDefined();
    expect(ln).toBeDefined();
    expect(primary!.value).toBeCloseTo(series(10)[5].close);
    expect(ln!.value).toBeCloseTo(50 + series(10)[5].open);
    chart.destroy();
  });

  it("hidden series do not participate in crosshair hit testing", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(series(10));
    const hidden = chart.addLineSeries({});
    hidden.setData(lineAt(series(10).map((c) => c.time), 9000));

    let ids: string[] = [];
    chart.subscribe("crosshairMove", (p) => (ids = p?.seriesData.map((d) => d.id) ?? []));

    chart.renderFrame();
    const x = chart.viewport!.xForIndex(3);
    chart.emit("pointer:move", { x, y: 100 });
    expect(ids).toContain(hidden.id);

    hidden.setVisible(false);
    chart.renderFrame();
    chart.emit("pointer:move", { x, y: 100 });
    expect(ids).not.toContain(hidden.id);
    chart.destroy();
  });

  it("removing a series keeps crosshair live and without stale data", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(series(10));
    const line = chart.addLineSeries({});
    line.setData(lineAt(series(10).map((c) => c.time)));
    chart.renderFrame();

    const x = chart.viewport!.xForIndex(4);
    let ids: string[] = [];
    chart.subscribe("crosshairMove", (p) => (ids = p?.seriesData.map((d) => d.id) ?? []));

    chart.emit("pointer:move", { x, y: 200 });
    expect(ids).toContain(line.id);

    line.remove();
    chart.renderFrame();
    chart.emit("pointer:move", { x, y: 200 });
    // No stale handler leaks the removed series, and moving still resolves.
    expect(ids).not.toContain(line.id);
    expect(ids).toContain("candles-1");
    chart.destroy();
  });

  it("pan and zoom emit viewportChange and affect all series consistently", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(series(10));
    chart.renderFrame();

    const changes: Array<{ from: number; to: number }> = [];
    chart.subscribe("viewportChange", (v) => changes.push({ from: v.from, to: v.to }));

    chart.zoom(2);
    chart.pan(1);
    expect(changes.length).toBeGreaterThanOrEqual(2);

    // After navigation the crosshair still resolves every visible series.
    chart.renderFrame();
    const x = chart.viewport!.xForIndex(3);
    let ids: string[] = [];
    chart.subscribe("crosshairMove", (p) => (ids = p?.seriesData.map((d) => d.id) ?? []));
    chart.emit("pointer:move", { x, y: 200 });
    expect(ids).toContain("candles-1");

    chart.fit();
    expect(changes.length).toBeGreaterThanOrEqual(3);
    chart.destroy();
  });

  it("pointer leave clears the crosshair", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(series(10));
    chart.renderFrame();
    let cleared = 0;
    chart.subscribe("crosshairMove", (p) => {
      if (p === undefined) cleared++;
    });
    chart.emit("pointer:leave", undefined);
    expect(cleared).toBe(1);
    chart.destroy();
  });
});