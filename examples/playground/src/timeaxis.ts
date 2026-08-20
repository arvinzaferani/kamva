/**
 * Time-axis label formatting. Pure + testable (no chart / DOM coupling).
 */

const HM = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
const DHM = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const MD = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const MY = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });

const HOUR = 3_600_000;
const DAY = 86_400_000;

/**
 * Pick a label style from the visible time span so the axis reads naturally:
 *   < 12h            -> 14:05
 *   < 3 days         -> Feb 4 14:05
 *   < 30 days        -> Feb 4
 *   otherwise        -> Feb 2026
 */
export function formatTimeForSpan(time: number, spanMs: number): string {
  const d = new Date(time);
  if (spanMs < 12 * HOUR) return HM.format(d);
  if (spanMs < 3 * DAY) return DHM.format(d);
  if (spanMs < 30 * DAY) return MD.format(d);
  return MY.format(d);
}

/** Helper for callers that only know the candle interval, not the zoom span. */
export function formatTimeForInterval(time: number, intervalMs: number): string {
  return formatTimeForSpan(time, intervalMs * 40);
}