import { Camera } from "./camera.js";
import type {
  ChartApi,
  ChartEvents,
  CrosshairPosition,
  Plugin,
  RenderableSeries,
  Renderer,
} from "./contracts.js";
import { EventBus } from "./event-bus.js";
import {
  createCandleSeries,
  createLineSeries,
  type LineOptions,
  type Series,
  type SeriesImpl,
  type SeriesOptions,
} from "./series.js";
import type { Candle, LineSeriesPoint, Point, PriceRange } from "./types.js";
import { padPriceRange, Viewport } from "./viewport.js";

export interface ChartOptions {
  /** Fractional padding above/below the visible price range. Default 0.08. */
  pricePadding?: number;
  /** Candles of empty space allowed past either end when panning. Default 5. */
  overscroll?: number;
}

type AnySeries = SeriesImpl<Candle> | SeriesImpl<LineSeriesPoint>;

/**
 * Chart is the facade over state (Series), navigation (Camera) and output
 * (Renderer). It owns frame scheduling: any mutation marks the chart dirty
 * and a single render is coalesced per animation frame, so bursts of
 * appends/pans cost one draw (see PERFORMANCE.md).
 *
 * Renderers are injected, never imported — chart-core has zero DOM/canvas
 * dependencies (see ARCHITECTURE.md). Drawing goes through the abstract
 * RenderSurface primitives, so any backend (Canvas today, WebGL later) can
 * render the same scene.
 */
export class Chart implements ChartApi {
  private readonly camera = new Camera();
  private readonly bus = new EventBus<ChartEvents>();
  private readonly plugins: Plugin[] = [];
  private readonly options: Required<ChartOptions>;
  private readonly seriesList: AnySeries[] = [];
  private readonly mainSeries: SeriesImpl<Candle>;
  private renderer: Renderer | undefined;
  private currentViewport: Viewport | undefined;
  private dirty = false;
  private frameHandle: number | undefined;
  private destroyed = false;
  private seriesCounter = 0;
  private readonly scheduleFrame: (cb: () => void) => number;
  private readonly cancelFrame: (handle: number) => void;

  constructor(options?: ChartOptions) {
    this.options = {
      pricePadding: options?.pricePadding ?? 0.08,
      overscroll: options?.overscroll ?? 5,
    };
    // requestAnimationFrame when hosted in a browser; setTimeout fallback
    // keeps the core usable in workers and Node-based tests.
    if (typeof requestAnimationFrame === "function") {
      this.scheduleFrame = (cb) => requestAnimationFrame(cb);
      this.cancelFrame = (h) => cancelAnimationFrame(h);
    } else {
      this.scheduleFrame = (cb) => setTimeout(cb, 16) as unknown as number;
      this.cancelFrame = (h) => clearTimeout(h);
    }
    // The primary candle series backs the convenience setData/append/update API.
    this.mainSeries = createCandleSeries(
      "candles",
      {},
      () => this.invalidate(),
      () => this.removeSeriesInternal(this.mainSeries),
    );
    this.seriesList.push(this.mainSeries);
  }

  /** Attach the output renderer. The chart takes ownership and destroys it with itself. */
  attachRenderer(renderer: Renderer): void {
    this.assertAlive();
    this.renderer = renderer;
    this.invalidate();
  }

  // ---- series -----------------------------------------------------------

  addCandlestickSeries(options: SeriesOptions = {}): Series<Candle> {
    this.assertAlive();
    const series = createCandleSeries(
      `candles-${++this.seriesCounter}`,
      options,
      () => this.invalidate(),
      () => this.removeSeriesInternal(series),
    );
    this.seriesList.push(series);
    this.invalidate();
    return series;
  }

  addLineSeries(options: LineOptions = {}): Series<LineSeriesPoint> {
    this.assertAlive();
    const series = createLineSeries(
      `line-${++this.seriesCounter}`,
      options,
      () => this.invalidate(),
      () => this.removeSeriesInternal(series),
    );
    this.seriesList.push(series);
    this.invalidate();
    return series;
  }

