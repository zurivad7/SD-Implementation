import { MACROS } from "../src/data/config";
import { applyMacro, fillPlaceholders } from "../src/engine/macros";
import { config, customer, ticket } from "./fixtures";

const NOW = Date.parse("2026-11-09T10:00:00Z");
const agent = config.agents[0]!;
const macro = (name: string) => MACROS.find((m) => m.name === name)!;

describe("macros", () => {
  it("seeds 6 macros, including Request more info", () => {
    expect(MACROS).toHaveLength(6);
    expect(MACROS.map((m) => m.name)).toContain("Request more info");
  });

  it("fills {{customer.name}} and {{ticket.id}}", () => {
    expect(fillPlaceholders("Hi {{customer.name}}, ticket {{ ticket.id }}.", { id: 10042 }, { name: "Lotte Bakker" })).toBe("Hi Lotte Bakker, ticket 10042.");
  });

  it("leaves unknown placeholders as they are", () => {
    expect(fillPlaceholders("{{agent.name}}", { id: 1 }, { name: "A" })).toBe("{{agent.name}}");
  });

  it("adds the reply and runs the actions: Request more info sets pending", () => {
    const r = applyMacro(ticket({ id: 10042, status: "open" }), macro("Request more info"), customer(), agent, config.groups, NOW);
    expect(r.reply).toContain("Hi Anna Jansen");
    expect(r.reply).toContain("Ticket 10042.");
    expect(r.ticket.status).toBe("pending");
    expect(r.ticket.firstReplyAt).toBe("2026-11-09T10:00:00Z");
    expect(r.ticket.events.map((e) => e.type)).toEqual(["created", "macro_applied", "public_reply", "status_changed"]);
    expect(r.ticket.events.at(-1)!.detail).toBe("Status changed from Open to Pending.");
  });

  it("solving macros set solvedAt and add their tag", () => {
    const r = applyMacro(ticket({ status: "open", category: "refund" }), macro("Refund: approved"), customer(), agent, config.groups, NOW);
    expect(r.ticket.status).toBe("solved");
    expect(r.ticket.solvedAt).toBe("2026-11-09T10:00:00Z");
    expect(r.ticket.tags).toContain("refund_approved");
  });

  it("keeps the first reply time when the ticket already had a reply", () => {
    const r = applyMacro(ticket({ firstReplyAt: "2026-11-09T09:30:00Z" }), macro("Request more info"), customer(), agent, config.groups, NOW);
    expect(r.ticket.firstReplyAt).toBe("2026-11-09T09:30:00Z");
  });
});
