# Extending: custom plugins

A plugin hooks into the chart's frame loop. It receives only the public `ChartApi`,
never internal state, so your plugin keeps working as the engine evolves.

```ts
interface Plugin {
  readonly name: string;                 // must be unique
  initialize(chart: ChartApi): void;     // called once on chart.use(plugin)
  update?(chart: ChartApi): void;        // called when data or camera change, before draw
  draw?(chart, viewport, surface): void; // called each frame, draws into the surface
  destroy?(): void;                      // called on chart.removePlugin / chart.destroy
}
```

## Example: a custom overlay

```ts
import type { Plugin, ChartApi, Viewport, RenderSurface } from "kamvachart";

function myLinePlugin(): Plugin {
  return {
    name: "my-line",
    draw(chart, viewport, surface) {
      if (!surface) return; // renderer doesn't support plugin drawing
      const { from, to } = viewport.visibleRange;
      const first = Math.max(0, Math.floor(from));
      const last = Math.min(Math.ceil(to), chart.data.length - 1);

      surface.strokeStyle = "#9c27b0";
      surface.lineWidth = 1.5;
      surface.beginPath();
      let pen = false;
      for (let i = first; i <= last; i++) {
        const c = chart.data[i];
        if (!c) continue;
        const x = viewport.xForIndex(i);
        const y = viewport.yForPrice(c.close);
        if (pen) surface.lineTo(x, y);
        else { surface.moveTo(x, y); pen = true; }
      }
      surface.stroke();
    },
  };
}

chart.use(myLinePlugin());
```

The `RenderSurface` exposes the layered 2D drawing primitives (`moveTo`,
`lineTo`, `stroke`, `fill`, `fillRect`, `fillText`, …). `Viewport` gives helpers
such as `xForIndex`, `yForPrice`, `candleWidth` and `visibleRange`.

## Building indicators with the indicator helper

For a plugin that computes and draws a series from candles, mirror the pattern the
built‑in indicators use: recompute lazily in `update()` when the data actually
changes (compares length and last‑candle reference), and virtualize drawing to
the visible range only.

```ts
function doubleLinePlugin(): Plugin {
  let values: (number | undefined)[] = [];
  return {
    name: "convolution",
    update(chart) {
      const d = chart.data;
      values = d.map((c) => c.close * 2); // re-run when d.length / last candle changes
    },
    draw(chart, viewport, surface) {
      // ... walk values over viewport.visibleRange and stroke
    },
  };
}
```

## Removing plugins

Plugins are removed by name:

```ts
chart.removePlugin("my-line"); // calls destroy() if present
```

Adding two plugins with the same `name` throws — keep names unique.

## Custom renderer (advanced)

`chart-core` never touches the DOM. To render to a different backend, implement
the `Renderer` interface (`beginFrame`, `render`, `drawOverlay?`,
`getPluginContext?`, `endFrame`, `destroy`) and attach it:

```ts
import { Chart } from "kamvachart";

const chart = new Chart({ pricePadding: 0.1 });
chart.attachRenderer(myRenderer);   // any Renderer
chart.setData(candles);
```