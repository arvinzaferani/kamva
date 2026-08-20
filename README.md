# KamvaChart

<p align="center">
  <strong>Framework-agnostic, high-performance financial charting engine for the web.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/kamvachart">
    <img src="https://img.shields.io/npm/v/kamvachart.svg" alt="npm version">
  </a>
  <a href="https://www.npmjs.com/package/kamvachart">
    <img src="https://img.shields.io/npm/dm/kamvachart.svg" alt="npm downloads">
  </a>
  <a href="https://github.com/arvinzaferani/kamva/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/arvinzaferani/kamva.svg" alt="license">
  </a>
</p>

---

## Overview

**KamvaChart** is a framework-agnostic financial charting engine designed for building interactive, high-performance charts in modern web applications.

It focuses on a clean separation between:

- chart state and data management
- viewport and camera logic
- rendering
- user interaction
- technical indicators
- extensibility through plugins

KamvaChart is built with TypeScript and is designed to work without being tied to React, Vue, Angular, or any other UI framework.

## Features

- 📈 Financial / market charting
- ⚡ Canvas 2D rendering
- 🎯 Framework-agnostic core
- 🧩 Plugin-based architecture
- 📊 Built-in technical indicators
- 🔄 Real-time data updates
- 🔍 Pan and zoom interactions
- 📐 Independent viewport and camera management
- 🧱 Modular internal architecture
- 🪶 Zero runtime dependencies
- 💪 TypeScript-first API

## Installation

```bash
npm install kamvachart
```

or:

```bash
pnpm add kamvachart
```

or:

```bash
yarn add kamvachart
```

## Quick Start

```ts
import { createChart } from "kamvachart";

const container = document.getElementById("chart");

if (!container) {
  throw new Error("Chart container not found");
}

const chart = createChart(container, {
  // chart configuration
});
```

KamvaChart is framework-agnostic, so the same API can be used from React, Vue, Svelte, vanilla JavaScript, or any other web application.

## Indicators

KamvaChart v1 includes a collection of commonly used technical indicators:

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

Available indicators:

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

Indicator implementations are exposed through the same public package, so consumers don't need to install additional KamvaChart packages.

## Architecture

KamvaChart is internally organized into several modules:

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

These modules remain separated internally, while the published package provides a single developer-facing API:

```ts
import { ... } from "kamvachart";
```

This keeps the internal architecture modular without forcing consumers to manage multiple packages.

## Design Principles

KamvaChart is built around a few core principles:

### Framework agnostic

The chart engine does not depend on a UI framework.

### Separation of concerns

Chart state, rendering, interaction, and indicators are kept independent.

### Extensibility

The architecture is designed around plugins and composable chart functionality.

### Performance

Rendering and viewport operations are designed with interactive financial charts in mind.

### Type safety

The public API is written in TypeScript and ships with generated type declarations.

## Project Structure

```text
kamva/
├── packages/
│   ├── chart-core/
│   ├── renderer-canvas/
│   ├── indicators/
│   └── kamvachart/
│
├── examples/
├── README.md
├── ARCHITECTURE.md
├── DESIGN_PRINCIPLES.md
├── PERFORMANCE.md
├── PLUGIN_SYSTEM.md
└── ROADMAP.md
```

### Internal packages

| Package | Responsibility |
| --- | --- |
| `chart-core` | Chart state, data, viewport, camera, scales and events |
| `renderer-canvas` | Canvas rendering and browser interaction |
| `indicators` | Technical indicators and indicator plugins |
| `kamvachart` | Public package and unified API |

Only `kamvachart` is intended as the primary consumer-facing package.

## Development

Clone the repository:

```bash
git clone https://github.com/arvinzaferani/kamva.git
cd kamva
```

Install dependencies:

```bash
pnpm install
```

Build all packages:

```bash
pnpm build
```

Run type checking:

```bash
pnpm typecheck
```

Run tests:

```bash
pnpm test
```

## Examples

Example applications are available in:

```text
examples/
├── basic/
└── multi-series/
```

They demonstrate how KamvaChart can be integrated into a browser application.

## Documentation

More detailed technical documentation is available in the repository:

- [Architecture](./ARCHITECTURE.md)
- [Design Principles](./DESIGN_PRINCIPLES.md)
- [Performance](./PERFORMANCE.md)
- [Plugin System](./PLUGIN_SYSTEM.md)
- [API Guide](./API_GUID.md)
- [Render Pipeline](./RENDER_PIPELINE.md)
- [Product Plan](./KamvaCharts_Product_Plan.md)
- [Roadmap](./ROADMAP.md)

## Browser Support

KamvaChart is designed primarily for modern browsers supporting:

- ES2022 JavaScript
- HTML Canvas 2D
- Modern DOM APIs

## Status

### v1.0.0

KamvaChart v1 establishes the first public package API and provides:

- unified `kamvachart` package
- Canvas 2D renderer
- framework-agnostic chart core
- plugin-oriented architecture
- built-in technical indicators
- TypeScript declarations
- zero runtime dependencies

The API is intended to provide a stable foundation for future releases.

## Roadmap

Planned areas of development include:

- additional chart types
- additional technical indicators
- improved rendering performance
- richer plugin APIs
- advanced financial drawing tools
- improved interaction and accessibility
- additional examples and documentation

See [ROADMAP.md](./ROADMAP.md) for the current development plan.

## Contributing

Contributions, bug reports, feature requests, and discussions are welcome.

Before opening a pull request, please make sure:

```bash
pnpm typecheck
pnpm test
pnpm build
```

all pass successfully.

## License

KamvaChart is released under the [MIT License](./LICENSE).

---

<p align="center">
  Built with TypeScript and Canvas.
</p>
