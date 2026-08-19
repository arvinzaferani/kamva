import type { Candle, LineSeriesPoint, Point, Size } from "./types.js";
import type { Series, SeriesOptions, SeriesType } from "./series.js";
import type { Viewport } from "./viewport.js";
import type { PriceRange } from "./types.js";

/**
 * The abstract render surface every renderer exposes.
 *
 * Drawing goes through these primitives — never directly to a canvas or GPU
 * context — so the same scene can be produced by a Canvas 2D backend today
 * and a WebGL/WebGPU backend later. Declared structurally (not the DOM's
 * CanvasRenderingContext2D) so chart-core stays free of browser types; the
 * Canvas 2D context satisfies it as-is.
 */
export interface RenderSurface {
  save(): void;
  restore(): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  stroke(): void;
  fill(): void;
  setLineDash(segments: number[]): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  /**
   * String color or renderer-specific paint object (e.g. gradients).
   * Typed broadly so chart-core stays free of DOM canvas types.
   */
  strokeStyle: string | object;
  fillStyle: string | object;
  lineWidth: number;
  font: string;
  textAlign: string;
  textBaseline: string;
}

/**
 * A snapshot of one series handed to the renderer each frame. The type
 * selects which layer draws it; values are in the series' own domain
 * (candles or time/value points).
 */
export interface RenderableSeries {
  readonly id: string;
  readonly type: SeriesType;
  readonly options: Readonly<SeriesOptions>;
  readonly data: readonly Candle[] | readonly LineSeriesPoint[];
}

/**
 * Renderer contract.
 *
 * chart-core never touches a canvas or the DOM; a renderer package
 * (e.g. @kamvachart/renderer-canvas) implements this interface and is
 * injected into the Chart. This keeps the core framework- and surface-
 * agnostic and lets the scene render through any backend.
 */
export interface Renderer {
  /** Current drawing surface size in CSS pixels. */
  readonly size: Size;
  /** Start of a frame. Renderers refresh any per-frame state here. */
  beginFrame(): void;
  /** End of a frame, after base scene, plugins and overlay are drawn. */
  endFrame(): void;
  /** Draw the base scene (axes, grid, and each series by type). */
  render(viewport: Viewport, series: readonly RenderableSeries[]): void;
  /** Draw the top overlay (crosshair, hover labels) above plugins. */
  drawOverlay?(viewport: Viewport, series: readonly RenderableSeries[]): void;
  /** The surface plugins draw into, or undefined when unsupported. */
  getPluginContext?(): RenderSurface | undefined;
  /** Release all resources (contexts, listeners, DOM nodes). */
  destroy(): void;
}

/** Position under the crosshair resolved into chart domain space. */
export interface CrosshairPosition {
  readonly x: number;
  readonly y: number;
  /** Fractional candle index under the pointer. */
  readonly index: number;
  /** Mapped from the primary series at the pointer's index. */
  readonly time: number;
  /** Price at the pointer's pixel y on the shared price scale. */
  readonly price: number;
  /** The value under the crosshair for each visible series. */
  readonly seriesData: readonly CrosshairSeriesDatum[];
}

/** The value under the crosshair for one visible series. */
export interface CrosshairSeriesDatum {
  readonly id: string;
  readonly type: SeriesType;
  /** Time of the nearest datum to the crosshair. */
  readonly time: number;
  /** Close for candles, value for lines. */
  readonly value: number;
  readonly item: Candle | LineSeriesPoint;
}

/** Visible range change, in index space plus resolved times. */
export interface VisibleRangePayload {
  readonly from: number;
  readonly to: number;
  readonly fromTime: number;
  readonly toTime: number;
}

/**
 * User-facing subscription names and their payloads, exposed via
 * `chart.subscribe(name, handler)`.
 */
export interface ChartSubscriptions {
  /** Raw pointer position in chart pixels. */
  pointerMove: Point;
  /** A resolved click in domain space. */
  click: ClickPayload;
  /** A resolved double click in domain space. */
  doubleClick: ClickPayload;
  /** Crosshair resolution, or undefined when the pointer leaves the chart. */
  crosshairMove: CrosshairPosition | undefined;
  /** The visible time/index range changed (zoom, pan, fit). */
  viewportChange: VisibleRangePayload;
}

/** A click on the chart, resolved into domain space. */
export interface ClickPayload {
  readonly x: number;
  readonly y: number;
  readonly index: number;
  readonly time: number;
  readonly price: number;
}

