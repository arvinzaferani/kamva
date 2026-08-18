import type { VisibleRange } from "./types.js";

/**
 * The camera controls which slice of the candle series is visible.
 *
 * It works purely in index space (candle indices, fractional allowed);
 * mapping to pixels is the scales' job. This keeps zoom/pan independent
 * of both data values and screen size.
 */
export class Camera {
  private from = 0;
  private to = 0;
  private minVisible: number;
  private maxVisible: number;

  constructor(options?: { minVisibleCandles?: number; maxVisibleCandles?: number }) {
    this.minVisible = options?.minVisibleCandles ?? 2;
    this.maxVisible = options?.maxVisibleCandles ?? 100_000;
  }

  get range(): VisibleRange {
    return { from: this.from, to: this.to };
  }

  get span(): number {
    return this.to - this.from;
  }

  /** Set the visible range directly (used by fit and programmatic navigation). */
  setRange(from: number, to: number): void {
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return;
    this.from = from;
    this.to = to;
  }

  /**
   * Zoom by `factor` around an anchor expressed as a fraction of the
   * visible width (0 = left edge, 1 = right edge). factor > 1 zooms in.
   */
  zoom(factor: number, anchor = 0.5): void {
    if (!Number.isFinite(factor) || factor <= 0) return;
    const span = this.span;
    const newSpan = Math.min(this.maxVisible, Math.max(this.minVisible, span / factor));
    if (newSpan === span) return;
    const anchorIndex = this.from + span * anchor;
    this.from = anchorIndex - newSpan * anchor;
    this.to = this.from + newSpan;
  }

  /** Pan by a number of candles (positive moves the view to newer candles). */
  pan(candles: number): void {
    if (!Number.isFinite(candles)) return;
    this.from += candles;
    this.to += candles;
  }

  /**
   * Keep the view within data bounds, allowing `overscroll` candles of
   * empty space at either end so users can pan slightly past the data.
   */
  clampToData(dataSize: number, overscroll = 0): void {
    if (dataSize <= 0) return;
    const span = this.span;
    const minFrom = -overscroll;
    const maxTo = dataSize - 1 + overscroll;
    if (this.from < minFrom) {
      this.from = minFrom;
      this.to = this.from + span;
    }
    if (this.to > maxTo) {
      this.to = maxTo;
      this.from = this.to - span;
    }
  }

  /** Fit the whole series (or its last `maxCandles`) into view with a small right margin. */
  fit(dataSize: number, maxCandles = Infinity): void {
    if (dataSize <= 0) return;
    const count = Math.min(dataSize, maxCandles);
    const to = dataSize - 1 + Math.max(1, count * 0.05);
    const from = dataSize - count;
    this.setRange(from, to);
  }
}
