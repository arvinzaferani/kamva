import type { Candle, Point, Size } from "./types.js";
import type { Viewport } from "./viewport.js";

/**
 * Renderer contract.
 *
 * chart-core never touches a canvas or the DOM; a renderer package
 * (e.g. @kamvachart/renderer-canvas) implements this interface and is
 * injected into the Chart. This is what keeps the core framework- and
 * surface-agnostic (Canvas today, WebGL/Offscreen later).
 */
export interface Renderer {
  /** Current drawing surface size in CSS pixels. */
  readonly size: Size;
  /** Draw a full frame for the given viewport and data. */
  render(viewport: Viewport, candles: readonly Candle[]): void;
  /** Release all resources (contexts, listeners, DOM nodes). */
  destroy(): void;
}

/** Events emitted by the core. Payloads are stable public API. */
export interface ChartEvents extends Record<string, unknown> {
  /** Fired after data changes (setData/append/update). */
  "data:changed": { size: number };
  /** Fired when the visible range changes (zoom/pan/fit). */
  "camera:changed": { from: number; to: number };
  /** Fired when the pointer moves over the chart (crosshair source). */
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
  /** Called every frame after the base chart has rendered. */
  draw?(chart: ChartApi, viewport: Viewport): void;
  destroy?(): void;
}

/**
 * The public surface plugins and applications program against.
 * Kept minimal on purpose; extending it is a semver-minor event.
 */
export interface ChartApi {
  setData(candles: readonly Candle[]): void;
  append(candle: Candle): void;
  update(candle: Candle): void;
  zoom(factor: number, anchor?: number): void;
  pan(candles: number): void;
  fit(): void;
  on<K extends keyof ChartEvents>(event: K, handler: (payload: ChartEvents[K]) => void): () => void;
  readonly data: readonly Candle[];
  readonly viewport: Viewport | undefined;
}
