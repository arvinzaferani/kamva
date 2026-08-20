# KamvaChart

<p align="center">
  <strong>🧶 Framework-agnostic financial charting engine for the web.</strong>
</p>

<p align="center">
  <a href="https://arvinzaferani.github.io/kamva/"><img src="https://img.shields.io/badge/Live-Demo-success" alt="Live Demo"></a>
  <a href="https://www.npmjs.com/package/kamvachart"><img src="https://img.shields.io/npm/v/kamvachart.svg" alt="npm version"></a>
  <a href="https://github.com/arvinzaferani/kamva/blob/main/LICENSE"><img src="https://img.shields.io/github/license/arvinzaferani/kamva.svg" alt="license"></a>
</p>

<p align="center">
  <a href="https://arvinzaferani.github.io/kamva/"><strong>🚀 Try the Live Demo</strong></a>
  ·
  <a href="https://www.npmjs.com/package/kamvachart"><strong>📦 View on npm</strong></a>
</p>

---

## Overview

**KamvaChart** is a TypeScript-first, framework-agnostic financial charting engine for modern web applications.

It provides an interactive charting core with Canvas 2D rendering, multi-series support, viewport and camera management, user interaction, realtime updates, and an extensible plugin system.

KamvaChart does not depend on React, Vue, Angular, or any other UI framework.

### What it provides

- 📈 Financial / market charting
- ⚡ Canvas 2D rendering
- 🎯 Framework-agnostic chart core
- 🧩 Plugin-based architecture
- 📊 Built-in technical indicators
- 🔄 Realtime data updates
- 🔍 Pan, zoom and crosshair interactions
- 📐 Time and price scale management
- 🧱 Modular internal architecture
- 💪 TypeScript declarations
- 🪶 Zero runtime dependencies

## Live Demo

Try the interactive playground:

**👉 https://arvinzaferani.github.io/kamva/**

The demo showcases the actual public package and includes:

- Candlestick chart
- Interactive pan and zoom
- Crosshair
- Multiple timeframes
- Technical indicators
- Realtime data simulation
- Responsive canvas interaction

## Installation

```bash
npm install kamvachart
```

or:

```bash
pnpm add kamvachart
```

## Quick Start

```ts
import { createChart } from "kamvachart";

const canvas = document.querySelector("canvas");

if (!canvas) {
  throw new Error("Canvas not found");
}

const chart = createChart(canvas);

const candles = chart.addCandlestickSeries();

candles.setData([
  // Candle[]
]);

chart.fit();
```

The same package can be consumed from vanilla JavaScript, React, Vue, Svelte, or other web applications because the chart engine itself is framework-agnostic.

## Multiple Series

KamvaChart supports multiple independent series on a shared time axis:

```ts
const candles = chart.addCandlestickSeries();
candles.setData(candlesData);

const line = chart.addLineSeries({
  lineWidth: 2,
});

line.setData(lineData);
```

Series can be updated, hidden, or removed independently.

```ts
candles.setVisible(false);
chart.removeSeries(line.id);
```

## Realtime Updates

```ts
candles.update(tick);
candles.append(nextBar);
candles.updateMany(moreBars);
```

Updates are coalesced into the render pipeline so bursts of changes can be processed efficiently.

## Indicators

KamvaChart v1 includes:

| Indicator | Description |
| --- | --- |
| `sma` | Simple Moving Average |
| `ema` | Exponential Moving Average |
| `rsi` | Relative Strength Index |
| `macd` | Moving Average Convergence Divergence |
| `bollingerBands` | Bollinger Bands |
| `vwap` | Volume Weighted Average Price |
| `atr` | Average True Range |
| `ichimoku` | Ichimoku Cloud |

```ts
import {
  sma,
  ema,
  rsi,
  macd,
  bollingerBands,
  vwap,
  atr,
  ichimoku,
} from "kamvachart";
```

Pure computation functions are also available:

```ts
import {
  computeSMA,
  computeEMA,
  computeRSI,
} from "kamvachart";
```

## Plugins

KamvaChart is designed around an extensible plugin architecture.

```ts
chart.use({
  name: "my-plugin",

  initialize(chart) {
    // subscribe to chart events
  },

  update(chart) {
    // recompute plugin state
  },

  draw(chart, viewport, surface) {
    // custom rendering
  },

  destroy() {
    // cleanup
  },
});
```

See [PLUGIN_SYSTEM.md](./PLUGIN_SYSTEM.md).

