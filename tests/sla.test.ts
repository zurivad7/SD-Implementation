import { SLA_POLICIES } from "../src/data/config";
import { iso } from "../src/engine/events";
import { selectPolicy, slaEventsDue, slaTimer } from "../src/engine/sla";
import type { SlaPolicy } from "../src/types";
import { ams, customer, ev, MIN, ticket } from "./fixtures";

const [ENTERPRISE, BUSINESS, STANDARD] = SLA_POLICIES as [SlaPolicy, SlaPolicy, SlaPolicy];

describe("SLA: policy selection", () => {
  it("picks the first matching policy", () => {
    expect(selectPolicy(ticket(), customer("enterprise"), SLA_POLICIES)?.id).toBe("sla_enterprise");
    expect(selectPolicy(ticket(), customer("business"), SLA_POLICIES)?.id).toBe("sla_business");
    expect(selectPolicy(ticket(), customer("standard"), SLA_POLICIES)?.id).toBe("sla_standard");
  });
});

describe("SLA: business-hours maths", () => {
  it("counts only business minutes across a weekend", () => {
    const t = ticket({ createdAt: iso(ams("2026-11-06 18:00")), slaPolicyId: STANDARD.id }); // Friday
    const timer = slaTimer(t, STANDARD, "first_reply", ams("2026-11-09 10:00")); // Monday
    expect(timer.elapsedMins).toBe(240); // Fri 18:00 to 20:00, Mon 08:00 to 10:00
  });

  it("skips 20:00 to 08:00", () => {
    const t = ticket({ createdAt: iso(ams("2026-11-10 19:00")), slaPolicyId: STANDARD.id });
    expect(slaTimer(t, STANDARD, "first_reply", ams("2026-11-11 09:00")).elapsedMins).toBe(120);
  });

  it("counts Saturday for Business (Mon to Sat) but not for Standard", () => {
    const createdAt = iso(ams("2026-11-07 09:00")); // Saturday
    const now = ams("2026-11-07 10:00");
    expect(slaTimer(ticket({ createdAt }), BUSINESS, "first_reply", now).elapsedMins).toBe(60);
    expect(slaTimer(ticket({ createdAt }), STANDARD, "first_reply", now).elapsedMins).toBe(0);
  });

  it("runs 24x7 for Enterprise", () => {
    const t = ticket({ createdAt: iso(ams("2026-11-07 23:00")) });
    expect(slaTimer(t, ENTERPRISE, "first_reply", ams("2026-11-08 01:00")).elapsedMins).toBe(120);
  });
});

describe("SLA: pause and resume", () => {
  const created = ams("2026-11-09 08:00");
  const base = ticket({
    createdAt: iso(created),
    events: [
      { at: iso(created), type: "created", actor: "customer", detail: "Customer created the ticket by email." },
      ev.status(iso(ams("2026-11-09 09:00")), "new", "pending"),
    ],
    status: "pending",
  });

  it("pauses in pending", () => {
    const timer = slaTimer(base, STANDARD, "resolution", ams("2026-11-09 11:00"));
    expect(timer.elapsedMins).toBe(60);
    expect(timer.paused).toBe(true);
    expect(timer.dueAt).toBeNull();
  });

  it("resumes on open", () => {
    const reopened = { ...base, status: "open" as const, events: [...base.events, ev.status(iso(ams("2026-11-09 12:00")), "pending", "open")] };
    const timer = slaTimer(reopened, STANDARD, "resolution", ams("2026-11-09 13:00"));
    expect(timer.elapsedMins).toBe(120); // 08:00 to 09:00 and 12:00 to 13:00
    expect(timer.paused).toBe(false);
  });

  it("pauses in on_hold", () => {
    const held = {
      ...base,
      status: "open" as const,
      events: [
        base.events[0]!,
        ev.status(iso(ams("2026-11-09 09:00")), "new", "on_hold"),
        ev.status(iso(ams("2026-11-09 10:30")), "on_hold", "open"),
      ],
    };
    expect(slaTimer(held, STANDARD, "resolution", ams("2026-11-09 11:00")).elapsedMins).toBe(90);
  });

  it("stops at the first reply and at solved", () => {
    const replied = ticket({ createdAt: iso(created), firstReplyAt: iso(created + 30 * MIN) });
    const timer = slaTimer(replied, STANDARD, "first_reply", ams("2026-11-09 18:00"));
    expect(timer).toMatchObject({ elapsedMins: 30, stopped: true, state: "met" });
  });
});

