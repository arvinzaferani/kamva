import type { CrosshairSeriesDatum, RenderableSeries } from "./contracts.js";
import {
  createCandleSeries,
  createLineSeries,
  type CandlestickOptions,
  type LineOptions,
  SeriesImpl,
} from "./series.js";
import type { Candle, LineSeriesPoint, PriceRange } from "./types.js";

type AnySeries = SeriesImpl<Candle> | SeriesImpl<LineSeriesPoint>;

export interface SeriesManagerOptions {
  /** Called when any series' data or options change (used to invalidate a frame). */
  onChanged: () => void;
  /** Called when a series is removed (used to notify the host and reset camera bounds). */
  onRemoved: () => void;
}

/**
 * Registry of every series on a chart.
 *
 * Owns the series list, stable IDs, and the aggregate read models the chart
 * and renderers consume: a renderable snapshot, the union price range over a
 * time window, and the primary (x-axis) candle series used for index<->time
 * mapping. This removes the architectural dependency on a single "main
 * series" from the rest of the core while preserving multi-series behaviour.
 */
export class SeriesManager {
  private readonly series: AnySeries[] = [];
  private nextId = 0;
  /** Bumped on any series add/remove/data change; scales cache on it. */
  private version = 0;
  /** The candle series used as the x-axis / index<->time reference. */
  private primarySeries: SeriesImpl<Candle> | undefined;

  constructor(private readonly hooks: SeriesManagerOptions) {}

  get dataVersion(): number {
    return this.version;
  }

  /** List of all live series, in insertion order. */
  list(): readonly AnySeries[] {
    return this.series;
  }

  get(id: string): AnySeries | undefined {
    return this.series.find((s) => s.id === id);
  }

  addCandlestick(options: CandlestickOptions = {}): SeriesImpl<Candle> {
    const id = `candles-${++this.nextId}`;
    const series = createCandleSeries(
      id,
      options,
      () => this.onSeriesChanged(),
      () => this.remove(series),
    );
    this.series.push(series);
    if (this.primarySeries === undefined) this.primarySeries = series;
    this.version++;
    return series;
  }

  addLine(options: LineOptions = {}): SeriesImpl<LineSeriesPoint> {
    const id = `line-${++this.nextId}`;
    const series = createLineSeries(
      id,
      options,
      () => this.onSeriesChanged(),
      () => this.remove(series),
    );
    this.series.push(series);
    this.version++;
    return series;
  }

  private onSeriesChanged(): void {
    this.version++;
    this.hooks.onChanged();
  }

  /** Remove a series and notify the host. No-op if already removed. */
  remove(series: AnySeries): void {
    const index = this.series.indexOf(series);
    if (index === -1) return;
    this.series.splice(index, 1);
    if (this.primarySeries === series) this.primarySeries = undefined;
    this.version++;
    this.hooks.onRemoved();
  }

  removeById(id: string): void {
    const series = this.get(id);
    if (series !== undefined) this.remove(series);
  }

  /** The candle series used as the X axis; undefined after the primary is removed. */
  primary(): SeriesImpl<Candle> | undefined {
    return this.primarySeries;
  }

  /** Length of the primary series (0 when none). */
  primaryLength(): number {
    return this.primarySeries?.data.length ?? 0;
  }

  /** Whether any series currently holds data. */
  hasData(): boolean {
    return this.series.some((s) => s.data.length > 0);
  }

  /** Union of visible prices across every visible series within a time window. */
  unionPriceRange(fromTime: number, toTime: number): PriceRange | undefined {
    let min = Infinity;
    let max = -Infinity;
    for (const s of this.series) {
      if (!s.isVisible()) continue;
      const range = s.priceRange(fromTime, toTime);
      if (range === undefined) continue;
      if (range.min < min) min = range.min;
      if (range.max > max) max = range.max;
    }
    if (min === Infinity) return undefined;
    return { min, max };
  }

  /** Union price range of the visible series matching the crosshair time. */
  /**
   * The value under a crosshair for every visible series with data near `time`.
   * Hidden series are skipped, so they never participate in the crosshair.
   */
  crosshairAt(time: number): CrosshairSeriesDatum[] {
    const out: CrosshairSeriesDatum[] = [];
    for (const s of this.series) {
      if (!s.isVisible() || s.data.length === 0) continue;
      const item = s.itemAt(time);
      if (item === undefined) continue;
      const value =
        s.type === "candles"
          ? (item as Candle).close
          : (item as LineSeriesPoint).value;
      out.push({ id: s.id, type: s.type, time: item.time, value, item });
    }
    return out;
  }

  /** Immutable per-frame snapshot of visible series, handed to renderers. */
  snapshot(): RenderableSeries[] {
    return this.series.filter((s) => s.isVisible()).map((s) => ({
      id: s.id,
      type: s.type,
      options: s.options,
      data: s.data as readonly Candle[] | readonly LineSeriesPoint[],
    }));
  }

  // ---- primary (x-axis) time<->index mapping ---------------------------

  /** First index of the primary whose time is >= `t` (clamped to bounds). */
  primaryIndexFirstAt(t: number): number {
    const p = this.primarySeries;
    if (p === undefined || p.data.length === 0) return 0;
    return Math.min(p.lowerBound(t), p.data.length - 1);
  }

  /** Last index of the primary whose time is <= `t` (-1 when none). */
  primaryIndexLastAt(t: number): number {
    const p = this.primarySeries;
    if (p === undefined || p.data.length === 0) return -1;
    const idx = p.lowerBound(t); // first index with time >= t
    if (idx < p.data.length && (p.data[idx]?.time ?? 0) === t) return idx;
    return idx - 1;
  }

  /** Time of the primary candle at `index` (clamped; 0 for an empty primary). */
  primaryTimeAtIndex(index: number): number {
    const p = this.primarySeries;
    if (p === undefined || p.data.length === 0) return 0;
    const i = Math.max(0, Math.min(p.data.length - 1, Math.round(index)));
    return p.data[i]?.time ?? 0;
  }

  /** Union time window covering all visible series, or undefined when empty. */
  timeRange(): { from: number; to: number } | undefined {
    let from = Infinity;
    let to = -Infinity;
    for (const s of this.series) {
      if (!s.isVisible()) continue;
      const first = s.data[0];
      const last = s.data[s.data.length - 1];
      if (first === undefined || last === undefined) continue;
      if (first.time < from) from = first.time;
      if (last.time > to) to = last.time;
    }
    if (from === Infinity) return undefined;
    return { from, to };
  }

  /** Release every live series without firing per-series callbacks. */
  clear(): void {
    this.series.length = 0;
    this.primarySeries = undefined;
  }
}