# Concepts

## Data model

- A flicker series is a list of items sorted by **strictly increasing `time`**.
  Candle items are `Candle`, line items are `LineSeriesPoint`.
- All times are **UNIX milliseconds**.
- The chart can host many series. The **first candle series** becomes the
  *primary* — the reference for the x axis and the target of the convenience
  `data` / `setData` / `append` / `update` API.

```
setData → creates primary candle series (if none) + fits view
addCandlestickSeries / addLineSeries → additional series
```

## Series ownership

`chart.data` reads the primary series; `chart.viewport` exposes the current camera
state. Mutating a series directly (e.g. `series.setData(...)`) keeps your work
independent of the convenience API — both route through the same store.

## The live edge

`append` only *follows* the data when the user is already pinned to the newest
data. If the user has panned back in time, appends leave the view where it is —
a chart never yanks the user forward against their will. This is what makes the
realtime feed feel calm.

## Coordinates

- **Index space**: fractional candle indices. `VisibleRange = { from, to }` and
  `CrosshairPosition.index` are in this space.
- **Time space**: resolved UNIX milliseconds (what you see in axis labels).
- **Price space**: the current auto or manual price range (`{ min, max }`).
- **Pixel space**: CSS pixels from the canvas's top‑left (`Point`, `Size`).

Conversions:

```ts
const timeScale = chart.timeScale();
const range = timeScale.getVisibleRange();       // { from, to } ms
timeScale.setVisibleRange({ from, to });

const priceScale = chart.priceScale();
priceScale.setVisibleRange({ min, max });        // takes manual control
const range2 = priceScale.getVisibleRange();
```

## Zoom & pan semantics

- **Horizontal (time)**: `zoom(factor, anchor)` and `pan(candles)`. The horizontal
  axis is clamped to the data plus a small `overscroll`.
- **Vertical (price)**: `zoomPrice(factor)` and `panPrice(byPrice)`. Manual price
  adjustments are **sticky** — they are never auto re‑fitted by a later frame, so
  the price axis stays where you put it.

`fit()` resets the time axis and re‑autoscales the price axis.

## Rendering model

State lives in `chart-core`; drawing is delegated to a renderer. The Canvas
renderer composes in layers each frame:

```
background → grid → series → axes  →  plugin overlays  →  crosshair overlay
                        (base scene drawn by the renderer)
```

Because plugins draw between the base scene and the crosshair, indicator lines
always sit *under* the crosshair.

## Frame scheduling

Any mutation marks the chart dirty; a single coalesced render runs per animation
frame. Bursts of appends / pans / zooms therefore cost one draw per frame, which
is deliberate for interactive performance.