## Architecture

```text
kamvachart
│
├── Chart Core
│   ├── chart state
│   ├── data store
│   ├── viewport
│   ├── camera
│   ├── time scale
│   ├── price scale
│   ├── series management
│   └── event system
│
├── Canvas Renderer
│   ├── rendering pipeline
│   ├── layers
│   ├── canvas rendering
│   └── DOM interaction
│
└── Indicators
    ├── SMA
    ├── EMA
    ├── RSI
    ├── MACD
    ├── Bollinger Bands
    ├── VWAP
    ├── ATR
    └── Ichimoku
```

The published `kamvachart` package provides the primary consumer-facing API while keeping these responsibilities separated internally.

### Internal packages

| Package | Responsibility |
| --- | --- |
| `chart-core` | State, data, viewport, camera, scales and events |
| `renderer-canvas` | Canvas rendering and browser interaction |
| `indicators` | Technical indicators and indicator plugins |
| `kamvachart` | Unified public API |

Consumers should normally install only `kamvachart`.

## Design Principles

### Framework agnostic
The chart engine is independent from UI frameworks.

### Separation of concerns
State, rendering, interaction, and indicators remain independently organized.

### Extensibility
Optional functionality is designed around plugins and composable APIs.

### Performance-oriented rendering
The rendering pipeline is designed for interactive financial chart workloads, with viewport-aware updates and Canvas 2D rendering.

### Type safety
KamvaChart is written in TypeScript and ships generated declaration files.

## Public API

Navigation:

```ts
chart.zoom(2);
chart.pan(150);
chart.panPrice(10);
chart.fit();
```

Events:

```ts
chart.subscribe("crosshairMove", (position) => {
  if (!position) return;
  console.log(position.time, position.price);
});
```

Time scale:

```ts
chart.timeScale().fitContent();

chart.timeScale().setVisibleRange({
  from,
  to,
});
```

Price scale:

```ts
chart.priceScale().setVisibleRange({
  min,
  max,
});
```

See [API_GUID.md](./API_GUID.md) for the complete API surface.

## Browser Support

KamvaChart targets modern browsers supporting:

- ES2022 JavaScript
- HTML Canvas 2D
- Modern DOM APIs

## Project Structure

```text
kamva/
├── packages/
│   ├── chart-core/
│   ├── renderer-canvas/
│   ├── indicators/
│   └── kamvachart/
├── examples/
│   ├── basic/
│   ├── multi-series/
│   └── playground/
├── .github/
│   └── workflows/
└── documentation
```

## Development

```bash
git clone https://github.com/arvinzaferani/kamva.git
cd kamva
pnpm install
pnpm build
pnpm typecheck
pnpm test
```

## Documentation

- [API Guide](./API_GUID.md)
- [Architecture](./ARCHITECTURE.md)
- [Design Principles](./DESIGN_PRINCIPLES.md)
- [Performance](./PERFORMANCE.md)
- [Plugin System](./PLUGIN_SYSTEM.md)
- [Render Pipeline](./RENDER_PIPELINE.md)
- [Roadmap](./ROADMAP.md)

## v1.0.0

KamvaChart v1.0.0 is the first public release of the unified package.

Highlights:

- Unified `kamvachart` npm package
- Canvas 2D renderer
- Framework-agnostic chart core
- Candlestick and line series
- Pan, zoom and crosshair interaction
- Realtime series updates
- Plugin-oriented architecture
- Built-in technical indicators
- TypeScript declarations
- Zero runtime dependencies
- Public v1 API

```bash
npm install kamvachart
```

**npm:** https://www.npmjs.com/package/kamvachart

**Live Demo:** https://arvinzaferani.github.io/kamva/

## Current Scope

KamvaChart v1 focuses on:

- Candlestick and line series
- Interactive navigation
- Canvas 2D rendering
- Shared time and price scales
- Technical indicators
- Plugin extensibility
- Realtime updates

Advanced capabilities such as additional series types, multiple panes and price scales, framework adapters, additional renderer backends, and drawing tools are planned for future releases.

See [ROADMAP.md](./ROADMAP.md).

## Contributing

Contributions, bug reports, feature requests, and discussions are welcome.

Before opening a pull request:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Please keep the architectural boundaries described in [ARCHITECTURE.md](./ARCHITECTURE.md) intact.

## License

KamvaChart is released under the [MIT License](./LICENSE).

---

<p align="center">
  Built with TypeScript and Canvas.
</p>
