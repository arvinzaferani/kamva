import { describe, expect, it, vi } from "vitest";
import { createCandleSeries, createLineSeries } from "../src/series.js";
import type { Candle, LineSeriesPoint } from "../src/types.js";

function candle(time: number, price = 100): Candle {
  return { time, open: price, high: price + 2, low: price - 2, close: price + 1 };
}

function makeSeries<T extends { readonly time: number }>(type: "candles" | "line") {
  const changed = vi.fn();
  const removed = vi.fn();
  const series =
    type === "candles"
      ? createCandleSeries("c-1", {}, changed, removed)
      : createLineSeries("l-1", {}, changed, removed);
  return { series, changed, removed };
}

const candleItems: readonly Candle[] = [
  candle(0, 100),
  candle(1000, 101),
  candle(2000, 102),
];

describe("Series API", () => {
  describe("setData", () => {
    it("replaces the series data and notifies", () => {
      const { series, changed } = makeSeries<Candle>("candles");
      series.setData(candleItems);
      expect(series.getData()).toHaveLength(3);
      expect(series.getData()[0].close).toBe(101);
      expect(changed).toHaveBeenCalled();
    });

    it("rejects unsorted input", () => {
      const { series } = makeSeries<Candle>("candles");
      expect(() => series.setData([candle(2000), candle(1000)])).toThrow(/increasing time/);
    });
  });

  describe("update", () => {
    it("replaces only the last item", () => {
      const { series } = makeSeries<Candle>("candles");
      series.setData(candleItems);
      series.update(candle(2000, 150));
      const data = series.getData();
      expect(data).toHaveLength(3);
      expect(data[2].close).toBe(151);
      expect(data[0].close).toBe(101);
    });

    it("throws on empty series or mismatched time", () => {
      const { series } = makeSeries<Candle>("candles");
      expect(() => series.update(candle(0))).toThrow(/empty/);
      series.setData(candleItems);
      expect(() => series.update(candle(999, 1))).toThrow(/match the last/);
    });

    it("appends via updateMany continuing the series", () => {
      const { series } = makeSeries<Candle>("candles");
      series.setData(candleItems);
      series.updateMany([candle(3000, 103), candle(4000, 104)]);
      expect(series.getData()).toHaveLength(5);
      expect(series.getData().at(-1)?.time).toBe(4000);
    });
  });

  describe("options", () => {
    it("applies options as a merge and reports them through getOptions", () => {
      const { series } = makeSeries<LineSeriesPoint>("line");
      series.applyOptions({ color: "#f00", lineWidth: 3 });
      const opts = series.getOptions();
      expect(opts.color).toBe("#f00");
      expect(opts.lineWidth).toBe(3);
      // unspecified field is preserved
      series.applyOptions({ color: "#0f0" });
      expect(series.getOptions().color).toBe("#0f0");
      expect(series.getOptions().lineWidth).toBe(3);
    });

    it("exposes defaults through the options view", () => {
      const { series } = makeSeries<LineSeriesPoint>("line");
      expect(series.options.lineWidth).toBe(2);
    });
  });

  describe("visibility", () => {
    it("defaults to visible, toggles, and notifies only on change", () => {
      const { series, changed } = makeSeries<LineSeriesPoint>("line");
      expect(series.isVisible()).toBe(true);
      changed.mockClear();
      series.setVisible(false);
      expect(series.isVisible()).toBe(false);
      expect(changed).toHaveBeenCalledTimes(1);
      changed.mockClear();
      series.setVisible(false); // no-op
      expect(changed).not.toHaveBeenCalled();
      series.setVisible(true);
      expect(series.isVisible()).toBe(true);
    });
  });

  describe("remove", () => {
    it("unregisters exactly once and releases its data", () => {
      const { series, removed } = makeSeries<Candle>("candles");
      series.setData(candleItems);
      series.remove();
      expect(removed).toHaveBeenCalledTimes(1);
      expect(series.getData()).toHaveLength(0);
      series.remove(); // idempotent
      expect(removed).toHaveBeenCalledTimes(1);
    });
  });

  describe("independent data", () => {
    it("mutating one series never affects another", () => {
      const a = makeSeries<Candle>("candles").series;
      const b = makeSeries<LineSeriesPoint>("line").series;
      a.setData(candleItems);
      b.setData([
        { time: 0, value: 1 },
        { time: 1000, value: 2 },
      ]);

      a.update(candle(2000, 300));
      a.setVisible(false);

      expect(a.getData()).toHaveLength(3);
      expect(a.getData()[2].close).toBe(301);
      expect(a.isVisible()).toBe(false);

      expect(b.getData()).toHaveLength(2);
      expect(b.getData()[1].value).toBe(2);
      expect(b.isVisible()).toBe(true);
    });
  });
});