import "./styles.css";
import {
  createChart,
  type Candle,
  type Plugin,
  sma,
  ema,
  rsi,
  macd,
  atr,
  bollingerBands,
  vwap,
  computeSMA,
  computeEMA,
  computeRSI,
  computeMACD,
  computeATR,
  computeBollinger,
  computeVWAP,
} from "kamvachart";
import {
  generateCandles,
  refIndex,
  tickCandle,
  nextCandle,
  SYMBOLS,
  TIMEFRAMES,
  type CandleInput,
  type SymbolKey,
} from "./data";
import { formatTimeForSpan } from "./timeaxis";

/* ------------------------------------------------------------------ UI refs */

const canvas = document.getElementById("chart") as HTMLCanvasElement;
const symbolEl = document.getElementById("symbol") as HTMLElement;
const priceEl = document.getElementById("price") as HTMLElement;
const changeEl = document.getElementById("change") as HTMLElement;
const ohlcEl = document.getElementById("ohlc") as HTMLElement;
const legendEl = document.getElementById("legend") as HTMLElement;
const indicatorsEl = document.getElementById("indicators") as HTMLElement;
const timeframesEl = document.getElementById("timeframes") as HTMLElement;
const symbolsEl = document.getElementById("symbols") as HTMLElement;
const realtimeEl = document.getElementById("realtime") as HTMLInputElement;

/* --------------------------------------------------------------- formatting */

const fmt = (v: number | undefined | null, d = 2): string =>
  v === undefined || v === null || !Number.isFinite(v)
    ? "—"
    : v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const lastDefined = (v: readonly (number | undefined)[]): number | undefined => {
  for (let i = v.length - 1; i >= 0; i--) if (v[i] !== undefined) return v[i];
  return undefined;
};

/* ------------------------------------------------------------------- chart */

// Time-axis labels adapt to the visible span (thus timeframe + zoom): intraday
// -> HH:mm, a few days -> "Feb 4 13:00", a month -> "Feb 4", more -> "Feb 2026".
function fmtTime(t: number): string {
  const vp = chart.viewport;
  const spanBars = vp ? vp.visibleRange.to - vp.visibleRange.from : 40;
  return formatTimeForSpan(t, Math.max(0, spanBars) * currentTick.ms);
}

const chart = createChart(canvas, {
  formatters: {
    price: (v) => (Math.abs(v) >= 1000 ? v.toFixed(0) : v.toFixed(2)),
    time: fmtTime,
  },
});

/* ------------------------------------------------------------ headless stats */

