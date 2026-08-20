# kamvachart — Reference

The `kamvachart` package is a single, zero‑dependency entry point to **KamvaChart**, a
framework‑agnostic, Canvas‑based financial charting engine. It bundles the internal
packages — `@kamvachart/chart-core`, `@kamvachart/renderer-canvas` and
`@kamvachart/indicators` — behind one curated public API.

```bash
npm install kamvachart
```

```ts
import { createChart, sma, ema } from "kamvachart";
```

## Guides

| Guide | What it covers |
| --- | --- |
| [Getting started](./getting-started.md) | Install, your first chart, data, realtime updates, events |
| [API reference](./api.md) | Every export: `createChart`, `Chart`, series, scales, types |
| [Indicators](./indicators.md) | Each indicator factory, its options, and the pure `compute*` functions |
| [Concepts](./concepts.md) | Data model, the primary series, coordinates, zoom & pan semantics |
| [Interaction & styling](./interaction.md) | Gestures, theming, axis formatters, tooltips |
| [Extending](./extending.md) | Writing your own plugins |

## What's exported

### Chart * engine

- `createChart(canvas, options?)` → `Chart`
- `Chart` — the main object
- `CanvasRenderer` — the Canvas 2D renderer (with `darkTheme` / `lightTheme`)
- Option types: `ChartOptions`, `CreateChartOptions`, `CanvasRendererOptions`

**Types:** `Candle`, `LineSeriesPoint`, `Series`, `SeriesOptions`, `Plugin`,
`ChartApi`, `ChartEvents`, `ChartSubscriptions`, `CrosshairPosition`,
`VisibleRange`, `TimeScaleApi`, `PriceScaleApi`, `PriceRange`

### Technical indicators

- Factories (overlay plugins): `sma`, `ema`, `rsi`, `macd`, `bollingerBands`,
  `vwap`, `atr`, `ichimoku`
- Pure computation (headless): `computeSMA`, `computeEMA`, `computeRSI`,
  `computeMACD`, `computeBollinger`, `computeVWAP`, `computeATR`, `computeIchimoku`
- Option types: `SmaOptions`, `EmaOptions`, `RsiOptions`, `MacdOptions`,
  `BollingerOptions`, `VwapOptions`, `AtrOptions`, `IchimokuOptions`

## Quick example

```ts
import { createChart, sma, bollingerBands } from "kamvachart";
import type { Candle } from "kamvachart";

const canvas = document.getElementById("chart") as HTMLCanvasElement;
const chart = createChart(canvas);

const candle: Candle = { time: 1720000000000, open: 1, high: 3, low: 0.5, close: 2, volume: 10 };

chart.setData([candle]);
chart.use(sma({ period: 20, color: "#26a69a" }));
chart.use(bollingerBands());

chart.subscribe("crosshairMove", (pos) => {
  console.log(pos?.price, pos?.time);
});
```

> Completion: KamvaChart ships typed declarations, so editors get full autocomplete
> for every option and method documented here.