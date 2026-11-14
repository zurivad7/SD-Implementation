import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generate, GO_LIVE_DAY_INDEX, serialize, WEEKDAY_VOLUME, WEEKEND_VOLUME, type SeedData } from "../src/data/generator";
import { amsterdamParts } from "../src/engine/businessTime";
import { TEMPLATES } from "../src/data/templates";
import { containsPhrase } from "../src/engine/routing";

const SEED_PATH = join(__dirname, "..", "src", "data", "seed.json");
const committedText = readFileSync(SEED_PATH, "utf8");
const committed = JSON.parse(committedText) as SeedData;
const T = committed.tickets;

const STATUS_FROM_LABEL: Record<string, string> = { New: "new", Open: "open", Pending: "pending", "On-hold": "on_hold", Solved: "solved", Closed: "closed" };
const statusTo = (detail: string) => {
  const m = /Status changed from [A-Za-z-]+ to ([A-Za-z-]+)\.$/.exec(detail);
  if (!m) throw new Error(`Status event without a status: ${detail}`);
  return STATUS_FROM_LABEL[m[1]!];
};
const dayKey = (iso: string) => {
  const p = amsterdamParts(Date.parse(iso));
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
};
const breached = (t: SeedData["tickets"][number]) => t.events.some((e) => e.type === "sla_breached");
const reassigned = (t: SeedData["tickets"][number]) => t.events.filter((e) => e.type === "assigned").length > 1;
const rate = (list: typeof T, f: (t: (typeof T)[number]) => boolean) => list.filter(f).length / list.length;

describe("generator: determinism", () => {
  it("the same seed gives byte-identical seed.json", () => {
    const a = serialize(generate({ endDate: committed.meta.endDate }));
    const b = serialize(generate({ endDate: committed.meta.endDate }));
    expect(a).toBe(b);
    expect(a).toBe(committedText); // the committed file is the generator output
  });

  it("a different seed gives different data", () => {
    const other = generate({ seed: "another-seed", endDate: committed.meta.endDate });
    expect(other.tickets[0]!.subject + other.tickets[0]!.createdAt).not.toBe(T[0]!.subject + T[0]!.createdAt);
  });
});

describe("generator: event trails", () => {
  it("ids start at 10001, are sequential and follow createdAt", () => {
    T.forEach((t, i) => {
      expect(t.id).toBe(10001 + i);
      if (i > 0) expect(t.createdAt >= T[i - 1]!.createdAt).toBe(true);
    });
  });

  it("every trail is in time order and agrees with createdAt, firstReplyAt and solvedAt", () => {
    const end = committed.meta.dataEndsAt;
    for (const t of T) {
      const ev = t.events;
      expect(ev[0]).toMatchObject({ type: "created", at: t.createdAt });
      for (let i = 1; i < ev.length; i++) expect(ev[i]!.at >= ev[i - 1]!.at).toBe(true);
      expect(ev[ev.length - 1]!.at < end).toBe(true);

      const replies = ev.filter((e) => e.type === "public_reply");
      expect(t.firstReplyAt).toBe(replies[0]?.at ?? null);

      const statusEvents = ev.filter((e) => e.type === "status_changed");
      const last = statusEvents.length ? statusTo(statusEvents[statusEvents.length - 1]!.detail) : "new";
      expect(t.status).toBe(last);
      const solves = statusEvents.filter((e) => statusTo(e.detail) === "solved");
      if (t.status === "solved" || t.status === "closed") expect(t.solvedAt).toBe(solves[solves.length - 1]!.at);
      else expect(t.solvedAt).toBeNull();

      if (t.firstReplyAt) expect(t.firstReplyAt > t.createdAt).toBe(true);
      if (t.solvedAt) expect(t.solvedAt >= t.firstReplyAt!).toBe(true);
      expect(t.csat !== null).toBe(ev.some((e) => e.type === "csat_received"));
      if (t.status !== "new") expect(t.assigneeId).not.toBeNull();
    }
  });

  it("each escalation rule fires at most once per ticket", () => {
    for (const t of T) {
      for (const id of ["e1", "e2", "e3", "e4"]) {
        expect(t.events.filter((e) => e.type === "escalated" && e.ruleId === id).length).toBeLessThanOrEqual(1);
      }
    }
  });

  it("before go-live no triggers or escalation rules run", () => {
    const before = T.filter((t) => dayKey(t.createdAt) < committed.meta.goLiveDate);
    expect(before.length).toBeGreaterThan(0);
    for (const t of before) {
      expect(t.events.some((e) => e.type === "rule_fired" || e.type === "escalated")).toBe(false);
    }
  });

  it("after go-live every ticket shows the triggers that fired", () => {
    const after = T.filter((t) => dayKey(t.createdAt) >= committed.meta.goLiveDate);
    for (const t of after) expect(t.events.some((e) => e.type === "rule_fired")).toBe(true);
  });
});

