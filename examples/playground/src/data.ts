export interface CandleInput {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Deterministic PRNG (mulberry32) so the demo is stable across reloads. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface SymbolProfile {
  label: string;
  base: number;
  volatility: number;
  trend: number;
  seed: number;
}

const PROFILES: Record<string, SymbolProfile> = {
  BTC: { label: "BTC / USD", base: 64821, volatility: 1.4, trend: 0.03, seed: 101 },
  ETH: { label: "ETH / USD", base: 3520, volatility: 1.7, trend: 0.05, seed: 202 },
  VOL: { label: "Volatile / USD", base: 100, volatility: 4.2, trend: -0.02, seed: 303 },
};

export type SymbolKey = keyof typeof PROFILES;

export const SYMBOLS = Object.keys(PROFILES) as SymbolKey[];

/** Timeframe presets offered in the demo. */
export interface Timeframe {
  label: string;
  ms: number;
  count: number;
}

export const TIMEFRAMES: Timeframe[] = [
  { label: "1m", ms: 60_000, count: 1500 },
  { label: "5m", ms: 300_000, count: 900 },
  { label: "1h", ms: 3_600_000, count: 720 },
  { label: "1D", ms: 86_400_000, count: 420 },
];

const REF_MS = 86_400_000; // 24h reference window for the header change

/**
 * Generate `count` OHLCV candles as a random walk with trend regimes and
 * volatility clustering, seeded per symbol so it looks like a market.
 * Volatility is scaled by the timeframe (larger intervals move more).
 */
export function generateCandles(
  count: number,
  symbol: SymbolKey,
  intervalMs = TIMEFRAMES[0]!.ms,
): CandleInput[] {
  const { base, volatility, trend, seed } = PROFILES[symbol]!;
  const rand = mulberry32(seed);
  const volScale = Math.sqrt(intervalMs / TIMEFRAMES[0]!.ms);
  const now = Date.now();
  const candles: CandleInput[] = [];
  let price = base;
  let time = now - count * intervalMs;
  let drift = trend;
  let vol = volatility * volScale;

  for (let i = 0; i < count; i++) {
    if (rand() < 0.012) drift = trend + (rand() - 0.5) * 0.4;
    vol = Math.min(
      volatility * 1.9 * volScale,
      Math.max(volatility * 0.35, vol + (rand() - 0.5) * 0.15 * volScale),
    );

    const open = price;
    const move = drift + (rand() - 0.5) * 2 * vol;
    const close = Math.max(1, open + move);
    const wickUp = rand() * vol * 0.9;
    const wickDown = rand() * vol * 0.9;
    const high = Math.max(open, close) + wickUp;
    const low = Math.max(0.5, Math.min(open, close) - wickDown);
    const volume = Math.round(500 + rand() * 2000 * (1 + Math.abs(move)));

    candles.push({ time, open, high, low, close, volume });
    price = close;
    time += intervalMs;
  }
  return candles;
}

/** A live tick on the current candle (no mutation of the input). */
export function tickCandle(candle: CandleInput, volatility = 0.4): CandleInput {
  const close = Math.max(1, candle.close + (Math.random() - 0.5) * volatility);
  return {
    ...candle,
    close,
    high: Math.max(candle.high, close),
    low: Math.min(candle.low, close),
  };
}

/** A brand-new candle continuing from the previous one. */
export function nextCandle(prev: CandleInput, intervalMs: number): CandleInput {
  return {
    time: prev.time + intervalMs,
    open: prev.close,
    high: prev.close,
    low: prev.close,
    close: prev.close,
    volume: 0,
  };
}

/** Index `n` 24h-bars ago, used to derive the header's change. */
export function refIndex(length: number, intervalMs: number): number {
  return Math.max(0, length - 1 - Math.round(REF_MS / intervalMs));
}