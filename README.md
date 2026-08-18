# KamvaChart

Framework-agnostic, high-performance financial charting engine.

## Packages

| Package | Owns |
| --- | --- |
| `@kamvachart/chart-core` | state, viewport, camera, events, plugin system — zero DOM dependencies |
| `@kamvachart/renderer-canvas` | Canvas 2D draw pipeline, layers, DOM interaction |
| `@kamvachart/indicators` | official indicators as plugins (SMA, EMA, RSI, MACD, VWAP, Bollinger, ATR, Ichimoku) |

See [ARCHITECTURE.md](./ARCHITECTURE.md) for boundaries. Planned packages
(react, vue, drawing-tools, themes) build on these without new
core surface — see [ROADMAP.md](./ROADMAP.md).

## Quick start

```ts
import { createChart } from "@kamvachart/renderer-canvas";

const chart = createChart(document.querySelector("canvas"));

const candles = chart.addCandlestickSeries();          // main series
candles.setData(candlesData);                          // full series (sorted by time)
chart.append(candle);                                  // new bar
chart.update(candle);                                  // tick the last bar

const emaLine = chart.addLineSeries({ color: "#2962ff", lineWidth: 2 });
emaLine.setData(emaPoints);                            // { time, value }[]

chart.zoom(2);            // programmatic navigation
chart.pan(150);
chart.fit();
chart.destroy();
```

Wheel = zoom (anchored at cursor), drag = pan, hover = crosshair.

`setData` / `append` / `update` on the chart are shortcuts that target the
first candle series (main series), so existing code keeps working.

### Events

Public events are in domain space (index / time / price), never pixels:

```ts
chart.on("crosshairMove", ({ index, time }) => { /* hovered bar */ });
chart.on("visibleRangeChange", ({ from, to }) => { /* scroll/zoom */ });
chart.on("click", ({ time, price }) => {});
```

Run the demo:

```sh
pnpm install
pnpm build
npx serve .   # then open /examples/basic/
```

## Plugins

Everything optional is a plugin (see [PLUGIN_SYSTEM.md](./PLUGIN_SYSTEM.md)):

```ts
chart.use({
  name: "my-indicator",
  initialize(chart) { /* subscribe via chart.on(...) */ },
  update(chart)     { /* recompute from chart.data */ },
  draw(chart, viewport, ctx) {
    /* overlay via ctx (RenderSurface): ctx.strokeStyle, ctx.beginPath, ctx.stroke */
  },
  destroy() {},
});
```

Plugins see only the public `ChartApi` — never internals. The draw context is
a `RenderSurface` (a structural 2D surface), so the core stays DOM-free while
the canvas renderer provides a `CanvasRenderingContext2D`.

## Indicators

Official indicators are plugins in `@kamvachart/indicators`:

```ts
import { sma, ema, bollingerBands, rsi, macd } from "@kamvachart/indicators";

chart.use(sma({ period: 20 }));
chart.use(ema({ period: 50 }));
chart.use(bollingerBands({ period: 20, multiplier: 2 }));
chart.use(rsi({ period: 14 }));
chart.use(macd({ fast: 12, slow: 26, signal: 9 }));
```

Overlays (SMA, EMA, Bollinger, VWAP, ATR, Ichimoku) share the price scale;
oscillators (RSI, MACD) draw into a bottom band until multi-pane lands.
Each indicator is named uniquely, so `chart.removePlugin("sma(20)")` works.
Pure computation functions (`computeSMA`, `computeRSI`, …) are also
exported for backtests and headless use.

## Development

```sh
pnpm install
pnpm build       # tsc for all packages, dependency order
pnpm test        # vitest
pnpm typecheck
```

Core rules: strict TypeScript, no `any`, no framework code in chart-core,
no circular dependencies. See [AGENT.md](./AGENT.md).
