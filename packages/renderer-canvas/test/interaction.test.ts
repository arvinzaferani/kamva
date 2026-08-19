import { Chart } from "@kamvachart/chart-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CanvasRenderer } from "../src/canvas-renderer.js";
import { InteractionController } from "../src/interaction.js";

const W = 800;
const H = 400;

type Listeners = Map<string, (e: any) => void>;

function fakeCanvas() {
  const listeners = new Map() as Listeners;
  // A permissive 2D-context stub: every method is a no-op so renderFrame can
  // run without a real canvas; measureText returns a fixed width.
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get(_t, prop) {
      if (prop === "measureText") return () => ({ width: 10 });
      if (prop === "canvas") return null;
      return (() => {}) as unknown;
    },
    set(t, prop, value) {
      (t as Record<PropertyKey, unknown>)[prop] = value;
      return true;
    },
  }) as CanvasRenderingContext2D;
  const canvas = {
    width: 0,
    height: 0,
    style: {} as Record<string, string>,
    listeners,
    getContext: () => ctx,
    addEventListener(type: string, fn: (e: any) => void) {
      listeners.set(type, fn);
    },
    removeEventListener: () => {},
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
    getBoundingClientRect: () =>
      ({ width: W, height: H, top: 0, left: 0, right: W, bottom: H, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect,
  } as unknown as HTMLCanvasElement;
  const dispatch = (type: string, e: Record<string, unknown>) => listeners.get(type)?.(e as any);
  return { canvas, dispatch };
}

function series(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    time: i * 1000,
    open: 100,
    high: 102,
    low: 98,
    close: 101,
  }));
}

describe("InteractionController pan drag", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("middle drag pans vertically and horizontally", () => {
    vi.stubGlobal("devicePixelRatio", 1);
    const { canvas, dispatch } = fakeCanvas();
    const renderer = new CanvasRenderer(canvas, {});
    const chart = new Chart();
    chart.attachRenderer(renderer);
    chart.setData(series(50));
    chart.renderFrame();
    const ctrl = new InteractionController(canvas, chart, renderer);

    const before = chart.priceScale().getVisibleRange();
    const cameraBefore = chart.viewport!.visibleRange;

    // Grab the middle of the chart and drag down-right.
    dispatch("pointerdown", { clientX: 400, clientY: 200, pointerId: 1 });
    dispatch("pointermove", { clientX: 500, clientY: 300, pointerId: 1 });
    chart.renderFrame();

    const after = chart.priceScale().getVisibleRange();
    expect(after.min).toBeGreaterThan(before.min); // vertical: dragged down -> range shifts up (higher prices)
    expect(after.max).toBeGreaterThan(before.max);
    expect(after.max - after.min).toBeCloseTo(before.max - before.min, 6); // span preserved

    const cameraAfter = chart.viewport!.visibleRange;
    expect(cameraAfter.from).not.toBe(cameraBefore.from); // horizontal: dragged right -> older candles
    expect(cameraAfter.to).not.toBe(cameraBefore.to);

    ctrl.destroy();
    chart.destroy();
  });

  it("drag with no horizontal motion only pans vertically", () => {
    vi.stubGlobal("devicePixelRatio", 1);
    const { canvas, dispatch } = fakeCanvas();
    const renderer = new CanvasRenderer(canvas, {});
    const chart = new Chart();
    chart.attachRenderer(renderer);
    chart.setData(series(50));
    chart.renderFrame();
    const ctrl = new InteractionController(canvas, chart, renderer);

    const before = chart.priceScale().getVisibleRange();
    const cameraBefore = chart.viewport!.visibleRange;

    dispatch("pointerdown", { clientX: 400, clientY: 200, pointerId: 1 });
    dispatch("pointermove", { clientX: 400, clientY: 300, pointerId: 1 }); // straight down
    chart.renderFrame();

    const after = chart.priceScale().getVisibleRange();
    expect(after.min).toBeGreaterThan(before.min);
    // Horizontal camera untouched.
    expect(chart.viewport!.visibleRange).toEqual(cameraBefore);

    ctrl.destroy();
    chart.destroy();
  });
});