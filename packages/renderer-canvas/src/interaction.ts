import type { Chart } from "@kamvachart/chart-core";
import type { CanvasRenderer } from "./canvas-renderer.js";

/**
 * Translates DOM input into chart navigation:
 *   wheel        -> zoom anchored at the cursor
 *   drag         -> pan
 *   move / leave -> crosshair via pointer events
 *
 * Lives in renderer-canvas because it is DOM-specific; chart-core must
 * stay free of browser APIs (see ARCHITECTURE.md).
 */
export class InteractionController {
  private dragging = false;
  private lastX = 0;
  private readonly abort = new AbortController();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly chart: Chart,
    private readonly renderer: CanvasRenderer,
  ) {
    const { signal } = this.abort;
    canvas.addEventListener("wheel", this.onWheel, { passive: false, signal });
    canvas.addEventListener("pointerdown", this.onPointerDown, { signal });
    canvas.addEventListener("pointermove", this.onPointerMove, { signal });
    canvas.addEventListener("pointerup", this.onPointerUp, { signal });
    canvas.addEventListener("pointerleave", this.onPointerLeave, { signal });
  }

  destroy(): void {
    this.abort.abort();
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const anchor = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0.5;
    // ~10% zoom per wheel notch, exponential so it composes smoothly.
    const factor = Math.exp(-e.deltaY * 0.001);
    this.chart.zoom(factor, anchor);
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.dragging = true;
    this.lastX = e.clientX;
    this.canvas.setPointerCapture(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    this.renderer.setPointer(point);
    this.chart.emit("pointer:move", point);

    if (!this.dragging) return;
    const dxPixels = e.clientX - this.lastX;
    this.lastX = e.clientX;
    const viewport = this.chart.viewport;
    if (!viewport || viewport.candleWidth <= 0) return;
    // Dragging right moves the view to older candles.
    this.chart.pan(-dxPixels / viewport.candleWidth);
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.dragging = false;
    this.canvas.releasePointerCapture(e.pointerId);
  };

  private onPointerLeave = (): void => {
    this.dragging = false;
    this.renderer.setPointer(undefined);
    this.chart.emit("pointer:leave", undefined);
  };
}
