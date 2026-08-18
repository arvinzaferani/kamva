import { describe, expect, it } from "vitest";
import { Camera } from "../src/camera.js";

describe("Camera", () => {
  it("sets and reads range", () => {
    const camera = new Camera();
    camera.setRange(10, 50);
    expect(camera.range).toEqual({ from: 10, to: 50 });
    expect(camera.span).toBe(40);
  });

  it("ignores invalid ranges", () => {
    const camera = new Camera();
    camera.setRange(0, 100);
    camera.setRange(50, 50);
    camera.setRange(NaN, 10);
    expect(camera.range).toEqual({ from: 0, to: 100 });
  });

  it("zooms in around the center anchor", () => {
    const camera = new Camera();
    camera.setRange(0, 100);
    camera.zoom(2, 0.5);
    expect(camera.range).toEqual({ from: 25, to: 75 });
  });

  it("zooms around an edge anchor without moving that edge", () => {
    const camera = new Camera();
    camera.setRange(0, 100);
    camera.zoom(2, 1); // anchor right edge
    expect(camera.range.to).toBeCloseTo(100);
    expect(camera.range.from).toBeCloseTo(50);
  });

  it("respects the minimum visible candle count", () => {
    const camera = new Camera({ minVisibleCandles: 10 });
    camera.setRange(0, 20);
    camera.zoom(1000);
    expect(camera.span).toBe(10);
  });

  it("pans by candle count", () => {
    const camera = new Camera();
    camera.setRange(0, 100);
    camera.pan(25);
    expect(camera.range).toEqual({ from: 25, to: 125 });
  });

  it("clamps to data bounds with overscroll", () => {
    const camera = new Camera();
    camera.setRange(0, 100);
    camera.pan(1000);
    camera.clampToData(500, 5);
    expect(camera.range.to).toBe(504);
    expect(camera.range.from).toBe(404);
    camera.pan(-10_000);
    camera.clampToData(500, 5);
    expect(camera.range.from).toBe(-5);
  });

  it("fits the series with a right margin", () => {
    const camera = new Camera();
    camera.fit(100);
    expect(camera.range.from).toBe(0);
    expect(camera.range.to).toBeGreaterThan(99);
  });
});
