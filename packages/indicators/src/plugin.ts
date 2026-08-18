/**
 * Turns a computation into a chart-core Plugin that draws its result.
 *
 * The compute function is invoked lazily on the first frame and then only
 * when the data actually changed (cheap length + last-candle-reference
 * check), never on pan/zoom. Drawing is virtualized to the visible range.
 */
import type { Candle, ChartApi, Plugin, RenderSurface, Viewport } from "@kamvachart/chart-core";
import type { IndicatorArea, IndicatorLine, IndicatorResult } from "./types.js";

interface VerticalMap {
  readonly valueDomain?: { readonly min: number; readonly max: number };
  readonly heightFraction?: number;
}

/** Map a value to a pixel y: price scale, or an oscillator band in valueDomain. */
function yForValue(viewport: Viewport, map: VerticalMap, value: number): number {
  if (map.valueDomain !== undefined) {
    const { min, max } = map.valueDomain;
    const fraction = map.heightFraction ?? 0.25;
    const height = viewport.size.height;
    const bandTop = height * (1 - fraction);
    const span = max - min;
    const t = span > 0 ? (value - min) / span : 0.5;
    return bandTop + (1 - t) * (height * fraction);
  }
  return viewport.yForPrice(value);
}

function drawLine(ctx: RenderSurface, viewport: Viewport, line: IndicatorLine): void {
  const { values, offset = 0 } = line;
  const width = line.width ?? 1.5;
  const dashed = line.dashed ?? false;
  const first = Math.max(0, Math.floor(viewport.visibleRange.from));
  const last = Math.min(Math.ceil(viewport.visibleRange.to), values.length - 1 + offset);
  if (first > last) return;

  ctx.strokeStyle = line.color;
  ctx.fillStyle = line.color;
  ctx.lineWidth = width;
  if (dashed) ctx.setLineDash([4, 4]);

  if (line.bars === true) {
    const zeroY = yForValue(viewport, line, 0);
    const barWidth = Math.max(1, viewport.candleWidth * 0.6);
    for (let j = first; j <= last; j++) {
      const v = values[j - offset];
      if (v === undefined || !Number.isFinite(v)) continue;
      const x = viewport.xForIndex(j);
      const y = yForValue(viewport, line, v);
      ctx.fillRect(x - barWidth / 2, Math.min(y, zeroY), barWidth, Math.max(1, Math.abs(y - zeroY)));
    }
  } else {
    ctx.beginPath();
    let pen = false;
    for (let j = first; j <= last; j++) {
      const v = values[j - offset];
      if (v === undefined || !Number.isFinite(v)) {
        pen = false;
        continue;
      }
      const x = viewport.xForIndex(j);
      const y = yForValue(viewport, line, v);
      if (pen) ctx.lineTo(x, y);
      else {
        ctx.moveTo(x, y);
        pen = true;
      }
    }
    ctx.stroke();
  }

  if (dashed) ctx.setLineDash([]);
}

function drawArea(ctx: RenderSurface, viewport: Viewport, area: IndicatorArea): void {
  const { top, bottom, offset = 0 } = area;
  const first = Math.max(0, Math.floor(viewport.visibleRange.from));
  const last = Math.min(
    Math.ceil(viewport.visibleRange.to),
    top.length - 1 + offset,
    bottom.length - 1 + offset,
  );
  if (first > last) return;

  ctx.fillStyle = area.color;
  ctx.beginPath();
  let pen = false;
  for (let j = first; j <= last; j++) {
    const v = top[j - offset];
    if (v === undefined || !Number.isFinite(v)) {
      pen = false;
      continue;
    }
    const x = viewport.xForIndex(j);
    const y = yForValue(viewport, area, v);
    if (pen) ctx.lineTo(x, y);
    else {
      ctx.moveTo(x, y);
      pen = true;
    }
  }
  pen = false;
  for (let j = last; j >= first; j--) {
    const v = bottom[j - offset];
    if (v === undefined || !Number.isFinite(v)) {
      pen = false;
      continue;
    }
    const x = viewport.xForIndex(j);
    const y = yForValue(viewport, area, v);
    if (pen) ctx.lineTo(x, y);
    else {
      ctx.moveTo(x, y);
      pen = true;
    }
  }
  ctx.closePath();
  ctx.fill();
}

export interface IndicatorPluginOptions {
  /** Unique plugin name (visible in the plugin list). */
  readonly name: string;
  /** Recompute the indicator result from the full candle series. */
  readonly compute: (candles: readonly Candle[]) => IndicatorResult;
}

export function indicatorPlugin(options: IndicatorPluginOptions): Plugin {
  let result: IndicatorResult = { lines: [] };
  let lastLength = -1;
  let lastCandle: Candle | undefined;

  return {
    name: options.name,
    initialize(): void {
      // Computation happens lazily in update(); no listeners to wire.
    },
    update(chart: ChartApi): void {
      const data = chart.data;
      if (data.length !== lastLength || data[data.length - 1] !== lastCandle) {
        lastLength = data.length;
        lastCandle = data[data.length - 1];
        result = options.compute(data);
      }
    },
    draw(_chart: ChartApi, viewport: Viewport, ctx: RenderSurface | undefined): void {
      if (ctx === undefined) return;
      for (const area of result.areas ?? []) drawArea(ctx, viewport, area);
      for (const line of result.lines) drawLine(ctx, viewport, line);
    },
  };
}
