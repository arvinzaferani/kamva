# Indicators

Indicators come in two layers:

- **Factories** return a `Plugin` you add with `chart.use(...)`. They draw on the
  chart and come with sensible defaults.
- **Pure `compute*` functions** take candles and return arrays of values, with no
  drawing. Use them for headless work, backtests, or custom rendering.

Both are exported from `kamvachart`.

## Overlay indicators (share the price scale)

| Factory | Options | Default period | Default color |
| --- | --- | --- | --- |
| `sma` | `{ period: number, color?, width?, dashed? }` | *required* | teal `#26a69a` |
| `ema` | `{ period: number, color?, width?, dashed? }` | *required* | blue `#2962ff` |
| `bollingerBands` | `{ period?, multiplier?, middleColor?, bandColor?, width? }` | 20, 2 | middle orange, band gray |
| `vwap` | `{ color?, width?, dashed? }` | cumulative | gray `#787b86` |
| `atr` | `{ period?, color?, width?, dashed? }` | 14 | orange `#ff9800` |

`LineStyle` (on the `sma`/`ema`/`vwap`/`atr` options) is `{ color?, width?, dashed? }`.

```ts
chart.use(sma({ period: 20, color: "#26a69a", width: 1.5 }));
chart.use(ema({ period: 50 }));
chart.use(bollingerBands({ period: 20, multiplier: 2 }));
chart.use(vwap());
```

## Oscillator indicators (drawn in a bottom band)

| Factory | Options | Default | Notes |
| --- | --- | --- | --- |
| `rsi` | `{ period?, color?, width?, dashed? }` | 14 | 0–100 band, 25% height |
| `macd` | `{ fast?, slow?, signal?, macdColor?, signalColor?, histogramColor?, width? }` | 12, 26, 9 | line + signal + histogram |

```ts
chart.use(rsi({ period: 14 }));
chart.use(macd({}));
chart.use(macd({ fast: 8, slow: 21, signal: 5 }));
```

`macd` requires `fast < slow` and throws otherwise.

## Ichimoku

| Factory | Options (defaults) | |
| --- | --- | --- |
| `ichimoku` | `conversionPeriods?` (9) · `basePeriods?` (26) · `spanBPeriods?` (52) · `displacement?` (26) · `tenkanColor?` · `kijunColor?` · `senkouAColor?` · `senkouBColor?` · `chikouColor?` · `cloudColor?` | Cloud overlay |

```ts
chart.use(ichimoku());
```

## Pure computation functions

Each `compute*` function returns a series array `(number | undefined)[]` aligned
with the input candles. Values before the warm‑up are `undefined`.

| Function | Signature |
| --- | --- |
| `computeSMA` | `(candles, period) => series` |
| `computeEMA` | `(candles, period) => series` |
| `computeRSI` | `(candles, period) => series` |
| `computeVWAP` | `(candles) => series` |
| `computeATR` | `(candles, period) => series` |
| `computeBollinger` | `(candles, period, multiplier) => { middle, upper, lower }` |
| `computeMACD` | `(candles, fast?, slow?, signal?) => { macd, signal, histogram }` |
| `computeIchimoku` | `(candles, { conversionPeriods, basePeriods, spanBPeriods, displacement }) => { tenkan, kijun, chikou, senkouA, senkouB }` |

```ts
import { computeSMA } from "kamvachart";

const sma20 = computeSMA(candles, 20);
const latest = sma20[sma20.length - 1]; // number | undefined
```