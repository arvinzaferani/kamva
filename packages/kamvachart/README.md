# KamvaChart

Framework-agnostic, high-performance financial charting engine.

## Documentation

| Guide | |
| --- | --- |
| [Getting started](./docs/getting-started.md) | Install, first chart, data, realtime, events |
| [API reference](./docs/api.md) | Every export: `createChart`, `Chart`, series, scales, types |
| [Indicators](./docs/indicators.md) | Indicator factories, options, and pure `compute*` functions |
| [Concepts](./docs/concepts.md) | Data model, primary series, coordinates, zoom & pan semantics |
| [Interaction & styling](./docs/interaction.md) | Gestures, theming, axis formatters, tooltips |
| [Extending](./docs/extending.md) | Writing your own plugins |

## 1. What Kamva is

A core charting engine (multi-series candlestick/line charts with crosshair,
pan/zoom and realtime updates) plus small, focused packages that plug into it.
The engine owns **state, the camera, the scales and the render scheduling** —
not the DOM or a framework.

## 2. Why it is framework-agnostic

- The engine core has **zero DOM / framework dependencies**. It is a plain
  TypeScript state machine that emits events and accepts an injected renderer.
- Rendering is a *separate* concern: the only code that touches a canvas or the
  DOM lives in the renderer layer, by design.
- Everything optional is a `Plugin` that sees only the public `ChartApi` — so
  React/Vue/Svelte/Angular adapters can be added later without changing the
  core (none exist yet; see [ROADMAP.md](./ROADMAP.md)).

## 3. One package on npm

`kamvachart` is a **single, self-contained npm package** — no scoped
dependencies to install. The repo is a monorepo of three internal packages
that are bundled together before publishing:

| Internal package | Owns | Published as |
| --- | --- | --- |
| `@kamvachart/chart-core` | state (series), camera, time & price scales, viewport, events, plugins, render scheduling | bundled into `kamvachart` |
| `@kamvachart/renderer-canvas` | Canvas 2D draw pipeline, layers, DOM interaction (wheel/drag/crosshair) | bundled into `kamvachart` |
| `@kamvachart/indicators` | official indicators as plugins (SMA, EMA, RSI, MACD, VWAP, Bollinger, ATR, Ichimoku) | bundled into `kamvachart` |

The render pipeline is one-directional: data → viewport (`Chart.viewport`) →
layers → canvas. Multiple series share **one time axis** (indexed by the first
candle series) and **one price scale**. See [ARCHITECTURE.md](./ARCHITECTURE.md)
and [RENDER_PIPELINE.md](./RENDER_PIPELINE.md).

## 4. Installation

```sh
npm install kamvachart
```

Everything you need is exported from a single entry point:

```ts
import {
  createChart,        // Chart wired to a canvas (wheel, drag, crosshair)
  Chart,              // headless core, for ownership/custom renderers
  CanvasRenderer,     // Canvas 2D output, attach to a Chart manually
  sma, ema, rsi,      // indicator plugins
} from "kamvachart";
```

### Developing the monorepo (contributors)

```sh
pnpm install
pnpm build       # build all packages in dependency order
pnpm test        # vitest
pnpm typecheck
```

Core rules: strict TypeScript, no `any`, no framework code in the engine, no
circular dependencies (see [AGENT.md](./AGENT.md)).

## 5. Quick start

```ts
import { createChart } from "kamvachart";

const chart = createChart(document.querySelector("canvas"));

const candles = chart.addCandlestickSeries();          // main series
candles.setData(candlesData);                          // sorted by time

chart.zoom(2);   // wheel/edge-drag already work: zoom is anchored at cursor
chart.pan(150);
chart.fit();     // reset time + autoscale price

chart.destroy();
```

`createChart(canvas)` wires a `Chart` to a canvas and adds wheel = zoom,
drag = pan, hover = crosshair. The same `chart` object is the full [public API](#public-api).

You can also construct the core alone and attach a renderer manually:

```ts
import { Chart, CanvasRenderer } from "kamvachart";

const chart = new Chart();
chart.attachRenderer(new CanvasRenderer(canvas));
```

## 6. Multiple series

All series live on the same time axis and price scale:

```ts
const candles = chart.addCandlestickSeries({ color: "#2962ff" });
candles.setData(candlesData);                     // Candle[]

const sma = chart.addLineSeries({ color: "#ff9800", lineWidth: 2 });
sma.setData(emaPoints);                           // { time, value }[]
```

Series are independent: update one without touching the others. Hide or remove
any time:

```ts
candles.setVisible(false);   // not rendered, not autoscaled, not on the crosshair
chart.removeSeries(candles.id);
// or: candles.remove();
```

`chart.setData(candles)` is a shortcut that targets the first candle series
("primary") for convenience.

## 7. Realtime updates

Efficient single-point updates, coalesced into one render per animation
frame:

```ts
candles.update(tick);    // same time as last bar  -> replaces the last bar
candles.append(nextBar); // greater time           -> appends a new bar
candles.updateMany(more); // batch append
```

A burst of `update()`/`append()` calls in one event loop draws **one** frame,
and only the touched series' state is invalidated (unrelated series are
untouched).

