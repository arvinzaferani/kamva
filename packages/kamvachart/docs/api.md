# API reference

## `createChart(canvas, options?)`

```ts
createChart(canvas: HTMLCanvasElement, options?: CreateChartOptions): Chart
```

One‑call entry point: creates a `Chart`, attaches a `CanvasRenderer` that owns the
canvas, and (by default) wires an `InteractionController` for pointer / wheel /
touch input. It returns the `Chart` itself; the full public API lives on it.

`CreateChartOptions = ChartOptions & CanvasRendererOptions & { interactive?: boolean }`

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `interactive` | `boolean` | `true` | Set `false` to attach rendering only (no input handling). |
| `pricePadding` | `number` | `0.08` | Fractional padding above/below the auto price range. |
| `overscroll` | `number` | `5` | Candles of empty space allowed past either end when panning. |
| `crosshairTooltip` | `boolean` | `true` | Draw an OHLCV tooltip next to the crosshair. |
| `theme` | `Theme` | `darkTheme` | See [Interaction & styling](./interaction.md#theming). |
| `formatters` | `AxisFormatters` | — | Custom axis label functions, see [formatters](./interaction.md#formatters). |

## `class Chart`

### Data (convenience over the primary candle series)

| Member | Signature | Notes |
| --- | --- | --- |
| `setData` | `(candles: readonly Candle[]) => void` | Replaces primary data, fits the view. Creates the primary series if none exists. |
| `append` | `(candle: Candle) => void` | New candle (time > last). Follows the live edge only if pinned to it. |
| `update` | `(candle: Candle) => void` | Replaces the last candle (`time` must match). |
| `data` | `readonly Candle[]` | Current primary series data. |

You can also work with **multiple series** directly:

- `addCandlestickSeries(options?: SeriesOptions): Series<Candle>`
- `addLineSeries(options?: SeriesOptions): Series<LineSeriesPoint>`
- `removeSeries(id: string): void`

The first candle series added becomes the primary that backs the convenience
`data` / `setData` / `append` / `update` API.

### Navigation

| Member | Signature | Notes |
| --- | --- | --- |
| `zoom` | `(factor: number, anchor?: number) => void` | Horizontal zoom. `factor > 1` zooms in; `anchor` 0=left, 1=right (default 0.5). |
| `zoomPrice` | `(factor: number, anchorPrice?: number) => void` | Vertical zoom on the price axis. |
| `pan` | `(candles: number) => void` | Pan horizontally by candle counts. |
| `panPrice` | `(byPrice: number) => void` | Pan the price axis by a price amount (takes manual control). |
| `fit` | `() => void` | Auto‑scale the price axis and reset the time axis. |
| `timeScale` | `() => TimeScaleApi` | Shared horizontal axis. |
| `priceScale` | `() => PriceScaleApi` | Shared vertical price axis. |

### Plugins

| Member | Signature | Notes |
| --- | --- | --- |
| `use` | `(plugin: Plugin) => this` | Registers a plugin; throws if the name is already registered. |
| `removePlugin` | `(name: string) => void` | Removes and destroys a plugin by name (no‑op if absent). |

### Events

Two levels of events are exposed.

**User‑facing (`chart.subscribe(name, handler)`)** — returns an unsubscribe `() => void`:

| Name | Payload |
| --- | --- |
| `pointerMove` | `Point` — raw pointer in CSS pixels |
| `click` | `ClickPayload` — `{ x, y, index, time, price }` |
| `doubleClick` | `ClickPayload` |
| `crosshairMove` | `CrosshairPosition \| undefined` — `undefined` when the pointer leaves |
| `viewportChange` | `VisibleRangePayload` — `{ from, to, fromTime, toTime }` |

**Low‑level (`chart.on(event, handler)`)**, with payloads stable public API:

| Name | Payload |
| --- | --- |
| `"data:changed"` | `{ size: number }` |
| `"visibleRangeChange"` | `VisibleRangePayload` |
| `"camera:changed"` | `{ from, to }` |
| `"crosshairMove"` | `CrosshairPosition \| undefined` |
| `click` / `dblclick` | `ClickPayload` |
| `"pointer:move"` | `Point` |
| `"pointer:leave"` | `undefined` |
| `destroy` | `undefined` |

> Prefer `subscribe(...)` for user‑facing events. `on(...)` is for advanced /
> event‑bus consumers and is part of the stable API too.

### Crosshair

```ts
interface CrosshairPosition {
  x: number;       // pixel x
  y: number;       // pixel y
  index: number;   // fractional candle index under the pointer
  time: number;    // resolved time (ms) from the primary series
  price: number;   // price at the pointer's pixel y
  seriesData: readonly CrosshairSeriesDatum[];
}
```

`CrosshairSeriesDatum` = `{ id, type, time, value, item }` for each visible series.

### Lifecycle & internals

- `destroy(): void` — tear down everything.
- `attachRenderer(renderer: Renderer): void` — inject a custom renderer.
- `invalidate()` / `renderFrame()` — mark dirty / synchronous render (advanced).

## `Series<T>`

`Series` is returned by `addCandlestickSeries` (`T = Candle`) and `addLineSeries`
(`T = LineSeriesPoint`).

```ts
interface Series<T extends { time: number }> {
  readonly id: string;
  readonly type: "candles" | "line";
  readonly options: Readonly<SeriesOptions>;
  readonly data: readonly T[];
  setData(data: readonly T[]): void;
  append(item: T): void;          // time > last, else throws
  update(item: T): void;          // time === last, else throws
  updateMany(items: readonly T[]): void;
  applyOptions(options: SeriesOptions): void;
  getOptions(): Readonly<SeriesOptions>;
  getData(): readonly T[];
  setVisible(visible: boolean): void;
  isVisible(): boolean;
  remove(): void;
}
```

`SeriesOptions = { color?: string; lineWidth?: number }`. Defaults:
candles `#787b86` / width 1, lines `#2962ff` / width 2.

## `TimeScaleApi`

```ts
interface TimeScaleApi {
  fitContent(): void;
  reset(): void;                                  // full extent of the primary series
  setVisibleRange(range: TimeRange): void;        // { from: number; to: number } in time (ms)
  getVisibleRange(): TimeRange;
  subscribe(handler: (range: TimeRange) => void): () => void;
}
```

## `PriceScaleApi`

```ts
interface PriceScaleApi {
  valueToCoordinate(value: number): number;       // price -> pixel y
  coordinateToValue(coordinate: number): number;  // pixel y -> price
  getVisibleRange(): PriceRange;                  // { min, max }
  setVisibleRange(range: PriceRange): void;       // disables auto-scaling
  panPrice(byPrice: number): void;
}
```

## `Plugin`

See [Extending](./extending.md).

```ts
interface Plugin {
  readonly name: string;                          // unique
  initialize(chart: ChartApi): void;
  update?(chart: ChartApi): void;                 // data/camera changed, before draw
  draw?(chart: ChartApi, viewport: Viewport, surface: RenderSurface | undefined): void;
  destroy?(): void;
}
```

## Core data types

```ts
interface Candle            { time: number; open: number; high: number; low: number; close: number; volume?: number }
interface LineSeriesPoint   { time: number; value: number }
interface VisibleRange      { from: number; to: number }   // fractional candle indices
interface PriceRange        { min: number; max: number }
interface Point             { x: number; y: number }
interface Size              { width: number; height: number }
```