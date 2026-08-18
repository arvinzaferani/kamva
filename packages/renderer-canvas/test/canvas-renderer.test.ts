import { Viewport } from "@kamvachart/chart-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasRenderer } from "../src/canvas-renderer.js";

type RecordedCtx = CanvasRenderingContext2D & {
  transforms: number[][];
};

function fakeContext(): RecordedCtx {
  const transforms: number[][] = [];
  return {
    transforms,
    save() {},
    restore() {},
    setTransform(a: number, b: number, c: number, d: number, e: number, f: number) {
      transforms.push([a, b, c, d, e, f]);
    },
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    fill() {},
    setLineDash() {},
    fillRect() {},
    fillText() {},
    measureText: () => ({ width: 10 }) as TextMetrics,
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "",
    textBaseline: "",
  } as RecordedCtx;
}

function fakeCanvas(ctx: RecordedCtx): HTMLCanvasElement {
  return {
    width: 0,
    height: 0,
    getContext: () => ctx,
    getBoundingClientRect: () =>
      ({ width: 800, height: 400, top: 0, left: 0, right: 800, bottom: 400, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect,
  } as HTMLCanvasElement;
}

describe("CanvasRenderer", () => {
  let ctx: RecordedCtx;

  beforeEach(() => {
    vi.stubGlobal("devicePixelRatio", 2);
    ctx = fakeContext();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a plugin context already mapped to CSS pixels (× DPR)", () => {
    const renderer = new CanvasRenderer(fakeCanvas(ctx));
    renderer.getPluginContext();
    expect(ctx.transforms.at(-1)).toEqual([2, 0, 0, 2, 0, 0]);
    renderer.destroy();
  });

  it("renders the base frame with the same CSS->device transform", () => {
    const renderer = new CanvasRenderer(fakeCanvas(ctx));
    const viewport = new Viewport({ width: 800, height: 400 }, { from: 0, to: 9 }, { min: 0, max: 100 });
    renderer.render(viewport, []);
    expect(ctx.transforms).toContainEqual([2, 0, 0, 2, 0, 0]);
    renderer.destroy();
  });
});
