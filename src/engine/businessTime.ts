// Business-time maths in Europe/Amsterdam. Pure functions, no React.
// All instants are epoch milliseconds (UTC). Daylight saving is handled through Intl.
import type { BusinessHours } from "../types";

export const MINUTE_MS = 60_000;
const TZ = "Europe/Amsterdam";

const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export interface LocalParts {
  year: number;
  month: number; // 1 to 12
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday to 6 = Saturday. */
  weekday: number;
}

const HOUR_MS = 3_600_000;
const offsetCache = new Map<number, number>();

/**
 * Amsterdam UTC offset for the UTC hour that contains `ms`. Amsterdam offsets are whole hours
 * and change only on UTC hour boundaries, so one Intl lookup per hour is enough.
 */
function offsetForHour(ms: number): number {
  const hourKey = Math.floor(ms / HOUR_MS);
  let offset = offsetCache.get(hourKey);
  if (offset === undefined) {
    const at = hourKey * HOUR_MS;
    const parts: Record<string, number> = {};
    for (const p of formatter.formatToParts(new Date(at))) {
      if (p.type !== "literal") parts[p.type] = Number(p.value);
    }
    offset = Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour!, parts.minute!, parts.second!) - at;
    offsetCache.set(hourKey, offset);
  }
  return offset;
}

/** Wall-clock parts of an instant in Amsterdam. */
export function amsterdamParts(ms: number): LocalParts {
  const local = new Date(ms + offsetForHour(ms));
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
    second: local.getUTCSeconds(),
    weekday: local.getUTCDay(),
  };
}

function offsetMs(ms: number): number {
  return offsetForHour(ms);
}

/** The instant of an Amsterdam wall-clock time. Month is 1 to 12. Day may overflow (32 = next month). */
export function amsterdamToUtc(year: number, month: number, day: number, hour = 0, minute = 0): number {
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  let guess = naive - offsetMs(naive);
  guess = naive - offsetMs(guess);
  return guess;
}

/** Start of the Amsterdam calendar day that contains `ms`. */
export function startOfAmsterdamDay(ms: number): number {
  const p = amsterdamParts(ms);
  return amsterdamToUtc(p.year, p.month, p.day);
}

function hm(value: string): [number, number] {
  const [hh, mm] = value.split(":").map(Number);
  return [hh ?? 0, mm ?? 0];
}

/** The business window [start, end) on the Amsterdam day that contains `ms`, or null if that day is closed. */
function windowOn(ms: number, hours: BusinessHours): { start: number; end: number } | null {
  const p = amsterdamParts(ms);
  if (!hours.days.includes(p.weekday)) return null;
  const [sh, sm] = hm(hours.start);
  const [eh, em] = hm(hours.end);
  return {
    start: amsterdamToUtc(p.year, p.month, p.day, sh, sm),
    end: amsterdamToUtc(p.year, p.month, p.day, eh, em),
  };
}

/** Noon on the next Amsterdam day. Noon avoids daylight-saving edges. */
function nextDay(ms: number): number {
  const p = amsterdamParts(ms);
  return amsterdamToUtc(p.year, p.month, p.day + 1, 12, 0);
}

/** The instant reached after `minutes` business minutes from `startMs`. */
export function addBusinessMinutes(startMs: number, minutes: number, hours: BusinessHours | "24x7"): number {
  if (hours === "24x7") return startMs + minutes * MINUTE_MS;
  let t = startMs;
  let left = minutes * MINUTE_MS;
  for (let guard = 0; guard < 10_000; guard++) {
    const w = windowOn(t, hours);
    if (w && t < w.end) {
      const from = Math.max(t, w.start);
      if (left <= w.end - from) return from + left;
      left -= w.end - from;
    }
    const n = nextDay(t);
    const nw = windowOn(n, hours);
    t = nw ? nw.start : n;
  }
  throw new Error("addBusinessMinutes did not converge");
}

/** Business minutes between two instants (0 if `endMs` is not after `startMs`). */
export function businessMinutesBetween(startMs: number, endMs: number, hours: BusinessHours | "24x7"): number {
  if (endMs <= startMs) return 0;
  if (hours === "24x7") return (endMs - startMs) / MINUTE_MS;
  let total = 0;
  let t = startMs;
  for (let guard = 0; guard < 10_000 && t < endMs; guard++) {
    const w = windowOn(t, hours);
    if (w && t < w.end) {
      const from = Math.max(t, w.start);
      const to = Math.min(endMs, w.end);
      if (to > from) total += to - from;
    }
    const n = nextDay(t);
    const nw = windowOn(n, hours);
    t = nw ? nw.start : n;
  }
  return total / MINUTE_MS;
}
