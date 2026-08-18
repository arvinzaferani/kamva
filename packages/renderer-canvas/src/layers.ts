import type { Candle, Point, Viewport } from "@kamvachart/chart-core";
import { priceTicks, timeTickIndices } from "@kamvachart/chart-core";
import type { Theme } from "./theme.js";

/**
 * Layers are stateless draw functions following the pipeline in
 * RENDER_PIPELINE.md: viewport (already resolved to pixel mapping) -> canvas.
 * Each takes the 2D context plus everything it needs explicitly, so layers
 * are individually testable and composable in any order.
 */

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  theme: Theme,
): void {
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, viewport.size.width, viewport.size.height);
}

export function drawGrid(ctx: CanvasRenderingContext2D, viewport: Viewport, theme: Theme): void {
  const { width, height } = viewport.size;
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const price of priceTicks(viewport.priceRange.min, viewport.priceRange.max)) {
    const y = Math.round(viewport.yForPrice(price)) + 0.5;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  for (const index of timeTickIndices(viewport.visibleRange.from, viewport.visibleRange.to)) {
    const x = Math.round(viewport.xForIndex(index)) + 0.5;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  ctx.stroke();
}

export function drawCandles(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  candles: readonly Candle[],
  theme: Theme,
): void {
  // Virtualized: only indices inside the visible range are touched, so cost
  // scales with what is on screen, not with series length (PERFORMANCE.md).
  const first = Math.max(0, Math.floor(viewport.visibleRange.from));
  const last = Math.min(candles.length - 1, Math.ceil(viewport.visibleRange.to));
  const slot = viewport.candleWidth;
  const bodyWidth = Math.max(1, slot * 0.7);

  for (let i = first; i <= last; i++) {
    const c = candles[i];
    if (c === undefined) continue;
    const up = c.close >= c.open;
    const x = viewport.xForIndex(i);
    const yHigh = viewport.yForPrice(c.high);
    const yLow = viewport.yForPrice(c.low);
    const yOpen = viewport.yForPrice(c.open);
    const yClose = viewport.yForPrice(c.close);

    // wick
    ctx.strokeStyle = up ? theme.wickUp : theme.wickDown;
    ctx.lineWidth = Math.max(1, slot * 0.08);
    ctx.beginPath();
    ctx.moveTo(x, yHigh);
    ctx.lineTo(x, yLow);
    ctx.stroke();

    // body — at least 1px tall so dojis stay visible
    ctx.fillStyle = up ? theme.candleUp : theme.candleDown;
    const top = Math.min(yOpen, yClose);
    const bodyHeight = Math.max(1, Math.abs(yClose - yOpen));
    ctx.fillRect(x - bodyWidth / 2, top, bodyWidth, bodyHeight);
  }
}

export interface AxisFormatters {
  price(value: number): string;
  time(value: number): string;
}

export const defaultFormatters: AxisFormatters = {
  price: (v) => (Math.abs(v) >= 1000 ? v.toFixed(0) : v.toFixed(2)),
  time: (t) => {
    const d = new Date(t);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  },
};

export function drawAxes(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  candles: readonly Candle[],
  theme: Theme,
  formatters: AxisFormatters,
): void {
  ctx.font = theme.font;
  ctx.fillStyle = theme.axisText;

  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (const price of priceTicks(viewport.priceRange.min, viewport.priceRange.max)) {
    ctx.fillText(formatters.price(price), viewport.size.width - 6, viewport.yForPrice(price));
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  for (const index of timeTickIndices(viewport.visibleRange.from, viewport.visibleRange.to)) {
    const c = candles[index];
    if (c === undefined) continue;
    ctx.fillText(formatters.time(c.time), viewport.xForIndex(index), viewport.size.height - 4);
  }
}

export function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  pointer: Point,
  theme: Theme,
  formatters: AxisFormatters,
): void {
  const { width, height } = viewport.size;
  const x = Math.round(pointer.x) + 0.5;
  const y = Math.round(pointer.y) + 0.5;

  ctx.strokeStyle = theme.crosshair;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();
  ctx.setLineDash([]);

  // price label at the right edge
  const label = formatters.price(viewport.priceForY(pointer.y));
  ctx.font = theme.font;
  const metrics = ctx.measureText(label);
  const padX = 6;
  const boxW = metrics.width + padX * 2;
  const boxH = 18;
  ctx.fillStyle = theme.crosshairLabelBg;
  ctx.fillRect(width - boxW, y - boxH / 2, boxW, boxH);
  ctx.fillStyle = theme.crosshairLabelText;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(label, width - padX, y);
}
