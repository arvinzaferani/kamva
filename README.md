# KamvaChart

Framework-agnostic, high-performance financial charting engine.

## Packages

| Package | Owns |
| --- | --- |
| `@kamvachart/chart-core` | state, viewport, camera, events, plugin system — zero DOM dependencies |
| `@kamvachart/renderer-canvas` | Canvas 2D draw pipeline, layers, DOM interaction |

See [ARCHITECTURE.md](./ARCHITECTURE.md) for boundaries. Planned packages
(react, vue, indicators, drawing-tools, themes) build on these without new
core surface — see [ROADMAP.md](./ROADMAP.md).

## Quick start

```ts
import { createChart } from "@kamvachart/renderer-canvas";

const chart = createChart(document.querySelector("canvas"));

chart.setData(candles);   // full series (sorted by time)
chart.append(candle);     // new bar
chart.update(candle);     // tick the last bar
chart.zoom(2);            // programmatic navigation
chart.pan(150);
chart.fit();
chart.destroy();
```

Wheel = zoom (anchored at cursor), drag = pan, hover = crosshair.

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
  draw(chart, viewport) { /* overlay via viewport.xForIndex / yForPrice */ },
  destroy() {},
});
```

Plugins see only the public `ChartApi` — never internals.

## Development

```sh
pnpm install
pnpm build       # tsc for all packages, dependency order
pnpm test        # vitest
pnpm typecheck
```

Core rules: strict TypeScript, no `any`, no framework code in chart-core,
no circular dependencies. See [AGENT.md](./AGENT.md).
