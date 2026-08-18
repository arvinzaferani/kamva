/**
 * Tick generation for axes. Pure functions, no rendering concerns.
 */

/** "Nice" step sizes: 1, 2, 5 scaled by powers of ten. */
function niceStep(rawStep: number): number {
  if (rawStep <= 0 || !Number.isFinite(rawStep)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

/**
 * Evenly spaced round-number ticks covering [min, max].
 * `maxTicks` bounds the count; actual count depends on rounding.
 */
export function priceTicks(min: number, max: number, maxTicks = 8): number[] {
  if (!(max > min) || maxTicks < 1) return [];
  const step = niceStep((max - min) / maxTicks);
  const ticks: number[] = [];
  const start = Math.ceil(min / step) * step;
  // Guard against floating point drift producing an extra tick.
  for (let v = start; v <= max + step * 1e-9; v += step) {
    ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  }
  return ticks;
}

/**
 * Candle indices to label on the time axis: every `stride`-th index within
 * [from, to], stride chosen so labels are at least `minGap` candles apart.
 */
export function timeTickIndices(from: number, to: number, maxTicks = 10): number[] {
  if (!(to > from) || maxTicks < 1) return [];
  const span = to - from;
  const stride = Math.max(1, Math.ceil(span / maxTicks));
  const ticks: number[] = [];
  const start = Math.max(0, Math.ceil(from / stride) * stride);
  for (let i = start; i <= to; i += stride) {
    ticks.push(i);
  }
  return ticks;
}
