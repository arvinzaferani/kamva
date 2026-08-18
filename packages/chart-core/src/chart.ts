import { Camera } from "./camera.js";
import type { ChartApi, ChartEvents, Plugin, Renderer } from "./contracts.js";
import { DataStore } from "./data-store.js";
import { EventBus } from "./event-bus.js";
import type { Candle } from "./types.js";
import { padPriceRange, Viewport } from "./viewport.js";

export interface ChartOptions {
  /** Fractional padding above/below the visible price range. Default 0.08. */
  pricePadding?: number;
  /** Candles of empty space allowed past either end when panning. Default 5. */
  overscroll?: number;
}

/**
 * Chart is the facade over state (DataStore), navigation (Camera) and
 * output (Renderer). It owns the frame scheduling: any mutation marks the
 * chart dirty and a single render is coalesced per animation frame, so
 * bursts of appends/pans cost one draw (see PERFORMANCE.md).
 *
 * Renderers are injected, never imported — chart-core has zero DOM/canvas
 * dependencies (see ARCHITECTURE.md).
 */
export class Chart implements ChartApi {
  private readonly store = new DataStore();
  private readonly camera = new Camera();
  private readonly bus = new EventBus<ChartEvents>();
  private readonly plugins: Plugin[] = [];
  private readonly options: Required<ChartOptions>;
  private renderer: Renderer | undefined;
  private currentViewport: Viewport | undefined;
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
  }

  /** Attach the output renderer. The chart takes ownership and destroys it with itself. */
  attachRenderer(renderer: Renderer): void {
    this.assertAlive();
    this.renderer = renderer;
    this.invalidate();
  }

  // ---- data -------------------------------------------------------------

  get data(): readonly Candle[] {
    return this.store.all;
  }

  get viewport(): Viewport | undefined {
    return this.currentViewport;
  }

  setData(candles: readonly Candle[]): void {
    this.assertAlive();
    this.store.setData(candles);
    this.camera.fit(this.store.size, 200);
    this.emitDataChanged();
  }

  append(candle: Candle): void {
    this.assertAlive();
    const wasAtEnd = this.camera.range.to >= this.store.size - 1;
    this.store.append(candle);
    // Follow the live edge only if the user was already looking at it.
    if (wasAtEnd) this.camera.pan(1);
    this.emitDataChanged();
  }

  update(candle: Candle): void {
    this.assertAlive();
    this.store.update(candle);
    this.emitDataChanged();
  }

  // ---- navigation -------------------------------------------------------

  zoom(factor: number, anchor = 0.5): void {
    this.assertAlive();
    this.camera.zoom(factor, anchor);
    this.camera.clampToData(this.store.size, this.options.overscroll);
    this.emitCameraChanged();
  }

  pan(candles: number): void {
    this.assertAlive();
    this.camera.pan(candles);
    this.camera.clampToData(this.store.size, this.options.overscroll);
    this.emitCameraChanged();
  }

  fit(): void {
    this.assertAlive();
    this.camera.fit(this.store.size);
    this.emitCameraChanged();
  }

  // ---- events -----------------------------------------------------------

  on<K extends keyof ChartEvents>(
    event: K,
    handler: (payload: ChartEvents[K]) => void,
  ): () => void {
    return this.bus.on(event, handler);
  }

  /** Internal emit for renderers/interaction controllers. */
  emit<K extends keyof ChartEvents>(event: K, payload: ChartEvents[K]): void {
    this.bus.emit(event, payload);
    if (event === "pointer:move" || event === "pointer:leave") this.invalidate();
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
    this.store.clear();
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
    if (this.destroyed || !this.renderer || this.store.size === 0) return;
    const { from, to } = this.camera.range;
    const rawRange = this.store.priceRange(from, to);
    if (!rawRange) return;
    const viewport = new Viewport(
      this.renderer.size,
      { from, to },
      padPriceRange(rawRange, this.options.pricePadding),
    );
    this.currentViewport = viewport;
    for (const plugin of this.plugins) plugin.update?.(this);
    // base layers (background, grid, candles, axes)
    this.renderer.render(viewport, this.store.all);
    // plugin overlays (indicators, drawing tools) sit below the crosshair
    const ctx = this.renderer.getPluginContext?.();
    for (const plugin of this.plugins) plugin.draw?.(this, viewport, ctx);
    this.renderer.drawOverlay?.(viewport, this.store.all);
  }

  // ---- internals --------------------------------------------------------

  private emitDataChanged(): void {
    this.camera.clampToData(this.store.size, this.options.overscroll);
    this.bus.emit("data:changed", { size: this.store.size });
    this.invalidate();
  }

  private emitCameraChanged(): void {
    const { from, to } = this.camera.range;
    this.bus.emit("camera:changed", { from, to });
    this.invalidate();
  }

  private assertAlive(): void {
    if (this.destroyed) throw new Error("Chart has been destroyed");
  }
}
