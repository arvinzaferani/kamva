import type { Candle, Point, PluginDrawContext, Renderer, Size, Viewport } from "@kamvachart/chart-core";
import {
  defaultFormatters,
  drawAxes,
  drawBackground,
  drawCandles,
  drawCrosshair,
  drawGrid,
  type AxisFormatters,
} from "./layers.js";
import { darkTheme, type Theme } from "./theme.js";

export interface CanvasRendererOptions {
  theme?: Theme;
  formatters?: AxisFormatters;
}

/**
 * Canvas 2D implementation of the chart-core Renderer contract.
 *
 * Owns the canvas element sizing (device pixel ratio aware) and composes
 * the layer draw functions in pipeline order:
 * background -> grid -> candles -> axes -> crosshair.
 */
export class CanvasRenderer implements Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private cssSize: Size = { width: 0, height: 0 };
  private pointer: Point | undefined;
  private readonly resizeObserver: ResizeObserver | undefined;
  private onResized: (() => void) | undefined;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly options: CanvasRendererOptions = {},
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context is not available");
    this.ctx = ctx;
    this.syncSize();
    if (typeof ResizeObserver === "function") {
      this.resizeObserver = new ResizeObserver(() => {
        this.syncSize();
        this.onResized?.();
      });
      this.resizeObserver.observe(canvas);
    }
  }

  get size(): Size {
    return this.cssSize;
  }

  get theme(): Theme {
    return this.options.theme ?? darkTheme;
  }

  /** Called by createChart so a resize triggers a re-render. */
  setResizeCallback(cb: () => void): void {
    this.onResized = cb;
  }

  /** Crosshair position in CSS pixels, or undefined to hide it. */
  setPointer(point: Point | undefined): void {
    this.pointer = point;
  }

  render(viewport: Viewport, candles: readonly Candle[]): void {
    const formatters = this.options.formatters ?? defaultFormatters;
    const theme = this.theme;
    const ctx = this.ctx;
    ctx.save();
    // SetTransform (not scale) so every phase starts from the same CSS->device
    // mapping regardless of what the previous phase left on the stack.
    ctx.setTransform(this.devicePixelRatio(), 0, 0, this.devicePixelRatio(), 0, 0);
    drawBackground(ctx, viewport, theme);
    drawGrid(ctx, viewport, theme);
    drawCandles(ctx, viewport, candles, theme);
    drawAxes(ctx, viewport, candles, theme, formatters);
    ctx.restore();
  }

  /**
   * Top overlay, drawn after plugins so the crosshair always stays on top.
   */
  drawOverlay(viewport: Viewport, _candles: readonly Candle[]): void {
    if (!this.pointer) return;
    const formatters = this.options.formatters ?? defaultFormatters;
    const theme = this.theme;
    this.ctx.save();
    this.ctx.setTransform(this.devicePixelRatio(), 0, 0, this.devicePixelRatio(), 0, 0);
    drawCrosshair(this.ctx, viewport, this.pointer, theme, formatters);
    this.ctx.restore();
  }

  /**
   * The 2D context plugins draw into. Returns the context already mapped to
   * CSS-pixel space (same DPR transform the base layers use), so plugin
   * coordinates from the viewport land in the same place as the candles.
   */
  getPluginContext(): PluginDrawContext {
    this.ctx.setTransform(this.devicePixelRatio(), 0, 0, this.devicePixelRatio(), 0, 0);
    return this.ctx;
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.onResized = undefined;
  }

  private devicePixelRatio(): number {
    return typeof devicePixelRatio === "number" ? devicePixelRatio : 1;
  }

  /** Match the backing store to the element's CSS size × DPR. */
  private syncSize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || this.canvas.width;
    const height = rect.height || this.canvas.height;
    const dpr = this.devicePixelRatio();
    const deviceWidth = Math.max(1, Math.round(width * dpr));
    const deviceHeight = Math.max(1, Math.round(height * dpr));
    if (this.canvas.width !== deviceWidth) this.canvas.width = deviceWidth;
    if (this.canvas.height !== deviceHeight) this.canvas.height = deviceHeight;
    this.cssSize = { width, height };
  }
}