describe("SLA: warning at 25% left, breach at 0%", () => {
  // Enterprise, urgent: 30 min first reply, 4 h resolution, 24x7.
  const created = Date.parse("2026-11-09T10:00:00Z");
  const t = ticket({ createdAt: iso(created), priority: "urgent", slaPolicyId: ENTERPRISE.id });
  const state = (mins: number) => slaTimer(t, ENTERPRISE, "first_reply", created + mins * MIN).state;

  it("is green with more than 25% left", () => {
    expect(state(22)).toBe("ok");
    expect(slaEventsDue(t, ENTERPRISE, created + 22 * MIN)).toEqual([]);
  });

  it("turns amber and writes sla_warning at exactly 25% left", () => {
    expect(state(22.5)).toBe("warning");
    const events = slaEventsDue(t, ENTERPRISE, created + 22.5 * MIN);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "sla_warning", at: "2026-11-09T10:22:30Z", detail: "Enterprise SLA warning: 25% of the 30 min first reply target is left." });
  });

  it("turns red and writes sla_breached at exactly 0% left", () => {
    expect(state(29.9)).toBe("warning");
    expect(state(30)).toBe("breached");
    const events = slaEventsDue(t, ENTERPRISE, created + 30 * MIN);
    expect(events.map((e) => [e.type, e.at])).toEqual([["sla_warning", "2026-11-09T10:22:30Z"], ["sla_breached", "2026-11-09T10:30:00Z"]]);
  });

  it("stamps events at the crossing time, even when checked late", () => {
    const events = slaEventsDue(t, ENTERPRISE, created + 5 * 60 * MIN);
    expect(events.map((e) => [e.type, e.at])).toEqual([
      ["sla_warning", "2026-11-09T10:22:30Z"],
      ["sla_breached", "2026-11-09T10:30:00Z"],
      ["sla_warning", "2026-11-09T13:00:00Z"],
      ["sla_breached", "2026-11-09T14:00:00Z"],
    ]);
  });

  it("does not write an event twice", () => {
    const withEvents = { ...t, events: [...t.events, ...slaEventsDue(t, ENTERPRISE, created + 40 * MIN)] };
    expect(slaEventsDue(withEvents, ENTERPRISE, created + 50 * MIN)).toEqual([]);
  });

  it("a reply after the warning but before the target: warning only, then met", () => {
    const replied = { ...t, firstReplyAt: iso(created + 25 * MIN) };
    expect(slaEventsDue(replied, ENTERPRISE, created + 60 * MIN).filter((e) => e.detail.includes("first reply")).map((e) => e.type)).toEqual(["sla_warning"]);
    expect(slaTimer(replied, ENTERPRISE, "first_reply", created + 60 * MIN).state).toBe("met");
  });
});

describe("SLA: reopened tickets", () => {
  // Enterprise, urgent, 24x7: first reply 30 min, resolution 4 h (240 min).
  const created = Date.parse("2026-11-09T10:00:00Z");
  const m = (mins: number) => iso(created + mins * MIN);
  const solvedThenReopened = ticket({
    createdAt: m(0), priority: "urgent", slaPolicyId: ENTERPRISE.id, status: "open", firstReplyAt: m(20), solvedAt: null,
    events: [
      { at: m(0), type: "created", actor: "customer", detail: "Customer created the ticket by email." },
      ev.reply(m(20)), ev.status(m(20), "new", "open"),
      ev.status(m(100), "open", "solved"), // 100 min on the clock
      ev.status(m(400), "solved", "open"), // reopened 5 h later
    ],
  });

  it("the resolution clock does not run while the ticket is solved", () => {
    const solved = { ...solvedThenReopened, status: "solved" as const, solvedAt: m(100), events: solvedThenReopened.events.slice(0, 4) };
    expect(slaTimer(solved, ENTERPRISE, "resolution", created + 300 * MIN)).toMatchObject({ elapsedMins: 100, stopped: true, state: "met" });
  });

  it("continues from the saved total after a reopen. It does not restart.", () => {
    const timer = slaTimer(solvedThenReopened, ENTERPRISE, "resolution", created + 430 * MIN);
    expect(timer.elapsedMins).toBe(130); // 100 before the solve + 30 since the reopen
    expect(timer.stopped).toBe(false);
  });

  it("writes the warning and breach at the right moment after a reopen", () => {
    // 75% of 240 = 180 min: 100 before, 80 after the reopen at 400 -> 480. Breach at 240: 400 + 140 = 540.
    const events = slaEventsDue(solvedThenReopened, ENTERPRISE, created + 600 * MIN).filter((e) => e.detail.includes("resolution"));
    expect(events.map((e) => [e.type, e.at])).toEqual([["sla_warning", m(480)], ["sla_breached", m(540)]]);
  });

  it("a met first reply target stays met", () => {
    const timer = slaTimer(solvedThenReopened, ENTERPRISE, "first_reply", created + 600 * MIN);
    expect(timer).toMatchObject({ elapsedMins: 20, state: "met", stopped: true });
    expect(slaEventsDue(solvedThenReopened, ENTERPRISE, created + 600 * MIN).some((e) => e.detail.includes("first reply"))).toBe(false);
  });
});
