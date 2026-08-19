import type { PriceRange } from "./types.js";

export interface PriceScaleApi {
  /** Map a price value to a pixel y-coordinate (0 = top of the pane). */
  valueToCoordinate(value: number): number;
  /** Map a pixel y-coordinate back to a price value. */
  coordinateToValue(coordinate: number): number;
  /** The currently displayed price range (manual override or auto-scaled). */
  getVisibleRange(): PriceRange;
  /** Force a specific visible price range; disables auto-scaling. */
  setVisibleRange(range: PriceRange): void;
}

export interface PriceScaleDeps {
  /** Current pixel height of the pane (0 until a renderer is attached). */
  getHeight(): number;
  /** The auto-computed range over all visible series that share this scale. */
  getAutoRange(): PriceRange | undefined;
  /** Mark the chart dirty so a redraw reflects the new range. */
  invalidate(): void;
}

/**
 * The shared vertical (price) abstraction for every series. A single,
 * index-space Camera + Viewport handle navigation; PriceScale owns only the
 * stateful question "what price range is on screen" and the value<->pixel
 * conversion for that range.
 *
 * Auto-matic scaling is a thin wrapper around the renderer's per-frame union
 * of the visible data. Once the user sets a manual range (via
 * setVisibleRange / panPrice / zoomPrice), the band is fully sticky: it only
 * moves when the user moves it, and never "follows" the data on its own. This
 * is the predictable TradingView-style behavior (scale-price-off) and is why
 * drags feel 1:1: a vertical pan cannot be yanked back by any auto fit.
 *
 * The conversion formulas mirror Viewport.yForPrice/priceForY so that series,
 * renderers and the scale always agree — the math is never re-derived per
 * series.
 */
export class PriceScale implements PriceScaleApi {
  /** The range the user set (via setVisibleRange/panPrice/zoomPrice). */
  private userRange: PriceRange | undefined;

  constructor(private readonly deps: PriceScaleDeps) {}

  valueToCoordinate(value: number): number {
    const range = this.effectiveRange();
    const height = this.deps.getHeight();
    if (range === undefined || height <= 0) return NaN;
    const span = range.max - range.min;
    if (span <= 0) return height / 2;
    return ((range.max - value) / span) * height;
  }

  coordinateToValue(coordinate: number): number {
    const range = this.effectiveRange();
    const height = this.deps.getHeight();
    if (range === undefined || height <= 0) return NaN;
    return range.max - (coordinate / height) * (range.max - range.min);
  }

  getVisibleRange(): PriceRange {
    return this.effectiveRange() ?? { min: 0, max: 0 };
  }

  setVisibleRange(range: PriceRange): void {
    if (!Number.isFinite(range.min) || !Number.isFinite(range.max)) {
      throw new Error("PriceScale: visible range min/max must be finite numbers");
    }
    if (range.min >= range.max) {
      throw new Error("PriceScale: visible range requires min < max");
    }
    this.userRange = { min: range.min, max: range.max };
    this.deps.invalidate();
  }

  /** Shift the current on-screen range by a price amount, taking manual control. */
  panPrice(byPrice: number): void {
    if (!Number.isFinite(byPrice) || byPrice === 0) return;
    // The very first vertical move freezes whatever auto range is showing;
    // afterwards the band shifts by exactly `byPrice` relative to the manual
    // range, so it tracks the pointer 1:1 with no accumulation.
    const current = this.userRange ?? this.deps.getAutoRange();
    if (current === undefined) return;
    const min = current.min + byPrice;
    const max = current.max + byPrice;
    if (!(min < max)) return;
    this.setVisibleRange({ min, max });
  }

  /** The range currently on screen: manual override when set, else auto. */
  effectiveRange(): PriceRange | undefined {
    return this.userRange ?? this.deps.getAutoRange();
  }

  /** Whether a user range overrides auto-scaling. */
  isManual(): boolean {
    return this.userRange !== undefined;
  }

  /** Drop any manual override and return to auto-scaling. */
  autoscale(): void {
    if (this.userRange === undefined) return;
    this.userRange = undefined;
    this.deps.invalidate();
  }
}