function refreshQuote(): void {
  const d = chart.data;
  const last = d[d.length - 1];
  if (!last) return;
  const ref = d[refIndex(d.length, currentTick.ms)] ?? d[0];
  const change = ref ? ((last.close - ref.close) / ref.close) * 100 : 0;
  priceEl.textContent = fmt(last.close);
  changeEl.textContent = `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
  changeEl.className = `change ${change >= 0 ? "up" : "down"}`;
  ohlcEl.textContent =
    `O ${fmt(last.open)}  H ${fmt(last.high)}  L ${fmt(last.low)}  C ${fmt(last.close)}`;
  renderLegend();
}

setInterval(refreshQuote, 400);

/* ------------------------------------------------------------------- view */

function renderLegend(): void {
  const d = chart.data;
  const parts: string[] = [];
  for (const i of enabledIndices) {
    const ind = indicators[i];
    if (!ind) continue;
    const v = ind.latest(d);
    if (v === undefined) continue;
    parts.push(`<span><i style="background:${ind.color}"></i>${ind.label} ${fmt(v)}</span>`);
  }
  legendEl.innerHTML = parts.join("\u2002\u00b7\u2002");
  legendEl.style.display = parts.length ? "" : "none";
}

// Mirrors indicatorColors from @kamvachart/indicators (not part of the facade).
const COLORS = {
  teal: "#26a69a",
  blue: "#2962ff",
  orange: "#ff9800",
  gray: "#787b86",
  purple: "#9c27b0",
} as const;

/* --------------------------------------------------------------- indicators */

interface IndicatorDef {
  label: string;
  color: string;
  name: string;
  defaultOn: boolean;
  make: () => Plugin;
  latest: (data: readonly Candle[]) => number | undefined;
}

const indicators: IndicatorDef[] = [
  {
    label: "SMA 20",
    color: COLORS.teal,
    name: "sma(20)",
    defaultOn: true,
    make: () => sma({ period: 20 }),
    latest: (d) => lastDefined(computeSMA(d, 20)),
  },
  {
    label: "EMA 50",
    color: COLORS.blue,
    name: "ema(50)",
    defaultOn: true,
    make: () => ema({ period: 50 }),
    latest: (d) => lastDefined(computeEMA(d, 50)),
  },
  {
    label: "Bollinger 20, 2",
    color: COLORS.orange,
    name: "bollinger(20,2)",
    defaultOn: false,
    make: () => bollingerBands({ period: 20, multiplier: 2 }),
    latest: (d) => lastDefined(computeBollinger(d, 20, 2).middle),
  },
  {
    label: "VWAP",
    color: COLORS.gray,
    name: "vwap",
    defaultOn: false,
    make: () => vwap(),
    latest: (d) => lastDefined(computeVWAP(d)),
  },
  {
    label: "RSI 14",
    color: COLORS.purple,
    name: "rsi(14)",
    defaultOn: false,
    make: () => rsi({ period: 14 }),
    latest: (d) => lastDefined(computeRSI(d, 14)),
  },
  {
    label: "MACD 12, 26, 9",
    color: COLORS.blue,
    name: "macd(12, 26, 9)",
    defaultOn: false,
    make: () => macd({}),
    latest: (d) => lastDefined(computeMACD(d).macd),
  },
  {
    label: "ATR 14",
    color: COLORS.orange,
    name: "atr(14)",
    defaultOn: false,
    make: () => atr({}),
    latest: (d) => lastDefined(computeATR(d, 14)),
  },
];

const enabledIndices = new Set<number>();

function renderIndicatorChips(): void {
  for (const ind of indicators) chart.removePlugin(ind.name); // clear stale plugins first
  enabledIndices.clear();
  indicatorsEl.innerHTML = "";
  for (let i = 0; i < indicators.length; i++) {
    const ind = indicators[i]!;
    const on = ind.defaultOn;
    const chip = document.createElement("label");
    chip.className = `chip${on ? " on" : ""}`;
    chip.innerHTML =
      `<input type="checkbox" ${on ? "checked" : ""}/>` +
      `<span class="dot" style="background:${ind.color}"></span>` +
      `<span>${ind.label}</span>`;
    const cb = chip.querySelector("input") as HTMLInputElement;
    cb.addEventListener("change", () => {
      chip.classList.toggle("on", cb.checked);
      if (cb.checked) {
        chart.use(ind.make());
        enabledIndices.add(i);
      } else {
        chart.removePlugin(ind.name);
        enabledIndices.delete(i);
      }
      renderLegend();
    });
    indicatorsEl.appendChild(chip);
    if (on) {
      chart.use(ind.make());
      enabledIndices.add(i);
    }
  }
  renderLegend();
}

/* ---------------------------------------------------------------- realtime */

type LiveState = { current: CandleInput };

function seedData(symbol: SymbolKey): LiveState {
  const data = generateCandles(currentTick.count, symbol, currentTick.ms);
  chart.setData(data as unknown as Candle[]);
  return { current: data[data.length - 1]! };
}

let liveTimer: number | undefined;
let live: LiveState | undefined;
let liveTicks = 0;

stopLive();

function stopLive(): void {
  if (liveTimer !== undefined) {
    window.clearInterval(liveTimer);
    liveTimer = undefined;
  }
}

function startLive(): void {
  stopLive();
  if (!live) live = seedData(currentSymbol);
  liveTimer = window.setInterval(() => {
    if (!live) return;
    liveTicks++;
    if (liveTicks % 4 === 0) {
      // close out the current candle, open the next one
      live.current = nextCandle(live.current, currentTick.ms);
      chart.append(live.current as unknown as Candle);
    } else {
      live.current = tickCandle(live.current);
      chart.update(live.current as unknown as Candle);
    }
    refreshQuote();
  }, 1500);
}

realtimeEl.addEventListener("change", () => {
  if (realtimeEl.checked) startLive();
  else stopLive();
});

/* ----------------------------------------------------------- resample reset */

function reseed(restartLive: boolean): void {
  renderIndicatorChips(); // re-seed indicator plugins against the new primary
  const wasLive = restartLive && realtimeEl.checked;
  if (wasLive) stopLive();
  live = seedData(currentSymbol);
  refreshQuote();
  if (wasLive) startLive();
}

/* ------------------------------------------------------------------ symbols */

let currentSymbol: SymbolKey = "BTC";

function renderSymbolChips(): void {
  symbolsEl.innerHTML = "";
  for (const key of SYMBOLS) {
    const label = key === "VOL" ? "Volatile / USD" : `${key} / USD`;
    const chip = document.createElement("label");
    chip.className = `chip${key === currentSymbol ? " on" : ""}`;
    chip.innerHTML = `<span>${label}</span>`;
    chip.addEventListener("click", (e) => {
      e.preventDefault();
      if (key === currentSymbol) return;
      currentSymbol = key;
      renderSymbolChips();
      symbolEl.textContent = label;
      reseed(true);
    });
    symbolsEl.appendChild(chip);
  }
}

/* -------------------------------------------------------------- timeframes */

let currentTick = TIMEFRAMES[0]!;

function renderTimeframeChips(): void {
  timeframesEl.innerHTML = "";
  for (const tf of TIMEFRAMES) {
    const chip = document.createElement("label");
    chip.className = `chip${tf === currentTick ? " on" : ""}`;
    chip.innerHTML = `<span>${tf.label}</span>`;
    chip.addEventListener("click", (e) => {
      e.preventDefault();
      if (tf === currentTick) return;
      currentTick = tf;
      renderTimeframeChips();
      reseed(true);
    });
    timeframesEl.appendChild(chip);
  }
}

/* ------------------------------------------------------------------- view */

const zoomInBtn = document.getElementById("zoom-in") as HTMLButtonElement;
const zoomOutBtn = document.getElementById("zoom-out") as HTMLButtonElement;
const fitBtn = document.getElementById("fit") as HTMLButtonElement;
zoomInBtn.addEventListener("click", () => chart.zoom(1.25, 0.5));
zoomOutBtn.addEventListener("click", () => chart.zoom(0.8, 0.5));
fitBtn.addEventListener("click", () => chart.fit());

/* -------------------------------------------------------------------- boot */

symbolEl.textContent = "BTC / USD";
renderIndicatorChips();
renderSymbolChips();
renderTimeframeChips();
live = seedData(currentSymbol);
refreshQuote();
startLive();