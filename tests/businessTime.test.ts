import { addBusinessMinutes, amsterdamParts, amsterdamToUtc, businessMinutesBetween } from "../src/engine/businessTime";
import type { BusinessHours } from "../src/types";

const MON_FRI: BusinessHours = { tz: "Europe/Amsterdam", start: "08:00", end: "20:00", days: [1, 2, 3, 4, 5] };
const ams = (d: string, hh: number, mm = 0) => {
  const [y, m, day] = d.split("-").map(Number) as [number, number, number];
  return amsterdamToUtc(y, m, day, hh, mm);
};

describe("business time (Europe/Amsterdam)", () => {
  it("converts Amsterdam wall time across the October clock change", () => {
    expect(new Date(ams("2026-10-23", 9)).toISOString()).toBe("2026-10-23T07:00:00.000Z"); // CEST, UTC+2
    expect(new Date(ams("2026-10-26", 9)).toISOString()).toBe("2026-10-26T08:00:00.000Z"); // CET, UTC+1
    expect(amsterdamParts(Date.parse("2026-10-25T12:00:00Z"))).toMatchObject({ hour: 13, weekday: 0 });
  });

  it("adds minutes inside one business day", () => {
    expect(addBusinessMinutes(ams("2026-11-10", 9), 90, MON_FRI)).toBe(ams("2026-11-10", 10, 30));
  });

  it("rolls from 20:00 to 08:00 the next day", () => {
    expect(addBusinessMinutes(ams("2026-11-10", 19, 30), 60, MON_FRI)).toBe(ams("2026-11-11", 8, 30));
  });

  it("starts the clock at 08:00 for a ticket created at night", () => {
    expect(addBusinessMinutes(ams("2026-11-10", 2), 30, MON_FRI)).toBe(ams("2026-11-10", 8, 30));
  });

  it("skips the weekend", () => {
    expect(addBusinessMinutes(ams("2026-11-13", 19), 120, MON_FRI)).toBe(ams("2026-11-16", 9)); // Fri to Mon
    expect(addBusinessMinutes(ams("2026-11-14", 11), 10, MON_FRI)).toBe(ams("2026-11-16", 8, 10)); // Sat to Mon
  });

  it("skips the weekend that contains the clock change", () => {
    expect(addBusinessMinutes(ams("2026-10-23", 19), 120, MON_FRI)).toBe(ams("2026-10-26", 9));
  });

  it("treats 24x7 as plain minutes", () => {
    const t = ams("2026-11-14", 23);
    expect(addBusinessMinutes(t, 90, "24x7")).toBe(t + 90 * 60_000);
  });

  it("counts business minutes between two instants", () => {
    expect(businessMinutesBetween(ams("2026-11-13", 19), ams("2026-11-16", 9), MON_FRI)).toBe(120);
    expect(businessMinutesBetween(ams("2026-11-10", 20), ams("2026-11-11", 8), MON_FRI)).toBe(0);
    expect(businessMinutesBetween(ams("2026-11-10", 8), ams("2026-11-11", 8), MON_FRI)).toBe(720);
  });

  it("is the inverse of addBusinessMinutes", () => {
    const start = ams("2026-10-22", 17, 13);
    for (const mins of [1, 59, 400, 720, 1500, 5000]) {
      expect(businessMinutesBetween(start, addBusinessMinutes(start, mins, MON_FRI), MON_FRI)).toBeCloseTo(mins, 6);
    }
  });
});
