import type { Candle, Point, Size } from "./types.js";
import type { Viewport } from "./viewport.js";

/**
 * Minimal drawing surface plugins render into.
 *
 * Declared structurally (not the DOM's CanvasRenderingContext2D) so that
 * chart-core stays free of browser types. Renderers supply a concrete
 * implementation — the Canvas 2D context satisfies it as-is.
 */
export interface PluginDrawContext {
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
  /**
   * Draw the base frame for the given viewport and data. Plugins draw on
   * top via getPluginContext(); the crosshair-like overlay follows last,
   * so it always sits above plugin content.
   */
  render(viewport: Viewport, candles: readonly Candle[]): void;
  /** Draw the top overlay (crosshair, hover labels) above plugins. */
  drawOverlay?(viewport: Viewport, candles: readonly Candle[]): void;
  /** Draw surface plugins render into, or undefined when unsupported. */
  getPluginContext?(): PluginDrawContext | undefined;
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
  /**
   * Called every frame after the base chart has rendered. `ctx` is the
   * renderer's plugin surface (see getPluginContext); undefined when the
   * renderer does not support plugin drawing.
   */
  draw?(chart: ChartApi, viewport: Viewport, ctx: PluginDrawContext | undefined): void;
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
