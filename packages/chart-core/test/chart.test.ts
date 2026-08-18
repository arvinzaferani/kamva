import { describe, expect, it } from "vitest";
import { Chart } from "../src/chart.js";
import type { Plugin, Renderer } from "../src/contracts.js";
import type { Candle } from "../src/types.js";

function candle(time: number, price = 100): Candle {
  return { time, open: price, high: price + 2, low: price - 2, close: price + 1 };
}

function series(count: number): Candle[] {
  return Array.from({ length: count }, (_, i) => candle(i * 1000, 100 + Math.sin(i) * 10));
}

function fakeRenderer(): Renderer & { frames: number } {
  return {
    size: { width: 800, height: 400 },
    frames: 0,
    beginFrame() {},
    endFrame() {},
    render() {
      this.frames++;
    },
    destroy() {},
  };
}

describe("Chart", () => {
  it("renders a frame after setData", () => {
    const chart = new Chart();
    const renderer = fakeRenderer();
    chart.attachRenderer(renderer);
    chart.setData(series(50));
    chart.renderFrame();
    expect(renderer.frames).toBe(1);
    expect(chart.viewport).toBeDefined();
    chart.destroy();
  });

  it("emits data and camera events", () => {
    const chart = new Chart();
    const events: string[] = [];
    chart.on("data:changed", () => events.push("data"));
    chart.on("camera:changed", () => events.push("camera"));
    chart.setData(series(10));
    chart.zoom(2);
    chart.pan(1);
    chart.fit();
    expect(events).toEqual(["data", "camera", "camera", "camera"]);
    chart.destroy();
  });

  it("follows the live edge on append only when already there", () => {
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.setData(series(100));
    chart.renderFrame();
    const before = chart.viewport!.visibleRange;
    chart.append(candle(100_000));
    chart.renderFrame();
    const after = chart.viewport!.visibleRange;
    expect(after.to).toBeGreaterThan(before.to);
    chart.destroy();
  });

  it("runs the plugin lifecycle in order", () => {
    const calls: string[] = [];
    const plugin: Plugin = {
      name: "probe",
      initialize: () => calls.push("initialize"),
      update: () => calls.push("update"),
      draw: () => calls.push("draw"),
      destroy: () => calls.push("destroy"),
    };
    const chart = new Chart();
    chart.attachRenderer(fakeRenderer());
    chart.use(plugin);
    chart.setData(series(10));
    chart.renderFrame();
    chart.destroy();
    expect(calls).toEqual(["initialize", "update", "draw", "destroy"]);
  });

  it("rejects duplicate plugin names", () => {
    const chart = new Chart();
    const make = (): Plugin => ({ name: "dup", initialize() {} });
    chart.use(make());
    expect(() => chart.use(make())).toThrow(/already registered/);
    chart.destroy();
  });

  it("throws on use after destroy", () => {
    const chart = new Chart();
    chart.destroy();
    expect(() => chart.setData(series(1))).toThrow(/destroyed/);
    // destroy is idempotent
    chart.destroy();
  });

  it("handles 100k candles within the data path budget", () => {
    const chart = new Chart();
    const renderer = fakeRenderer();
    chart.attachRenderer(renderer);
    const start = performance.now();
    chart.setData(series(100_000));
    chart.renderFrame();
    const elapsed = performance.now() - start;
    expect(renderer.frames).toBe(1);
    // Generous CI bound; the real budget is <16ms for the render loop alone.
    expect(elapsed).toBeLessThan(500);
    chart.destroy();
  });
});
