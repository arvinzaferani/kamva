/**
 * Visual configuration only — no logic (see ARCHITECTURE.md: themes are
 * configuration). Colors are plain CSS color strings.
 */
export interface Theme {
  readonly background: string;
  readonly grid: string;
  readonly axisText: string;
  readonly candleUp: string;
  readonly candleDown: string;
  readonly wickUp: string;
  readonly wickDown: string;
  readonly crosshair: string;
  readonly crosshairLabelBg: string;
  readonly crosshairLabelText: string;
  readonly font: string;
}

export const darkTheme: Theme = {
  background: "#131722",
  grid: "#1f2733",
  axisText: "#9aa4b2",
  candleUp: "#26a69a",
  candleDown: "#ef5350",
  wickUp: "#26a69a",
  wickDown: "#ef5350",
  crosshair: "#758696",
  crosshairLabelBg: "#2a2e39",
  crosshairLabelText: "#d1d4dc",
  font: "11px -apple-system, system-ui, sans-serif",
};

export const lightTheme: Theme = {
  background: "#ffffff",
  grid: "#eceff2",
  axisText: "#5d6570",
  candleUp: "#26a69a",
  candleDown: "#ef5350",
  wickUp: "#26a69a",
  wickDown: "#ef5350",
  crosshair: "#9aa4b2",
  crosshairLabelBg: "#f0f3f6",
  crosshairLabelText: "#131722",
  font: "11px -apple-system, system-ui, sans-serif",
};
