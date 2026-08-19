import { Camera } from "./camera.js";
import type {
  ChartApi,
  ChartEvents,
  ChartSubscriptions,
  ClickPayload,
  CrosshairPosition,
  VisibleRangePayload,
  Plugin,
  Renderer,
  PriceScaleApi,
  TimeScaleApi,
} from "./contracts.js";
import { EventBus } from "./event-bus.js";
import { PriceScale } from "./price-scale.js";
import { SeriesManager } from "./series-manager.js";
import { TimeScale } from "./timescale.js";
import type { LineOptions, Series, SeriesOptions } from "./series.js";
import type { Candle, LineSeriesPoint, Point, PriceRange } from "./types.js";
import { padPriceRange, Viewport } from "./viewport.js";

export interface ChartOptions {
  /** Fractional padding above/below the visible price range. Default 0.08. */
  pricePadding?: number;
  /** Candles of empty space allowed past either end when panning. Default 5. */
  overscroll?: number;
}

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
 *
 * Series live in a SeriesManager; the first candle series created becomes the
 * primary (x-axis reference) and backs the convenience setData/append/update/
 * data API, but it is not the only series the chart can hold.
 */
export class Chart implements ChartApi {
  private readonly camera = new Camera();
  private readonly bus = new EventBus<ChartEvents>();
  private readonly plugins: Plugin[] = [];
  private readonly options: Required<ChartOptions>;
  private readonly manager: SeriesManager;
  private readonly timeScaleImpl: TimeScale;
  private readonly priceScaleImpl: PriceScale;
  private renderer: Renderer | undefined;
  private currentViewport: Viewport | undefined;
  /** Cached auto price range, reused until data or the visible window change. */
  private autoRangeCache: { version: number; from: number; to: number; range: PriceRange } | undefined;
  private dirty = false;
  private frameHandle: number | undefined;
  private destroyed = false;
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
    // Series live here; the primary (x-axis reference) is created lazily: the
    // first candle series — whether added via addCandlestickSeries or via the
    // setData shortcut — becomes the primary that backs the convenience API.
    this.manager = new SeriesManager({
      onChanged: () => {
        // A freshly seeded reference series is invisible while the camera sits
        // at its default zero span, so fit it the moment it first has data.
        const primary = this.manager.primary();
        if (primary !== undefined && primary.data.length > 0 && this.camera.span <= 0) {
          this.camera.fit(primary.data.length, 200);
        }
        this.invalidate();
      },
      onRemoved: () => this.emitDataChanged(),
    });
    this.timeScaleImpl = new TimeScale({
      camera: this.camera,
      manager: this.manager,
      notifyChange: () => this.emitCameraChanged(),
      subscribeRaw: (cb) => this.on("visibleRangeChange", cb),
    });
    this.priceScaleImpl = new PriceScale({
      getHeight: () => this.renderer?.size.height ?? 0,
      getAutoRange: () => this.autoPriceRange(),
      invalidate: () => this.invalidate(),
    });
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
    const series = this.manager.addCandlestick(options);
    this.invalidate();
    return series;
  }

  addLineSeries(options: LineOptions = {}): Series<LineSeriesPoint> {
    this.assertAlive();
    const series = this.manager.addLine(options);
    this.invalidate();
    return series;
  }

  // ---- data (convenience over the primary candle series) ----------------

  get data(): readonly Candle[] {
    return this.manager.primary()?.data ?? [];
  }

  get viewport(): Viewport | undefined {
    return this.currentViewport;
  }

  setData(candles: readonly Candle[]): void {
    this.assertAlive();
    // The convenience API targets the primary (x-axis reference). Create it if
    // no candle series exists yet, so `new Chart(); chart.setData(...)` works.
    if (this.manager.primary() === undefined) this.manager.addCandlestick({});
    this.camera.fit(candles.length, 200);
    this.priceScaleImpl.autoscale();
    this.manager.primary()?.setData(candles);
    this.emitDataChanged();
  }

  append(candle: Candle): void {
    this.assertAlive();
    const primary = this.manager.primary();
    if (primary === undefined) return;
    const wasAtEnd = this.camera.range.to >= primary.data.length - 1;
    primary.append(candle);
    // Follow the live edge only if the user was already looking at it.
    if (wasAtEnd) this.camera.pan(1);
    this.emitDataChanged();
  }

  update(candle: Candle): void {
    this.assertAlive();
    this.manager.primary()?.update(candle);
    this.emitDataChanged();
  }

  removeSeries(id: string): void {
    this.assertAlive();
    this.manager.removeById(id);
  }

  // ---- navigation -------------------------------------------------------

  zoom(factor: number, anchor = 0.5): void {
    this.assertAlive();
    this.camera.zoom(factor, anchor);
    this.camera.clampToData(this.manager.primaryLength(), this.options.overscroll);
    this.emitCameraChanged();
  }

  zoomPrice(factor: number, anchorPrice?: number): void {
    this.assertAlive();
    if (!Number.isFinite(factor) || factor <= 0) return;
    // Anchor to the currently displayed price range, so zooming is anchored
    // smoothly instead of jumping to a global center.
    const base = this.priceScaleImpl.effectiveRange();
    if (!base) return;
    const span = base.max - base.min;
    if (span <= 0) return;
    const anchor = anchorPrice === undefined ? (base.min + base.max) / 2 : Math.min(base.max, Math.max(base.min, anchorPrice));
    const frac = (anchor - base.min) / span;
    const target = span / factor;
    this.priceScaleImpl.setVisibleRange({
      min: anchor - frac * target,
      max: anchor + (1 - frac) * target,
    });
  }

  pan(candles: number): void {
    this.assertAlive();
    this.camera.pan(candles);
    this.camera.clampToData(this.manager.primaryLength(), this.options.overscroll);
    this.emitCameraChanged();
  }

  /** Pan the vertical price axis by a price amount (takes manual control). */
  panPrice(byPrice: number): void {
    this.assertAlive();
    this.priceScaleImpl.panPrice(byPrice);
  }

  fit(): void {
    this.assertAlive();
    this.priceScaleImpl.autoscale();
    this.timeScale().reset();
  }

  /** The shared time axis for all series. */
  timeScale(): TimeScaleApi {
    return this.timeScaleImpl;
  }

  /** The shared vertical (price) axis for all series on the default scale. */
  priceScale(): PriceScaleApi {
    return this.priceScaleImpl;
  }

  // ---- events -----------------------------------------------------------

  on<K extends keyof ChartEvents>(
    event: K,
    handler: (payload: ChartEvents[K]) => void,
  ): () => void {
    return this.bus.on(event, handler);
  }

  /** Raw pointer position; the chart resolves it into domain space. */
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
    this.bus.emit("click", this.clickPayload(position));
  }

  /** Resolve a double click in pixel space into domain space and emit it. */
  emitDoubleClick(x: number, y: number): void {
    const position = this.resolveCrosshair(x, y);
    if (position === undefined) return;
    this.bus.emit("dblclick", this.clickPayload(position));
  }

  /** Subscribe to a user-facing event by name; returns an unsubscribe function. */
  subscribe<E extends keyof ChartSubscriptions>(
    event: E,
    handler: (payload: ChartSubscriptions[E]) => void,
  ): () => void {
    switch (event) {
      case "pointerMove":
        return this.on("pointer:move", handler as (p: Point) => void);
      case "click":
        return this.on("click", handler as (p: ClickPayload) => void);
      case "doubleClick":
        return this.on("dblclick", handler as (p: ClickPayload) => void);
      case "crosshairMove":
        return this.on("crosshairMove", handler as (p: CrosshairPosition | undefined) => void);
      case "viewportChange":
        return this.on("visibleRangeChange", handler as (p: VisibleRangePayload) => void);
      default:
        throw new Error(`Unknown subscription: ${String(event)}`);
    }
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
    this.manager.clear();
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
    if (this.destroyed || !this.renderer || !this.manager.hasData()) return;
    const { from, to } = this.camera.range;
    // A manual price range is fully sticky: it is never re-fitted here. The
    // auto path (no manual override) is handled by effectiveRange via the
    // auto range cache, so the visible band either follows the user directly
    // or auto-fits to the visible data — never a mix that can snap back.
    const priceRange = this.priceScaleImpl.effectiveRange();
    if (!priceRange) return;
    const viewport = new Viewport(
      this.renderer.size,
      { from, to },
      priceRange,
    );
    this.currentViewport = viewport;
    for (const plugin of this.plugins) plugin.update?.(this);
    const renderable = this.manager.snapshot();
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

  private unionPriceRange(from: number, to: number): PriceRange | undefined {
    const { fromTime, toTime } = this.visibleTimeWindow(from, to);
    return this.manager.unionPriceRange(fromTime, toTime);
  }

  private visibleTimeWindow(from: number, to: number): { fromTime: number; toTime: number } {
    const data = this.manager.primary()?.data ?? [];
    if (data.length === 0) return { fromTime: 0, toTime: 0 };
    const lo = Math.max(0, Math.min(data.length - 1, Math.floor(from)));
    const hi = Math.max(0, Math.min(data.length - 1, Math.ceil(to)));
    return { fromTime: data[lo]?.time ?? 0, toTime: data[hi]?.time ?? 0 };
  }

  /** The current auto-fitted (padded) price range over the visible data. */
  private autoPriceRange(): PriceRange | undefined {
    const { from, to } = this.camera.range;
    const version = this.manager.dataVersion;
    const cached = this.autoRangeCache;
    // Reuse the last computed range unless the data or the visible window
    // changed — avoids a full union pass on every crosshair read (Step 7).
    if (
      cached !== undefined &&
      cached.version === version &&
      Math.abs(cached.from - from) < 1e-9 &&
      Math.abs(cached.to - to) < 1e-9
    ) {
      return cached.range;
    }
    const raw = this.unionPriceRange(from, to);
    if (!raw) {
      this.autoRangeCache = undefined;
      return undefined;
    }
    const range = padPriceRange(raw, this.options.pricePadding);
    this.autoRangeCache = { version, from, to, range };
    return range;
  }

  private emitDataChanged(): void {
    const size = this.manager.primaryLength();
    this.camera.clampToData(size, this.options.overscroll);
    this.bus.emit("data:changed", { size });
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
    const seriesData = this.manager.crosshairAt(time);
    return { x, y, index, price, time, seriesData };
  }

  private clickPayload(position: CrosshairPosition): ClickPayload {
    return {
      x: position.x,
      y: position.y,
      index: position.index,
      time: position.time,
      price: position.price,
    };
  }

  private timeAtIndex(index: number): number {
    const data = this.manager.primary()?.data ?? [];
    if (data.length === 0) return 0;
    const i = Math.max(0, Math.min(data.length - 1, Math.round(index)));
    return data[i]?.time ?? 0;
  }

  private assertAlive(): void {
    if (this.destroyed) throw new Error("Chart has been destroyed");
  }
}