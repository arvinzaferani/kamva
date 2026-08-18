/**
 * Mock OHLCV data for demos: a random walk with trend regimes and
 * volatility clustering so it looks like a real market, not noise.
 */
export function generateCandles(count, options = {}) {
  const {
    startPrice = 100,
    startTime = Date.now() - count * 60_000,
    intervalMs = 60_000,
  } = options;

  const candles = [];
  let price = startPrice;
  let time = startTime;
  let trend = 0; // drift per candle
  let volatility = 0.6;

  for (let i = 0; i < count; i++) {
    // Occasionally switch trend regime (bull / bear / sideways).
    if (Math.random() < 0.01) trend = (Math.random() - 0.5) * 0.35;
    // Volatility clustering: drifts slowly, clamped to a sane band.
    volatility = Math.min(2.5, Math.max(0.2, volatility + (Math.random() - 0.5) * 0.08));

    const open = price;
    const move = trend + (Math.random() - 0.5) * 2 * volatility;
    const close = Math.max(1, open + move);
    const wickUp = Math.random() * volatility * 0.8;
    const wickDown = Math.random() * volatility * 0.8;
    const high = Math.max(open, close) + wickUp;
    const low = Math.max(0.5, Math.min(open, close) - wickDown);
    const volume = Math.round(500 + Math.random() * 1500 * (1 + Math.abs(move)));

    candles.push({ time, open, high, low, close, volume });
    price = close;
    time += intervalMs;
  }
  return candles;
}

/** Mutate-free helper: next tick of a candle (for simulating live updates). */
export function tickCandle(candle, volatility = 0.4) {
  const close = Math.max(1, candle.close + (Math.random() - 0.5) * volatility);
  return {
    ...candle,
    close,
    high: Math.max(candle.high, close),
    low: Math.min(candle.low, close),
  };
}

/** New empty candle continuing from the previous one. */
export function nextCandle(prev, intervalMs = 60_000) {
  return {
    time: prev.time + intervalMs,
    open: prev.close,
    high: prev.close,
    low: prev.close,
    close: prev.close,
    volume: 0,
  };
}
