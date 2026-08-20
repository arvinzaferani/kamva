# Interaction &amp; styling

## Built‑in gestures

`createChart(canvas)` wires input by default (`interactive: true`). Supported:

| Gesture | Action |
| --- | --- |
| Hover | Move the crosshair |
| Drag | Pan horizontally; a middle/right **+ vertical** drag also pans price |
| Scroll wheel | Horizontal zoom, anchored to the cursor |
| Pinch (touch) | Zoom |
| Hover tooltip | An OHLCV label follows the crosshair (`crosshairTooltip: true`) |

To skip input handling entirely, pass `interactive: false`.

## Laying out the canvas

Wrap the canvas in a container and keep it filling the space. The renderer is
`ResizeObserver`‑aware: it reads the canvas size on construction and every resize,
then invalidates the chart.

```ts
const chart = createChart(canvas); // canvas sized via CSS (width/height 100%)
```

Resize is automatic — you only need to make sure the canvas element itself is
given a size by your CSS.

## Theming

Provide a `theme` in the options to restyle colors and the axis font. A `Theme`
is a plain object; the package exports `darkTheme` (default) and `lightTheme`.

```ts
type Theme = {
  background: string;
  grid: string;
  axisText: string;
  candleUp: string;
  candleDown: string;
  wickUp: string;
  wickDown: string;
  crosshair: string;
  crosshairLabelBg: string;
  crosshairLabelText: string;
  font: string;
};
```

```ts
import { createChart, lightTheme } from "kamvachart";

const chart = createChart(canvas, { theme: lightTheme });
```

## Custom axis formatters

Pass `formatters: { price?, time? }`. Each receives the raw value and returns the
label string. This lets you localize numbers, show dates depending on zoom, etc.

```ts
import { createChart } from "kamvachart";

const chart = createChart(canvas, {
  formatters: {
    price: (v) => `$${Math.abs(v) >= 1000 ? v.toFixed(0) : v.toFixed(2)}`,
    time: (t) => new Date(t).toLocaleString(),
  },
});
```

## Series styling

Series accept `color` and `lineWidth` via options (`addCandlestickSeries`,
`addLineSeries`) and can be restyled later with `applyOptions` (`setVisible` for
show/hide).

```ts
const series = chart.addLineSeries({ color: "#2962ff", lineWidth: 2 });
series.applyOptions({ color: "#ff9800" });
series.setVisible(false);
```

## Accessibility & HI‑DPI

The Canvas renderer is device‑pixel‑ratio aware (it multiplies the backing store
by `devicePixelRatio` so lines stay crisp on retina displays). Colors are plain
CSS color strings, so they adapt to whatever color scheme your app uses.