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
  private moved = false;
  private lastX = 0;
  private lastY = 0;
  /** Active gesture: pan by default, or a chart-edge resize handle. */
  private mode: "pan" | "edgeH" | "edgeV" = "pan";
  /** Fixed anchors captured at gesture start so resizing is jump-free. */
  private hAnchor = 0.5;
  private vAnchorPrice: number | undefined;
  private readonly abort = new AbortController();

  /** Edge hit-zone thickness in CSS pixels. */
  private static readonly EDGE = 12;

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

  private edgeMode(rect: DOMRect, clientX: number, clientY: number): "edgeH" | "edgeV" | "pan" {
    const atBottom = clientY - rect.top >= rect.height - InteractionController.EDGE;
    const atRight = clientX - rect.left >= rect.width - InteractionController.EDGE;
    if (atBottom) return "edgeH"; // drag left/right => horizontal contract/expand
    if (atRight) return "edgeV"; // drag up/down => vertical contract/expand
    return "pan";
  }

  private applyCursor(mode: "edgeH" | "edgeV" | "pan"): void {
    this.canvas.style.cursor =
      mode === "edgeH" ? "ew-resize" : mode === "edgeV" ? "ns-resize" : "crosshair";
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
    const rect = this.canvas.getBoundingClientRect();
    this.mode = this.edgeMode(rect, e.clientX, e.clientY);
    const y = e.clientY - rect.top;
    this.hAnchor = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0.5;
    this.vAnchorPrice = this.chart.viewport?.priceForY(y);
    this.dragging = true;
    this.moved = false;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.canvas.setPointerCapture(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    this.renderer.setPointer(point);
    this.chart.emit("pointer:move", point);

    if (!this.dragging) {
      this.applyCursor(this.edgeMode(rect, e.clientX, e.clientY));
      return;
    }

    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    if (dx !== 0 || dy !== 0) this.moved = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;

    if (this.mode === "edgeH") {
      // Drag right => contract (zoom in), drag left => expand (zoom out).
      // Zoom about the candle that was under the cursor when the drag started.
      this.chart.zoom(Math.exp(dx * 0.01), this.hAnchor);
      return;
    }
    if (this.mode === "edgeV") {
      // Drag down => contract (zoom into price), drag up => expand.
      // Keep the price under the cursor at gesture start fixed.
      this.chart.zoomPrice(Math.exp(dy * 0.01), this.vAnchorPrice);
      return;
    }

    const viewport = this.chart.viewport;
    if (!viewport || viewport.candleWidth <= 0) return;
    // Dragging right moves the view to older candles.
    this.chart.pan(-dx / viewport.candleWidth);
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.canvas.releasePointerCapture(e.pointerId);
    if (this.dragging && !this.moved) {
      const rect = this.canvas.getBoundingClientRect();
      this.chart.emitClick(e.clientX - rect.left, e.clientY - rect.top);
    }
    this.dragging = false;
    this.mode = "pan";
  };

  private onPointerLeave = (): void => {
    this.dragging = false;
    this.moved = false;
    this.mode = "pan";
    this.renderer.setPointer(undefined);
    this.chart.emit("pointer:leave", undefined);
  };
}
