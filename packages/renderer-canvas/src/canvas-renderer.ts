import type {
  Candle,
  LineSeriesPoint,
  Point,
  RenderableSeries,
  Renderer,
  RenderSurface,
  Size,
  Viewport,
} from "@kamvachart/chart-core";
import {
  defaultFormatters,
  drawAxes,
  drawBackground,
  drawCandles,
  drawCrosshair,
  drawGrid,
  drawLineSeries,
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
 * background -> grid -> series -> axes, then plugins, then the crosshair
 * overlay. All layers render through the abstract RenderSurface (the 2D
 * context), and every phase uses an absolute transform so plugin and
 * crosshair coordinates land in the same CSS-pixel space as the candles.
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

  beginFrame(): void {
    this.ctx.save();
    // SetTransform (not scale) so every phase starts from the same CSS->device
    // mapping regardless of what the previous frame left behind.
    this.ctx.setTransform(this.devicePixelRatio(), 0, 0, this.devicePixelRatio(), 0, 0);
  }

  endFrame(): void {
    this.ctx.restore();
  }

  render(viewport: Viewport, series: readonly RenderableSeries[]): void {
    const theme = this.theme;
    const candles = firstCandleSeries(series) as RenderableSeries | undefined;
    const candleData = (candles?.data as readonly Candle[] | undefined) ?? [];
    drawBackground(this.ctx, viewport, theme);
    drawGrid(this.ctx, viewport, theme);
    for (const s of series) {
      if (s.type === "candles" && s.data.length > 0) {
        drawCandles(this.ctx, viewport, s.data as readonly Candle[], theme);
      } else if (s.type === "line" && candles !== undefined) {
        drawLineSeries(
          this.ctx,
          viewport,
          s.data as readonly LineSeriesPoint[],
          candleData,
          s.options.color ?? "#2962ff",
          s.options.lineWidth ?? 2,
        );
      }
    }
    drawAxes(this.ctx, viewport, candleData, theme, this.options.formatters ?? defaultFormatters);
  }

  /** Top overlay, drawn after plugins so the crosshair always stays on top. */
  drawOverlay(viewport: Viewport, _series: readonly RenderableSeries[]): void {
    if (!this.pointer) return;
    this.ctx.save();
    this.ctx.setTransform(this.devicePixelRatio(), 0, 0, this.devicePixelRatio(), 0, 0);
    drawCrosshair(
      this.ctx,
      viewport,
      this.pointer,
      this.theme,
      this.options.formatters ?? defaultFormatters,
    );
    this.ctx.restore();
  }

  /** The 2D context plugins draw into (CSS pixel space). */
  getPluginContext(): RenderSurface {
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

function firstCandleSeries(series: readonly RenderableSeries[]): RenderableSeries | undefined {
  for (const s of series) {
    if (s.type === "candles") return s;
  }
  return undefined;
}