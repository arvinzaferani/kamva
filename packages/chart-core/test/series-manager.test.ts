import { describe, expect, it } from "vitest";
import { SeriesManager } from "../src/series-manager.js";
import type { Candle } from "../src/types.js";

function noop(): void {}

describe("SeriesManager", () => {
  it("adds candle and line series with stable, unique ids", () => {
    const manager = new SeriesManager({ onChanged: noop, onRemoved: noop });
    const candleA = manager.addCandlestick({});
    const candleB = manager.addCandlestick({});
    const line = manager.addLine({});
    expect(candleA.id).toBe("candles-1");
    expect(candleB.id).toBe("candles-2");
    expect(line.id).toBe("line-3");
    expect(new Set(manager.list().map((s) => s.id)).size).toBe(3);
  });

  it("treats the first candle series as the primary / x-axis reference", () => {
    const manager = new SeriesManager({ onChanged: noop, onRemoved: noop });
    const primary = manager.addCandlestick({});
    manager.addLine({});
    expect(manager.primary()).toBe(primary);
  });

  it("reports whether any series holds data and voids the primary length", () => {
    const manager = new SeriesManager({ onChanged: noop, onRemoved: noop });
    expect(manager.hasData()).toBe(false);
    expect(manager.primaryLength()).toBe(0);
    const primary = manager.addCandlestick({});
    primary.setData([
      { time: 0, open: 1, high: 3, low: 0, close: 2 },
      { time: 1000, open: 2, high: 4, low: 1, close: 3 },
    ]);
    expect(manager.hasData()).toBe(true);
    expect(manager.primaryLength()).toBe(2);
  });

  it("unions price ranges across independent series in a time window", () => {
    const manager = new SeriesManager({ onChanged: noop, onRemoved: noop });
    const candles: Candle[] = [
      { time: 0, open: 1, high: 10, low: 0, close: 5 },
      { time: 1000, open: 5, high: 20, low: 4, close: 6 },
    ];
    manager.addCandlestick({}).setData(candles);
    manager.addLine({}).setData([
      { time: 0, value: 2 },
      { time: 1000, value: 15 },
    ]);
    const range = manager.unionPriceRange(0, 1000);
    expect(range).toEqual({ min: 0, max: 20 });
  });

  it("removes a series by reference and by id and notifies once", () => {
    let removals = 0;
    const manager = new SeriesManager({ onChanged: noop, onRemoved: () => removals++ });
    const primary = manager.addCandlestick({});
    const line = manager.addLine({});
    manager.remove(line);
    expect(manager.list()).toEqual([primary]);
    expect(removals).toBe(1);

    manager.removeById(primary.id);
    expect(manager.list()).toEqual([]);
    expect(removals).toBe(2);
    expect(manager.primary()).toBeUndefined();
  });

  it("removal is idempotent for an already-removed series", () => {
    const manager = new SeriesManager({ onChanged: noop, onRemoved: noop });
    const line = manager.addLine({});
    manager.remove(line);
    manager.remove(line);
    expect(manager.list()).toEqual([]);
  });

  it("snapshots the series in insertion order for renderers", () => {
    const manager = new SeriesManager({ onChanged: noop, onRemoved: noop });
    manager.addCandlestick({});
    manager.addLine({ color: "#f00" });
    const snapshot = manager.snapshot();
    expect(snapshot).toHaveLength(2);
    expect(snapshot[0].type).toBe("candles");
    expect(snapshot[1].type).toBe("line");
    expect(snapshot[1].options.color).toBe("#f00");
  });

  it("get() returns a series by id", () => {
    const manager = new SeriesManager({ onChanged: noop, onRemoved: noop });
    const line = manager.addLine({});
    expect(manager.get(line.id)).toBe(line);
    expect(manager.get("missing")).toBeUndefined();
  });

  it("hides series from rendering and autoscale when setVisible(false)", () => {
    const manager = new SeriesManager({ onChanged: noop, onRemoved: noop });
    manager.addCandlestick({}).setData([
      { time: 0, open: 1, high: 10, low: 0, close: 5 },
      { time: 1000, open: 5, high: 20, low: 4, close: 6 },
    ]);
    const loud = manager.addLine({});
    loud.setData([
      { time: 0, value: 999 },
      { time: 1000, value: 1000 },
    ]);

    // visible: loud contributes to the snapshot and the price range
    expect(manager.snapshot()).toHaveLength(2);
    expect(manager.unionPriceRange(0, 1000)).toEqual({ min: 0, max: 1000 });

    loud.setVisible(false);
    expect(manager.list()).toHaveLength(2); // still registered
    expect(manager.snapshot()).toHaveLength(1); // not rendered
    expect(manager.unionPriceRange(0, 1000)).toEqual({ min: 0, max: 20 });

    loud.setVisible(true);
    expect(manager.snapshot()).toHaveLength(2);
  });
});