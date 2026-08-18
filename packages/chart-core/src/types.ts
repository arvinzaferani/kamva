/**
 * Core data types for KamvaChart.
 *
 * All time values are UNIX timestamps in milliseconds.
 */

/** A single OHLCV candle. `time` must be strictly increasing across a series. */
export interface Candle {
  readonly time: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume?: number;
}

/** Inclusive range of candle indices currently visible. Fractional bounds allow sub-candle panning. */
export interface VisibleRange {
  readonly from: number;
  readonly to: number;
}

/** Inclusive price range. */
export interface PriceRange {
  readonly min: number;
  readonly max: number;
}

/** Pixel size of the drawing surface in CSS pixels. */
export interface Size {
  readonly width: number;
  readonly height: number;
}

/** A point in CSS pixel space, relative to the chart's top-left corner. */
export interface Point {
  readonly x: number;
  readonly y: number;
}
