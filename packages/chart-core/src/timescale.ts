import type { Camera } from "./camera.js";
import type { TimeRange, TimeScaleApi, VisibleRangePayload } from "./contracts.js";
import type { SeriesManager } from "./series-manager.js";

interface TimeScaleDeps {
  camera: Camera;
  manager: SeriesManager;
  /** Notify listeners that the visible range changed. */
  notifyChange: () => void;
  /** Register a listener for raw visible-range changes (returns an unsubscribe). */
  subscribeRaw: (handler: (payload: VisibleRangePayload) => void) => () => void;
}

/**
 * The chart's shared time axis.
 *
 * Time is the single coordinate system every series shares ("from index
 * space" is only how the camera stores it internally). This class:
 *  - maps time<->primary-index at its boundary, reusing the Camera for the
 *    actual navigation so no time-range logic is duplicated per series;
 *  - exposes an API that always deals in time, not indices.
 */
export class TimeScale implements TimeScaleApi {
  constructor(private readonly deps: TimeScaleDeps) {}

  /** Show all content of every visible series on the shared time axis. */
  fitContent(): void {
    const range = this.deps.manager.timeRange();
    if (range === undefined) return;
    const from = this.deps.manager.primaryIndexFirstAt(range.from);
    const to = this.deps.manager.primaryIndexLastAt(range.to);
    this.setIndexRange(from, to);
  }

  /** Reset to the full extent of the primary (x-axis) series. */
  reset(): void {
    const length = this.deps.manager.primaryLength();
    this.deps.camera.fit(length);
    this.deps.camera.clampToData(length, 0);
    this.deps.notifyChange();
  }

  /** Set the visible window in time. Affects every series consistently. */
  setVisibleRange(range: TimeRange): void {
    const from = this.deps.manager.primaryIndexFirstAt(range.from);
    const to = this.deps.manager.primaryIndexLastAt(range.to);
    this.setIndexRange(from, to);
  }

  /** The currently visible time window. */
  getVisibleRange(): TimeRange {
    return {
      from: this.deps.manager.primaryTimeAtIndex(this.deps.camera.range.from),
      to: this.deps.manager.primaryTimeAtIndex(this.deps.camera.range.to),
    };
  }

  /** Subscribe to visible-range changes; returns an unsubscribe function. */
  subscribe(handler: (range: TimeRange) => void): () => void {
    return this.deps.subscribeRaw((payload) =>
      handler({ from: payload.fromTime, to: payload.toTime }),
    );
  }

  private setIndexRange(fromIdx: number, toIdx: number): void {
    const length = this.deps.manager.primaryLength();
    if (length <= 0) return;
    fromIdx = Math.max(0, Math.min(fromIdx, length - 2));
    toIdx = Math.max(fromIdx + 1, Math.min(toIdx, length - 1));
    if (toIdx <= fromIdx) return;
    this.deps.camera.setRange(fromIdx, toIdx);
    this.deps.camera.clampToData(length, 0);
    this.deps.notifyChange();
  }
}