/** Events emitted by the core. Payloads are stable public API. */
export interface ChartEvents extends Record<string, unknown> {
  /** Fired after data changes (setData/append/update/updateMany). */
  "data:changed": { size: number };
  /** Fired when the visible range changes (zoom/pan/fit). Semantic. */
  "visibleRangeChange": VisibleRangePayload;
  /** Raw camera index range changed (internal companion of visibleRangeChange). */
  "camera:changed": { from: number; to: number };
  /** Fired when the pointer moves over the chart, domain-resolved. */
  "crosshairMove": CrosshairPosition | undefined;
  /** Fired on a pointer click, domain-resolved. */
  click: ClickPayload;
  /** Fired on a double click, domain-resolved. */
  dblclick: ClickPayload;
  /** Raw pointer position (internal crosshair source). */
  "pointer:move": Point;
  /** Fired when the pointer leaves the chart. */
  "pointer:leave": undefined;
  /** Fired before the chart is destroyed. */
  destroy: undefined;
}

/**
 * Plugin contract (see PLUGIN_SYSTEM.md).
 *
 * Everything optional — indicators, drawing tools, exports — implements
 * this. Plugins receive the public ChartApi only; they never see
 * internals, so the core can evolve without breaking them.
 */
export interface Plugin {
  /** Unique name; adding two plugins with the same name is an error. */
  readonly name: string;
  initialize(chart: ChartApi): void;
  /** Called when data or camera changed, before draw. */
  update?(chart: ChartApi): void;
  /**
   * Called every frame after the base chart has rendered. `surface` is the
   * renderer's abstract draw surface (see getPluginContext); undefined when
   * the renderer does not support plugin drawing.
   */
  draw?(chart: ChartApi, viewport: Viewport, surface: RenderSurface | undefined): void;
  destroy?(): void;
}

/** A visible time-window in the chart's shared time coordinate system (unix seconds). */
export interface TimeRange {
  from: number;
  to: number;
}

/** The shared vertical (price) axis API, index-free for consumers. */
export interface PriceScaleApi {
  /** Map a price value to a pixel y-coordinate (0 = top of the pane). */
  valueToCoordinate(value: number): number;
  /** Map a pixel y-coordinate back to a price value. */
  coordinateToValue(coordinate: number): number;
  /** The currently displayed price range (auto or manual). */
  getVisibleRange(): PriceRange;
  /** Force a visible price range; disables auto-scaling. */
  setVisibleRange(range: PriceRange): void;
  /** Shift the visible price range by a price amount (takes manual control). */
  panPrice(byPrice: number): void;
}

/**
 * The public time-axis API. Time is the single coordinate system every
 * series shares; this keeps the surface index-free for consumers.
 */
export interface TimeScaleApi {
  /** Show all content of every visible series. */
  fitContent(): void;
  /** Reset to the full extent of the primary (x-axis) series. */
  reset(): void;
  /** Set the visible window in time. */
  setVisibleRange(range: TimeRange): void;
  /** The currently visible time window. */
  getVisibleRange(): TimeRange;
  /** Subscribe to visible-range changes; returns an unsubscribe function. */
  subscribe(handler: (range: TimeRange) => void): () => void;
}

/**
 * The public surface plugins and applications program against.
 * Kept minimal on purpose; extending it is a semver-minor event.
 */
export interface ChartApi {
  addCandlestickSeries(options?: SeriesOptions): Series<Candle>;
  addLineSeries(options?: SeriesOptions): Series<LineSeriesPoint>;
  setData(candles: readonly Candle[]): void;
  append(candle: Candle): void;
  update(candle: Candle): void;
  /** Remove a series by its id (id from `series.id`). */
  /** Remove a series by its id (from `series.id`). */
  removeSeries(id: string): void;
  zoom(factor: number, anchor?: number): void;
  pan(candles: number): void;
  /** Shift the vertical price axis by a price amount (takes manual control). */
  panPrice(byPrice: number): void;
  fit(): void;
  /** The shared time axis for all series. */
  timeScale(): TimeScaleApi;
  /** The shared vertical (price) axis for all series on the default scale. */
  priceScale(): PriceScaleApi;
  /** Vertical zoom: factor > 1 zooms into the price axis, < 1 zooms out. Anchor 0=bottom,1=top. */
  zoomPrice(factor: number, anchorY?: number): void;
  on<K extends keyof ChartEvents>(event: K, handler: (payload: ChartEvents[K]) => void): () => void;
  /** Subscribe to a user-facing event by name; returns an unsubscribe function. */
  subscribe<E extends keyof ChartSubscriptions>(
    event: E,
    handler: (payload: ChartSubscriptions[E]) => void,
  ): () => void;
  readonly data: readonly Candle[];
  readonly viewport: Viewport | undefined;
}