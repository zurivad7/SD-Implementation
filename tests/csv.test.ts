import { SEED_DATA } from "../src/data/seed";
import { CSV_COLUMNS, ticketsToCsv } from "../src/lib/csv";
import { formatChange, lastDay } from "../src/lib/dashboardData";
import { customer, ev, ticket } from "./fixtures";

describe("CSV export", () => {
  const customers = new Map(SEED_DATA.customers.map((c) => [c.id, c]));

  it("has a header and one row per ticket", () => {
    const list = SEED_DATA.tickets.slice(0, 25);
    const lines = ticketsToCsv(list, (id) => customers.get(id), () => false).trimEnd().split("\r\n");
    expect(lines[0]).toBe(CSV_COLUMNS.join(","));
    expect(lines).toHaveLength(26);
    expect(lines[1]!.startsWith(`${list[0]!.id},${list[0]!.createdAt},`)).toBe(true);
  });

  it("quotes commas and quotes, and fills computed columns from the metrics engine", () => {
    const t = ticket({
      id: 7, slaPolicyId: "sla_enterprise", firstReplyAt: "2026-11-09T09:30:00Z", tags: ["vip", "refund"],
      csat: { score: "bad", comment: 'Too slow, "really"' },
      events: [{ at: "2026-11-09T09:00:00Z", type: "created", actor: "customer", detail: "x" }, ev.assigned("2026-11-09T09:01:00Z"), ev.reply("2026-11-09T09:30:00Z")],
    });
    const row = ticketsToCsv([t], () => customer("enterprise"), () => true).split("\r\n")[1]!;
    const col = (name: (typeof CSV_COLUMNS)[number]) => row.split(",")[CSV_COLUMNS.indexOf(name)];
    expect(col("customer_tier")).toBe("enterprise");
    expect(col("first_reply_business_mins")).toBe("30");
    expect(col("sla_policy")).toBe("Enterprise");
    expect(col("tags")).toBe("vip refund");
    expect(col("sandbox")).toBe("true");
    expect(ticketsToCsv([{ ...t, subject: 'a, "b"' }], () => undefined, () => false)).not.toContain('a, "b"'); // subject is not exported
  });

  it("contains no em dash", () => {
    expect(ticketsToCsv(SEED_DATA.tickets.slice(0, 200), (id) => customers.get(id), () => false)).not.toContain(String.fromCharCode(0x2014));
  });
});

describe("dashboard helpers", () => {
  it("shows rate changes in points and time changes in percent", () => {
    expect(formatChange(0.194, 0.1, "rate")).toBe("−9.4 pts");
    expect(formatChange(0.8, 0.85, "rate")).toBe("+5.0 pts");
    expect(formatChange(400, 100, "minutes")).toBe("−75%");
    expect(formatChange(null, 100, "minutes")).toBeNull();
  });

  it("extends the last day to the latest sandbox ticket only when the toggle is on", () => {
    const sandbox = [ticket({ createdAt: "2026-11-16T08:00:00Z" })];
    expect(lastDay({ sandboxTickets: sandbox, includeSandbox: false, endDate: "2026-11-13" })).toBe("2026-11-13");
    expect(lastDay({ sandboxTickets: sandbox, includeSandbox: true, endDate: "2026-11-13" })).toBe("2026-11-16");
  });
});
