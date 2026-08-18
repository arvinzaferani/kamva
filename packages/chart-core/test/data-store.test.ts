import { describe, expect, it } from "vitest";
import { DataStore } from "../src/data-store.js";
import type { Candle } from "../src/types.js";

function candle(time: number, price = 100): Candle {
  return { time, open: price, high: price + 2, low: price - 2, close: price + 1 };
}

describe("DataStore", () => {
  it("stores and reads candles", () => {
    const store = new DataStore();
    store.setData([candle(1), candle(2), candle(3)]);
    expect(store.size).toBe(3);
    expect(store.first?.time).toBe(1);
    expect(store.last?.time).toBe(3);
    expect(store.at(1)?.time).toBe(2);
  });

  it("rejects unsorted data", () => {
    const store = new DataStore();
    expect(() => store.setData([candle(2), candle(1)])).toThrow(/sorted/);
    expect(() => store.setData([candle(1), candle(1)])).toThrow(/sorted/);
  });

  it("copies input so external mutation cannot corrupt state", () => {
    const store = new DataStore();
    const input = [candle(1)];
    store.setData(input);
    input.push(candle(0));
    expect(store.size).toBe(1);
  });

  it("appends strictly newer candles only", () => {
    const store = new DataStore();
    store.setData([candle(1)]);
    store.append(candle(2));
    expect(store.size).toBe(2);
    expect(() => store.append(candle(2))).toThrow(/append/);
    expect(() => store.append(candle(1))).toThrow(/append/);
  });

  it("updates the last candle in place", () => {
    const store = new DataStore();
    store.setData([candle(1), candle(2)]);
    store.update({ ...candle(2), close: 999 });
    expect(store.last?.close).toBe(999);
    expect(store.size).toBe(2);
  });

  it("rejects update with mismatched time or empty store", () => {
    const store = new DataStore();
    expect(() => store.update(candle(1))).toThrow(/empty/);
    store.setData([candle(1)]);
    expect(() => store.update(candle(2))).toThrow(/match/);
  });

  it("finds index by time with binary search", () => {
    const store = new DataStore();
    store.setData([candle(10), candle(20), candle(30)]);
    expect(store.indexAtTime(5)).toBe(-1);
    expect(store.indexAtTime(10)).toBe(0);
    expect(store.indexAtTime(25)).toBe(1);
    expect(store.indexAtTime(99)).toBe(2);
  });

  it("computes price range over a clamped index window", () => {
    const store = new DataStore();
    store.setData([candle(1, 100), candle(2, 200), candle(3, 50)]);
    expect(store.priceRange(0, 2)).toEqual({ min: 48, max: 202 });
    expect(store.priceRange(1, 1)).toEqual({ min: 198, max: 202 });
    // fractional + out-of-bounds input is clamped
    expect(store.priceRange(-5, 0.4)).toEqual({ min: 98, max: 202 });
    expect(store.priceRange(10, 20)).toBeUndefined();
  });
});