describe("generator: volumes and mix (SPEC section 5)", () => {
  it("covers 30 days with day 15 as go-live", () => {
    const days = [...new Set(T.map((t) => dayKey(t.createdAt)))].sort();
    expect(days).toHaveLength(30);
    expect(days[0]).toBe(committed.meta.startDate);
    expect(days[29]).toBe(committed.meta.endDate);
    expect(days[GO_LIVE_DAY_INDEX]).toBe(committed.meta.goLiveDate);
  });

  it("has about 4,500 tickets in total", () => {
    expect(T.length).toBeGreaterThan(4300);
    expect(T.length).toBeLessThan(4700);
  });

  it(`has ${WEEKDAY_VOLUME.min} to ${WEEKDAY_VOLUME.max} tickets per weekday and ${WEEKEND_VOLUME.min} to ${WEEKEND_VOLUME.max} per weekend day`, () => {
    const counts = new Map<string, number>();
    for (const t of T) counts.set(dayKey(t.createdAt), (counts.get(dayKey(t.createdAt)) ?? 0) + 1);
    for (const [day, n] of counts) {
      const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
      const range = weekday === 0 || weekday === 6 ? WEEKEND_VOLUME : WEEKDAY_VOLUME;
      expect(n, day).toBeGreaterThanOrEqual(range.min);
      expect(n, day).toBeLessThanOrEqual(range.max);
    }
  });

  it("has 1,800 customers, about 20% with more than one ticket", () => {
    expect(committed.customers).toHaveLength(1800);
    const per = new Map<string, number>();
    for (const t of T) per.set(t.customerId, (per.get(t.customerId) ?? 0) + 1);
    expect(per.size).toBe(1800);
    const repeat = [...per.values()].filter((n) => n > 1).length / per.size;
    expect(repeat).toBeGreaterThan(0.17);
    expect(repeat).toBeLessThan(0.23);
  });

  it("has 10 agents and 2 leads in 4 groups", () => {
    expect(committed.agents.filter((a) => a.role === "agent")).toHaveLength(10);
    expect(committed.agents.filter((a) => a.role === "lead")).toHaveLength(2);
    expect(committed.groups.map((g) => g.name)).toEqual(["Tier 1", "Billing", "Technical", "Escalations"]);
  });

  it("matches the channel and category mix within 3 points", () => {
    const share = (f: (t: (typeof T)[number]) => boolean) => rate(T, f);
    expect(share((t) => t.channel === "email")).toBeCloseTo(0.45, 1);
    expect(share((t) => t.channel === "web_form")).toBeCloseTo(0.3, 1);
    expect(share((t) => t.channel === "chat")).toBeCloseTo(0.2, 1);
    expect(share((t) => t.category === "license_activation")).toBeCloseTo(0.3, 1);
    expect(share((t) => t.category === "download_install")).toBeCloseTo(0.25, 1);
    expect(share((t) => t.category === "billing")).toBeCloseTo(0.2, 1);
  });

  it("has at least 8 text templates per category", () => {
    for (const list of Object.values(TEMPLATES)) expect(list.length).toBeGreaterThanOrEqual(8);
  });

  it("leaves only recent tickets open", () => {
    const cutoff = Date.parse(committed.meta.dataEndsAt) - 2 * 86_400_000;
    const older = T.filter((t) => Date.parse(t.createdAt) < cutoff);
    expect(rate(older, (t) => t.solvedAt === null)).toBeLessThan(0.05);
  });
});

describe("generator: before and after story (SPEC section 5)", () => {
  const before = T.filter((t) => dayKey(t.createdAt) < committed.meta.goLiveDate);
  const after = T.filter((t) => dayKey(t.createdAt) >= committed.meta.goLiveDate);
  const settled = after.filter((t) => dayKey(t.createdAt) >= "2026-11-05"); // after the first week

  it("breach rate is about 18% before and about 6% once settled", () => {
    expect(rate(before, breached)).toBeGreaterThan(0.15);
    expect(rate(before, breached)).toBeLessThan(0.22);
    expect(rate(settled, breached)).toBeGreaterThan(0.03);
    expect(rate(settled, breached)).toBeLessThan(0.09);
  });

  it("reassignments fall from about 12%", () => {
    expect(rate(before, reassigned)).toBeGreaterThan(0.09);
    expect(rate(before, reassigned)).toBeLessThan(0.15);
    expect(rate(after, reassigned)).toBeLessThan(rate(before, reassigned) / 2);
  });

  it("CSAT rises a little and about 25% of solved tickets are rated", () => {
    const csat = (list: typeof T) => {
      const rated = list.filter((t) => t.csat);
      return rated.filter((t) => t.csat!.score === "good").length / rated.length;
    };
    expect(csat(after)).toBeGreaterThan(csat(before));
    expect(csat(after) - csat(before)).toBeLessThan(0.08);
    const solved = T.filter((t) => t.solvedAt);
    expect(rate(solved, (t) => t.csat !== null)).toBeGreaterThan(0.2);
    expect(rate(solved, (t) => t.csat !== null)).toBeLessThan(0.3);
  });
});

describe("keyword matching", () => {
  it("matches whole words only", () => {
    expect(containsPhrase("Our license server is down.", "down")).toBe(true);
    expect(containsPhrase("The download link has expired.", "down")).toBe(false);
    expect(containsPhrase("My whole team cannot work.", "cannot work")).toBe(true);
    expect(containsPhrase("We have an OUTAGE.", "outage")).toBe(true);
  });
});
