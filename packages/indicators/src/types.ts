/**
 * Data shapes produced by indicator computations.
 *
 * Every series is aligned to candle indices: `values[i]` corresponds to
 * candle `i`, and `undefined` marks indices before the indicator has
 * warmed up (its first valid period).
 */

/** A value series aligned with candle indices; undefined = not computable yet. */
export type IndicatorSeries = ReadonlyArray<number | undefined>;

/** Vertical mapping for oscillator-style lines that do not share the price scale. */
export interface IndicatorValueDomain {
  readonly min: number;
  readonly max: number;
}

/** A single line (or bar) drawn by an indicator. */
export interface IndicatorLine {
  readonly values: IndicatorSeries;
  readonly color: string;
  readonly width?: number;
  readonly dashed?: boolean;
  /** Draw as vertical bars (e.g. MACD histogram) instead of a polyline. */
  readonly bars?: boolean;
  /**
   * Draw value[i] at candle index i + offset. Positive shifts right
   * (e.g. Ichimoku leading spans), negative shifts left (chikou span).
   */
  readonly offset?: number;
  /** When set, map values to this domain instead of the price scale. */
  readonly valueDomain?: IndicatorValueDomain;
  /** Fraction of pane height an oscillator band occupies. Default 0.25, bottom-anchored. */
  readonly heightFraction?: number;
}

/** A filled band between two series (e.g. the Ichimoku cloud). */
export interface IndicatorArea {
  readonly top: IndicatorSeries;
  readonly bottom: IndicatorSeries;
  /** Fill color — typically a translucent color. */
  readonly color: string;
  readonly offset?: number;
  readonly valueDomain?: IndicatorValueDomain;
  readonly heightFraction?: number;
}

/** Everything a plugin needs to draw one indicator. */
export interface IndicatorResult {
  readonly lines: readonly IndicatorLine[];
  readonly areas?: readonly IndicatorArea[];
}
