import { describe, it, expectTypeOf } from "vitest";
import { Chart, type Series, type ChartApi, type ChartEvents } from "../src/index.js";
import type {
  ClickPayload,
  CrosshairPosition,
  CrosshairSeriesDatum,
  PriceScaleApi,
  TimeRange,
  TimeScaleApi,
  VisibleRangePayload,
  ChartSubscriptions,
} from "../src/index.js";
import type { Candle, LineSeriesPoint, Point } from "../src/types.js";

/**
 * Compile-time assertions that the public API surface is intentional and
 * correctly typed. These run without executing logic; `expectTypeOf` fails
 * the test if an inferred type does not match.
 */
describe("public API types", () => {
  it("chart methods return the public contracts", () => {
    const chart = new Chart();
    expectTypeOf(chart.addCandlestickSeries).returns.toEqualTypeOf<
      (options?: { color?: string; lineWidth?: number }) => Series<Candle>
    >();
    expectTypeOf(chart.addLineSeries).returns.toEqualTypeOf<
      (options?: { color?: string; lineWidth?: number }) => Series<LineSeriesPoint>
    >();
    expectTypeOf(chart.timeScale).returns.toEqualTypeOf<() => TimeScaleApi>();
    expectTypeOf(chart.priceScale).returns.toEqualTypeOf<() => PriceScaleApi>();
    expectTypeOf(chart.subscribe).returns.toEqualTypeOf<
      <E extends keyof ChartSubscriptions>(
        event: E,
        handler: (payload: ChartSubscriptions[E]) => void,
      ) => () => void
    >();
    chart.destroy();
  });

  it("subscribe payloads are strongly typed", () => {
    const chart = new Chart();
    chart.subscribe("crosshairMove", (p) => {
      expectTypeOf(p!).toMatchTypeOf<CrosshairPosition>();
      expectTypeOf(p!.seriesData).toEqualTypeOf<readonly CrosshairSeriesDatum[]>();
    });
    chart.subscribe("click", (c) => expectTypeOf(c).toEqualTypeOf<ClickPayload>());
    chart.subscribe("pointerMove", (p) => expectTypeOf(p).toEqualTypeOf<Point>());
    chart.subscribe("viewportChange", (v) =>
      expectTypeOf(v).toEqualTypeOf<VisibleRangePayload>(),
    );
    chart.destroy();
  });

  it("the event bus is keyed on ChartEvents", () => {
    const chart = new Chart();
    chart.on("crosshairMove", (p) => expectTypeOf(p).toMatchTypeOf<CrosshairPosition | undefined>());
    chart.on("visibleRangeChange", (v) => expectTypeOf(v).toEqualTypeOf<VisibleRangePayload>());
    chart.on("click", (c) => expectTypeOf(c).toEqualTypeOf<ClickPayload>());
    chart.destroy();
  });

  it("Chart structurally satisfies ChartApi", () => {
    const chart = new Chart();
    const api: ChartApi = chart;
    expectTypeOf(api).toMatchTypeOf<ChartApi>();
    expectTypeOf<keyof ChartApi>().toEqualTypeOf<
      | "addCandlestickSeries"
      | "addLineSeries"
      | "setData"
      | "append"
      | "update"
      | "removeSeries"
      | "zoom"
      | "pan"
      | "fit"
      | "timeScale"
      | "priceScale"
      | "zoomPrice"
      | "on"
      | "subscribe"
      | "data"
      | "viewport"
    >();
    chart.destroy();
  });

  it("time scale uses the shared TimeRange shape", () => {
    expectTypeOf<TimeRange>().toEqualTypeOf<{ from: number; to: number }>();
    expectTypeOf<ChartEvents["visibleRangeChange"]>().toEqualTypeOf<VisibleRangePayload>();
  });
});