## 8. Plugins

Anything optional is a plugin doing the same boundaries as indicators:

```ts
chart.use({
  name: "my-tool",
  initialize(chart) { /* subscribe via chart.subscribe(...) */ },
  update(chart)      { /* recompute on data/camera change, before draw */ },
  draw(chart, viewport, surface) {
    // overlay via the abstract RenderSurface
    surface.strokeStyle = "#fff";
    surface.beginPath();
    surface.moveTo(0, viewport.yForPrice(100));
    surface.lineTo(viewport.size.width, viewport.yForPrice(100));
    surface.stroke();
  },
  destroy() {},
});
chart.removePlugin("my-tool");
```

See [PLUGIN_SYSTEM.md](./PLUGIN_SYSTEM.md). Plugins see only `ChartApi` and a
DOM-free `RenderSurface`.

## 9. Indicators currently available

`kamvachart` ships indicator plugins: **SMA, EMA, RSI, MACD, VWAP, Bollinger
Bands, ATR, Ichimoku**.

```ts
import { sma, ema, rsi, macd, bollingerBands, vwap, atr, ichimoku } from "kamvachart";
chart.use(sma({ period: 20 }));
chart.use(ema({ period: 50 }));
chart.use(rsi({ period: 14 }));
chart.use(macd({ fast: 12, slow: 26, signal: 9 }));
```

Pure computation functions (`computeSMA`, `computeRSI`, …) are exported too,
for backtests and headless use.

## 10. Current limitations

- **Series types:** candles and line only — no histogram/volume series yet.
- **Frameworks:** no React/Vue/Svelte/Angular adapters exist yet.
- **Price scales:** a single shared price scale (multi-scale is designed for but
  not implemented).
- **Panes:** oscillators (RSI, MACD) draw into a bottom band until multi-pane
  support lands.
- **Touch:** pointer-based pan/click work; pinch zoom is not implemented.

## 11. Roadmap

See [ROADMAP.md](./ROADMAP.md). High level: more series/renderer backends
(WebGL), framework adapters, multiple panes & price scales, drawing tools,
and themes.

---

## Public API

**Events / interaction** (all payloads are domain-space, never raw pixels):

```ts
chart.subscribe("pointerMove",   ({ x, y }) => {});
chart.subscribe("click",         ({ time, price }) => {});
chart.subscribe("doubleClick",   ({ time }) => {});
chart.subscribe("crosshairMove", (pos) => {
  if (!pos) return;                       // pointer left the chart
  const { time, price, seriesData } = pos;
  for (const d of seriesData) console.log(d.id, d.type, d.value);
});
chart.subscribe("viewportChange", ({ fromTime, toTime }) => {});
// subscribe(...) returns an unsubscribe function.
```

**Scales:**

```ts
chart.timeScale().fitContent();                       // fit all visible series
chart.timeScale().reset();                            // fit to the primary
chart.timeScale().setVisibleRange({ from, to });      // in ms
const range = chart.timeScale().getVisibleRange();

chart.priceScale().setVisibleRange({ min, max });
chart.priceScale().getVisibleRange();
chart.priceScale().panPrice(priceUnits);           // shift the price axis vertically
chart.priceScale().valueToCoordinate(price);          // price -> pixel y
chart.priceScale().coordinateToValue(y);              // pixel y -> price
```

**Navigation:** `chart.zoom(factor, anchor?)`, `chart.pan(candles)`,
`chart.panPrice(priceUnits)`, `chart.zoomPrice(factor)`, `chart.fit()`.
Middle-drag pans both axes: horizontal via `pan`, vertical via `panPrice`
(the price scale takes manual control on the first vertical movement).

## Run the examples

```sh
pnpm install
pnpm build
npx serve .   # then open /examples/basic/   (indicators + live feed)
              #         or /examples/multi-series/ (focused multi-series demo)
```