  // ---- data (convenience over the primary candle series) ----------------

  get data(): readonly Candle[] {
    return this.mainSeries.data;
  }

  get viewport(): Viewport | undefined {
    return this.currentViewport;
  }

  setData(candles: readonly Candle[]): void {
    this.assertAlive();
    this.camera.fit(candles.length, 200);
    this.mainSeries.setData(candles);
    this.emitDataChanged();
  }

  append(candle: Candle): void {
    this.assertAlive();
    const wasAtEnd = this.camera.range.to >= this.mainSeries.data.length - 1;
    this.mainSeries.append(candle);
    // Follow the live edge only if the user was already looking at it.
    if (wasAtEnd) this.camera.pan(1);
    this.emitDataChanged();
  }

  update(candle: Candle): void {
    this.assertAlive();
    this.mainSeries.update(candle);
    this.emitDataChanged();
  }

  // ---- navigation -------------------------------------------------------

  zoom(factor: number, anchor = 0.5): void {
    this.assertAlive();
    this.camera.zoom(factor, anchor);
    this.camera.clampToData(this.mainSeries.data.length, this.options.overscroll);
    this.emitCameraChanged();
  }

  pan(candles: number): void {
    this.assertAlive();
    this.camera.pan(candles);
    this.camera.clampToData(this.mainSeries.data.length, this.options.overscroll);
    this.emitCameraChanged();
  }

  fit(): void {
    this.assertAlive();
    this.camera.fit(this.mainSeries.data.length);
    this.emitCameraChanged();
  }

  // ---- events -----------------------------------------------------------

  on<K extends keyof ChartEvents>(
    event: K,
    handler: (payload: ChartEvents[K]) => void,
  ): () => void {
    return this.bus.on(event, handler);
  }

  /** Emit a raw pointer position; the chart resolves it into domain space. */
  emit<K extends keyof ChartEvents>(event: K, payload: ChartEvents[K]): void {
    this.bus.emit(event, payload);
    if (event === "pointer:move") {
      this.emitCrosshair(payload as Point);
      this.invalidate();
    } else if (event === "pointer:leave") {
      this.bus.emit("crosshairMove", undefined);
      this.invalidate();
    }
  }

  /** Resolve a click in pixel space into domain space and emit it. */
  emitClick(x: number, y: number): void {
    const position = this.resolveCrosshair(x, y);
    if (position === undefined) return;
    const { x: px, y: py, index, time, price } = position;
    this.bus.emit("click", { x: px, y: py, index, time, price });
  }

  // ---- plugins ----------------------------------------------------------

