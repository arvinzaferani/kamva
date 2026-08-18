import type { PluginDrawContext, Renderer } from "@kamvachart/chart-core";
import { Chart } from "@kamvachart/chart-core";
import { describe, expect, it } from "vitest";
import { bollingerBands, ichimoku, macd, rsi, sma } from "../src/index.js";
import { closes } from "./helpers.js";

interface FakeCtx extends PluginDrawContext {
  readonly calls: string[];
  readonly points: Array<{ x: number; y: number }>;
}

function fakeCtx(): FakeCtx {
  const calls: string[] = [];
  const points: Array<{ x: number; y: number }> = [];
  return {
    calls,
    points,
    save() {
      calls.push("save");
    },
    restore() {
      calls.push("restore");
    },
    beginPath() {
      calls.push("beginPath");
    },
    closePath() {
      calls.push("closePath");
    },
    moveTo(x: number, y: number) {
      calls.push("moveTo");
      points.push({ x, y });
    },
    lineTo(x: number, y: number) {
      calls.push("lineTo");
      points.push({ x, y });
    },
    stroke() {
      calls.push("stroke");
    },
    fill() {
      calls.push("fill");
    },
    setLineDash() {},
    fillRect() {
      calls.push("fillRect");
    },
    fillText() {},
    measureText: () => ({ width: 10 }),
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
  };
}

function makeChart(ctx: FakeCtx): { chart: Chart; renderer: Renderer & { frames: number } } {
  const renderer: Renderer & { frames: number } = {
    size: { width: 800, height: 400 },
    frames: 0,
    render() {
      this.frames++;
    },
    drawOverlay() {},
    getPluginContext: () => ctx,
    destroy() {},
  };
  const chart = new Chart();
  chart.attachRenderer(renderer);
  return { chart, renderer };
}

describe("indicator plugins", () => {
  it("draws a SMA polyline after setData + renderFrame", () => {
    const ctx = fakeCtx();
    const { chart } = makeChart(ctx);
    chart.use(sma({ period: 3 }));
    chart.setData(closes([1, 2, 3, 4, 5, 6]));
    chart.renderFrame();
    expect(ctx.calls).toContain("moveTo");
    expect(ctx.calls).toContain("lineTo");
    expect(ctx.calls).toContain("stroke");
    // Values exist for indices 2..5 → 4 moveTo points (segments joined by lineTo).
    expect(ctx.points.length).toBeGreaterThanOrEqual(4);
    chart.destroy();
  });

  it("recomputes and redraws when data is appended", () => {
    const ctx = fakeCtx();
    const { chart } = makeChart(ctx);
    chart.use(sma({ period: 3 }));
    chart.setData(closes([1, 2, 3, 4, 5]));
    chart.renderFrame();
    const before = ctx.points.length;
    chart.append({ time: 6000, open: 6, high: 6, low: 6, close: 6 });
    chart.renderFrame();
    expect(ctx.points.length).toBeGreaterThan(before);
    chart.destroy();
  });

  it("draws the MACD histogram as bars", () => {
    const ctx = fakeCtx();
    const { chart } = makeChart(ctx);
    chart.use(macd({ fast: 3, slow: 6, signal: 2 }));
    chart.setData(closes([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
    chart.renderFrame();
    expect(ctx.calls).toContain("fillRect");
    chart.destroy();
  });

  it("maps oscillators into their bottom band instead of the price scale", () => {
    const ctx = fakeCtx();
    const { chart } = makeChart(ctx);
    chart.use(rsi({ period: 3 }));
    chart.setData(closes(Array.from({ length: 50 }, (_, i) => i + 1)));
    chart.renderFrame();
    expect(ctx.points.length).toBeGreaterThan(0);
    for (const p of ctx.points) {
      expect(p.y).toBeGreaterThanOrEqual(299.5);
      expect(p.y).toBeLessThanOrEqual(400.5);
    }
    chart.destroy();
  });

  it("fills the Ichimoku cloud between the leading spans", () => {
    const ctx = fakeCtx();
    const { chart } = makeChart(ctx);
    chart.use(ichimoku({ conversionPeriods: 3, basePeriods: 5, spanBPeriods: 7, displacement: 3 }));
    chart.setData(closes(Array.from({ length: 40 }, (_, i) => i + 1)));
    chart.renderFrame();
    expect(ctx.calls).toContain("fill");
    expect(ctx.calls).toContain("closePath");
    chart.destroy();
  });

  it("supports multiple indicators with distinct names", () => {
    const { chart } = makeChart(fakeCtx());
    chart.use(sma({ period: 10 }));
    chart.use(sma({ period: 20 }));
    chart.use(bollingerBands({ period: 20 }));
    expect(() => chart.use(sma({ period: 10 }))).toThrow(/already registered/);
    chart.destroy();
  });

  it("validates options at construction", () => {
    expect(() => sma({ period: 0 })).toThrow(/period must be a positive integer/);
    expect(() => sma({ period: 1.5 })).toThrow(/period must be a positive integer/);
    expect(() => macd({ fast: 10, slow: 5 })).toThrow(/fast must be less than slow/);
    expect(() => bollingerBands({ multiplier: -1 })).toThrow(/multiplier/);
  });
});
