import type { Candle, LineSeriesPoint, PriceRange } from "./types.js";

/** Kinds of series the core understands. The renderer maps each to drawing. */
export type SeriesType = "candles" | "line";

/** Visual options shared by all series. */
export interface SeriesOptions {
  readonly color?: string;
  readonly lineWidth?: number;
}

export type CandlestickOptions = SeriesOptions;
export type LineOptions = SeriesOptions;

/**
 * The public series contract (locked before framework adapters are built).
 *
 * A chart hosts many series; each owns its own sorted-by-time data and
 * visual options. Applications build tooling against this interface, so
 * it is stable public API.
 */
export interface Series<T extends { readonly time: number }> {
  /** Stable within its chart. */
  readonly id: string;
  readonly type: SeriesType;
  readonly options: Readonly<SeriesOptions>;
  readonly data: readonly T[];
  /** Replace the entire series (input must be sorted by time). */
  setData(data: readonly T[]): void;
  /** Append a single item newer than the last one. */
  append(item: T): void;
  /** Replace the last item (typical real-time tick update). */
  update(item: T): void;
  /** Append several items, each continuing the sorted series. */
  updateMany(items: readonly T[]): void;
  /** Update visual options. */
  applyOptions(options: SeriesOptions): void;
  /** Remove this series from its chart. */
  remove(): void;
}

const defaultCandleColor = "#787b86";
const defaultLineColor = "#2962ff";

/**
 * Internal sorted-by-time series store. Invariant: `items` are sorted by
 * strictly increasing `time`; lookups use binary search, appends are O(1).
 */
export class SeriesImpl<T extends { readonly time: number }> implements Series<T> {
  private items: T[] = [];
  private opts: { color: string; lineWidth: number };
  private removed = false;

  constructor(
    readonly id: string,
    readonly type: SeriesType,
    initial: SeriesOptions,
    private readonly rangeOf: (item: T) => PriceRange,
    private readonly onChange: () => void,
    private readonly onRemove: () => void,
  ) {
    const defaultColor = type === "candles" ? defaultCandleColor : defaultLineColor;
    this.opts = {
      color: initial.color ?? defaultColor,
      lineWidth: initial.lineWidth ?? (type === "candles" ? 1 : 2),
    };
  }

  get options(): Readonly<SeriesOptions> {
    return this.opts;
  }

  get data(): readonly T[] {
    return this.items;
  }

  setData(data: readonly T[]): void {
    this.assertAlive();
    assertSorted(data, "setData");
    this.items = [...data];
    this.onChange();
  }

  append(item: T): void {
    this.assertAlive();
    const last = this.items[this.items.length - 1];
    if (last !== undefined && item.time <= last.time) {
      throw new Error(
        `append() requires time > last item time (${item.time} <= ${last.time}); use update() for the last item`,
      );
    }
    this.items.push(item);
    this.onChange();
  }

  update(item: T): void {
    this.assertAlive();
    const lastIndex = this.items.length - 1;
    const last = this.items[lastIndex];
    if (last === undefined) throw new Error("update() called on an empty series");
    if (item.time !== last.time) {
      throw new Error(
        `update() requires time to match the last item (${item.time} !== ${last.time}); use append() for new items`,
      );
    }
    this.items[lastIndex] = item;
    this.onChange();
  }

  updateMany(items: readonly T[]): void {
    this.assertAlive();
    assertSortedAppend(this.items, items);
    this.items.push(...items);
    this.onChange();
  }

  applyOptions(options: SeriesOptions): void {
    this.assertAlive();
    if (options.color !== undefined) this.opts.color = options.color;
    if (options.lineWidth !== undefined) this.opts.lineWidth = options.lineWidth;
    this.onChange();
  }

  remove(): void {
    if (this.removed) return;
    this.removed = true;
    this.onRemove();
  }

  /** Index of the first item with `time >= t` (binary search, O(log n)). */
  lowerBound(time: number): number {
    let lo = 0;
    let hi = this.items.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if ((this.items[mid]?.time ?? -Infinity) < time) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /** Price range of items whose time is within [fromTime, toTime]. */
  priceRange(fromTime: number, toTime: number): PriceRange | undefined {
    let min = Infinity;
    let max = -Infinity;
    for (let i = this.lowerBound(fromTime); i < this.items.length; i++) {
      const it = this.items[i];
      if (it === undefined || it.time > toTime) break;
      const r = this.rangeOf(it);
      if (r.min < min) min = r.min;
      if (r.max > max) max = r.max;
    }
    if (min === Infinity) return undefined;
    return { min, max };
  }

  private assertAlive(): void {
    if (this.removed) throw new Error(`Series "${this.id}" has been removed`);
  }
}

/** Build a candle series implementation wired to a chart. */
export function createCandleSeries(
  id: string,
  options: CandlestickOptions,
  onChanged: () => void,
  onRemoved: () => void,
): SeriesImpl<Candle> {
  return new SeriesImpl<Candle>(
    id,
    "candles",
    options,
    (c) => ({ min: c.low, max: c.high }),
    onChanged,
    onRemoved,
  );
}

/** Build a line series implementation wired to a chart. */
export function createLineSeries(
  id: string,
  options: LineOptions,
  onChanged: () => void,
  onRemoved: () => void,
): SeriesImpl<LineSeriesPoint> {
  return new SeriesImpl<LineSeriesPoint>(
    id,
    "line",
    options,
    (p) => ({ min: p.value, max: p.value }),
    onChanged,
    onRemoved,
  );
}

function assertSorted(items: readonly { time: number }[], label: string): void {
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const curr = items[i];
    if (prev !== undefined && curr !== undefined && curr.time <= prev.time) {
      throw new Error(
        `${label} requires strictly increasing time (index ${i}: ${curr.time} <= ${prev.time})`,
      );
    }
  }
}

function assertSortedAppend(
  existing: readonly { time: number }[],
  items: readonly { time: number }[],
): void {
  assertSorted(items, "updateMany()");
  const last = existing[existing.length - 1];
  const first = items[0];
  if (existing.length > 0 && first !== undefined && last !== undefined && first.time <= last.time) {
    throw new Error(
      `updateMany() items must continue after the series (${first.time} <= ${last.time})`,
    );
  }
}