  use(plugin: Plugin): this {
    this.assertAlive();
    if (this.plugins.some((p) => p.name === plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already registered`);
    }
    this.plugins.push(plugin);
    plugin.initialize(this);
    this.invalidate();
    return this;
  }

  removePlugin(name: string): void {
    const index = this.plugins.findIndex((p) => p.name === name);
    if (index === -1) return;
    const removed = this.plugins.splice(index, 1);
    removed[0]?.destroy?.();
    this.invalidate();
  }

  // ---- lifecycle --------------------------------------------------------

  destroy(): void {
    if (this.destroyed) return;
    this.bus.emit("destroy", undefined);
    if (this.frameHandle !== undefined) this.cancelFrame(this.frameHandle);
    for (const plugin of this.plugins) plugin.destroy?.();
    this.plugins.length = 0;
    this.renderer?.destroy();
    this.renderer = undefined;
    this.bus.clear();
    this.seriesList.length = 0;
    this.destroyed = true;
  }

  // ---- rendering --------------------------------------------------------

  /** Mark the chart dirty; a single render runs on the next frame. */
  invalidate(): void {
    if (this.destroyed || this.dirty) return;
    this.dirty = true;
    this.frameHandle = this.scheduleFrame(() => {
      this.frameHandle = undefined;
      this.dirty = false;
      this.renderFrame();
    });
  }

  /** Synchronous render, exposed for tests and manual frame control. */
  renderFrame(): void {
    if (this.destroyed || !this.renderer || this.mainSeries.data.length === 0) return;
    const { from, to } = this.camera.range;
    const rawRange = this.unionPriceRange(from, to);
    if (!rawRange) return;
    const viewport = new Viewport(
      this.renderer.size,
      { from, to },
      padPriceRange(rawRange, this.options.pricePadding),
    );
    this.currentViewport = viewport;
    for (const plugin of this.plugins) plugin.update?.(this);
    const renderable = this.buildRenderable();
    this.renderer.beginFrame();
    // base layers (background, grid, axes, series)
    this.renderer.render(viewport, renderable);
    // plugin overlays (indicators, drawing tools) sit below the crosshair
    const surface = this.renderer.getPluginContext?.();
    for (const plugin of this.plugins) plugin.draw?.(this, viewport, surface);
    this.renderer.drawOverlay?.(viewport, renderable);
    this.renderer.endFrame();
  }

  // ---- internals --------------------------------------------------------

  private buildRenderable(): RenderableSeries[] {
    return this.seriesList.map((s) => ({
      id: s.id,
      type: s.type,
      options: s.options,
      data: s.data as unknown as readonly Candle[] | readonly LineSeriesPoint[],
    }));
  }

  private unionPriceRange(from: number, to: number): PriceRange | undefined {
    const { fromTime, toTime } = this.visibleTimeWindow(from, to);
    let min = Infinity;
    let max = -Infinity;
    for (const s of this.seriesList) {
      const r = s.priceRange(fromTime, toTime);
      if (r === undefined) continue;
      if (r.min < min) min = r.min;
      if (r.max > max) max = r.max;
    }
    if (min === Infinity) return undefined;
    return { min, max };
  }

  private visibleTimeWindow(from: number, to: number): { fromTime: number; toTime: number } {
    const data = this.mainSeries.data;
    if (data.length === 0) return { fromTime: 0, toTime: 0 };
    const lo = Math.max(0, Math.min(data.length - 1, Math.floor(from)));
    const hi = Math.max(0, Math.min(data.length - 1, Math.ceil(to)));
    return { fromTime: data[lo]?.time ?? 0, toTime: data[hi]?.time ?? 0 };
  }

  private emitDataChanged(): void {
    this.camera.clampToData(this.mainSeries.data.length, this.options.overscroll);
    this.bus.emit("data:changed", { size: this.mainSeries.data.length });
    this.invalidate();
  }

  private emitCameraChanged(): void {
    const { from, to } = this.camera.range;
    const { fromTime, toTime } = this.visibleTimeWindow(from, to);
    this.bus.emit("visibleRangeChange", { from, to, fromTime, toTime });
    this.bus.emit("camera:changed", { from, to });
    this.invalidate();
  }

  private emitCrosshair(point: Point): void {
    const position = this.resolveCrosshair(point.x, point.y);
    this.bus.emit("crosshairMove", position);
  }

  private resolveCrosshair(x: number, y: number): CrosshairPosition | undefined {
    const viewport = this.currentViewport;
    if (viewport === undefined) return undefined;
    const index = viewport.indexForX(x);
    const price = viewport.priceForY(y);
    const time = this.timeAtIndex(index);
    return { x, y, index, price, time };
  }

  private timeAtIndex(index: number): number {
    const data = this.mainSeries.data;
    if (data.length === 0) return 0;
    const i = Math.max(0, Math.min(data.length - 1, Math.round(index)));
    return data[i]?.time ?? 0;
  }

  private removeSeriesInternal(series: AnySeries): void {
    const index = this.seriesList.indexOf(series);
    if (index >= 0) this.seriesList.splice(index, 1);
    this.emitDataChanged();
  }

  private assertAlive(): void {
    if (this.destroyed) throw new Error("Chart has been destroyed");
  }
}