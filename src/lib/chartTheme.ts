// Chart colours. Channel series use the first 4 slots of the validated reference palette, in fixed
// order, each stepped for its theme (validated against #ffffff and #020617). Colour follows the
// channel, never its rank. Single-series charts use slot 1.
import type { Channel } from "../types";

export interface ChartTheme {
  series: Record<Channel, string>;
  single: string;
  grid: string;
  axis: string;
  text: string;
  goLive: string;
  surface: string;
}

export function chartTheme(dark: boolean): ChartTheme {
  return dark
    ? { series: { email: "#3987e5", web_form: "#d95926", chat: "#199e70", phone: "#c98500" }, single: "#3987e5", grid: "#1e293b", axis: "#cbd5e1", text: "#e2e8f0", goLive: "#e2e8f0", surface: "#0f172a" }
    : { series: { email: "#2a78d6", web_form: "#eb6834", chat: "#1baf7a", phone: "#eda100" }, single: "#2a78d6", grid: "#e2e8f0", axis: "#475569", text: "#0f172a", goLive: "#334155", surface: "#ffffff" };
}
