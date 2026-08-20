# Getting started

## Install

```bash
npm install kamvachart
# or
pnpm add kamvachart
# or
yarn add kamvachart
```

`kamvachart` has **zero runtime dependencies** and ships TypeScript declarations.
It targets `node >= 18` and modern browsers (ES2022, Canvas 2D).

## Your first chart

Give the chart a canvas element. `createChart` wires rendering **and** interaction
(pan, zoom, crosshair) to it and returns a `Chart`.

```ts
import { createChart } from "kamvachart";
import type { Candle } from "kamvachart";

const canvas = document.getElementById("chart") as HTMLCanvasElement;
const chart = createChart(canvas);
```

Feed it OHLCV candles. `setData` creates the primary (x‑axis reference) candle
series for you and fits the view to the data.

```ts
const candles: Candle[] = [
  { time: 1720000000000, open: 100, high: 110, low: 99, close: 108, volume: 1200 },
  // ...more, sorted by strictly increasing `time`
];
chart.setData(candles);
```

## Data model

A candle is:

```ts
interface Candle {
  time: number;   // UNIX timestamp in MILLISECONDS, strictly increasing
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}
```

- All `time` values are **milliseconds** (not seconds).
- A series' times must be **strictly increasing**. `setData` / `append` /
  `updateMany` validate this and throw otherwise.
- `high`/`low`/`open`/`close` must be finite numbers.

## Realtime updates

Two methods cover live data:

- `chart.update(candle)` — replace the **last** candle (a real‑time tick). The
  `time` must equal the current last candle's time.
- `chart.append(candle)` — add a **new** candle with a `time` greater than the last.

```ts
// tick the current candle
chart.update({ ...lastCandle, close: 101.5 });

// open a new candle
chart.append({ time: lastCandle.time + 60_000, open: 101.5, high: 101.5, low: 101.5, close: 101.5 });
```

`append` follows the live edge only when the user is already looking at it: if the
user has panned back, the view stays put.

## Adding indicators

Indicators are added as plugins with `chart.use(plugin)`:

```ts
import { createChart, sma, ema, rsi } from "kamvachart";

const chart = createChart(canvas);
chart.setData(candles);

chart.use(sma({ period: 20 })); // moving-average overlay
chart.use(ema({ period: 50 }));
chart.use(rsi({ period: 14 })); // oscillator drawn in a bottom band
```

Remove one with `chart.removePlugin(name)` (the plugin's `name`, e.g.
`"sma(20)"`). Adding two plugins with the same name is an error.

## Events

Subscribe through the user‑facing API. `chart.subscribe` returns an unsubscribe
function.

```ts
const off = chart.subscribe("crosshairMove", (pos) => {
  if (pos) console.log(pos.price, pos.time);
});
off(); // detach later
```

The five subscribable events are `pointerMove`, `click`, `doubleClick`,
`crosshairMove`, and `viewportChange`. See the [API reference](./api.md#events).

## Cleanup

Call `chart.destroy()` to tear down the renderer, interaction handlers, plugins
and listeners.

```ts
chart.destroy();
```