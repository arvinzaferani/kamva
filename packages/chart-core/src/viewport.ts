import type { PriceRange, Size, VisibleRange } from "./types.js";

/**
 * Pure coordinate mapping between domain space and pixel space.
 *
 * X: candle index -> x pixel (linear over the camera's visible range)
 * Y: price -> y pixel (linear, inverted, over the visible price range)
 *
 * A Viewport is a value object rebuilt each frame from camera + data;
 * it holds no mutable state, which makes renderers and plugins trivially
 * testable and keeps the render pipeline one-directional.
 */
export class Viewport {
  constructor(
    readonly size: Size,
    readonly visibleRange: VisibleRange,
    readonly priceRange: PriceRange,
  ) {}

  /** Width of one candle slot in pixels. */
  get candleWidth(): number {
    const span = this.visibleRange.to - this.visibleRange.from;
    return span > 0 ? this.size.width / span : 0;
  }

  xForIndex(index: number): number {
    const { from, to } = this.visibleRange;
    const span = to - from;
    if (span <= 0) return 0;
    return ((index - from) / span) * this.size.width;
  }

  indexForX(x: number): number {
    const { from, to } = this.visibleRange;
    return from + (x / this.size.width) * (to - from);
  }

  yForPrice(price: number): number {
    const { min, max } = this.priceRange;
    const span = max - min;
    if (span <= 0) return this.size.height / 2;
    return ((max - price) / span) * this.size.height;
  }

  priceForY(y: number): number {
    const { min, max } = this.priceRange;
    return max - (y / this.size.height) * (max - min);
  }
}

/** Expand a price range by a symmetric fractional padding (e.g. 0.05 = 5%). */
export function padPriceRange(range: PriceRange, padding: number): PriceRange {
  const span = range.max - range.min;
  const pad = span > 0 ? span * padding : Math.abs(range.max) * padding || 1;
  return { min: range.min - pad, max: range.max + pad };
}
