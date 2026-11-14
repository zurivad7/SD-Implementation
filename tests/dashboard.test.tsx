import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "../src/App";
import { SLA_POLICIES } from "../src/data/config";
import { SEED_DATA } from "../src/data/seed";
import { computeKpis, splitByGoLive } from "../src/engine/metrics";
import { formatKpi } from "../src/lib/dashboardData";
import { ROUTER_FUTURE } from "../src/routerFuture";
import { useDesk } from "../src/store/useDesk";

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]} future={ROUTER_FUTURE}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

const tileText = (key: string) => screen.getByTestId(`tile-${key}`).textContent;

beforeEach(() => {
  localStorage.clear();
  act(() => useDesk.getState().reset());
});

describe("dashboard", () => {
  it("shows the synthetic banner and 6 tiles whose values come from engine/metrics.ts", () => {
    renderDashboard();
    expect(screen.getByText("All tickets, customers and metrics in this demo are synthetic.")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^tile-/).filter((el) => el.tagName === "ARTICLE")).toHaveLength(6);
    const { before, after } = splitByGoLive(SEED_DATA.tickets, SEED_DATA.meta.goLiveDate);
    const kb = computeKpis(before, SLA_POLICIES);
    const ka = computeKpis(after, SLA_POLICIES);
    const tile = screen.getByTestId("tile-slaBreachRate");
    expect(within(tile).getByTestId("tile-after")).toHaveTextContent(formatKpi(ka.slaBreachRate, "rate"));
    expect(within(tile).getByTestId("tile-before")).toHaveTextContent(`Before: ${formatKpi(kb.slaBreachRate, "rate")}`);
    expect(within(tile).getByTestId("tile-change")).toHaveTextContent(/pts, better$/);
    expect(within(screen.getByTestId("tile-medianFirstReplyMins")).getByTestId("tile-after")).toHaveTextContent(formatKpi(ka.medianFirstReplyMins, "minutes"));
    expect(screen.getByTestId("match-count")).toHaveTextContent("4,550 tickets match.");
  });

  it("changing the channel filter changes the tiles, the charts and the table together", () => {
    renderDashboard();
    const tilesBefore = ["slaBreachRate", "medianFirstReplyMins", "csat"].map(tileText);
    const summaryBefore = screen.getByTestId("chart-channels-summary").textContent;
    const tableBefore = screen.getByTestId("group-table").textContent;
    fireEvent.change(screen.getByLabelText("Channel", { selector: "select" }), { target: { value: "chat" } });
    expect(["slaBreachRate", "medianFirstReplyMins", "csat"].map(tileText)).not.toEqual(tilesBefore);
    expect(screen.getByTestId("chart-channels-summary").textContent).not.toBe(summaryBefore);
    expect(screen.getByTestId("chart-channels-summary")).toHaveTextContent(/Email 0 \(0%\)/);
    expect(screen.getByTestId("group-table").textContent).not.toBe(tableBefore);
    const chat = SEED_DATA.tickets.filter((t) => t.channel === "chat").length;
    expect(screen.getByTestId("match-count")).toHaveTextContent(`${chat.toLocaleString("en-GB")} tickets match.`);
  });

  it("the date range can cut out the before period: change is then not available", () => {
    renderDashboard();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: SEED_DATA.meta.goLiveDate } });
    expect(within(screen.getByTestId("tile-csat")).getByTestId("tile-before")).toHaveTextContent("Before: no data");
    expect(within(screen.getByTestId("tile-csat")).getByTestId("tile-change")).toHaveTextContent("Change: not available");
  });

  it("the Sandbox tickets toggle adds the visitor's tickets", () => {
    act(() => {
      const c = SEED_DATA.customers[0]!;
      useDesk.getState().createTicket({ subject: "A", body: "Help please", channel: "phone", category: "other" }, c);
      useDesk.getState().createTicket({ subject: "B", body: "Help please", channel: "phone", category: "other" }, c);
    });
    renderDashboard();
    expect(screen.getByTestId("match-count")).toHaveTextContent("4,550 tickets match.");
    fireEvent.click(screen.getByLabelText("Sandbox tickets (2)"));
    expect(screen.getByTestId("match-count")).toHaveTextContent("4,552 tickets match.");
    expect(screen.getByLabelText("To")).toHaveValue("2026-11-16"); // the range grows to the sandbox day
  });

  it("every chart has a text summary and a data table", () => {
    renderDashboard();
    for (const id of ["chart-breach", "chart-first-reply", "chart-channels", "chart-backlog"]) {
      const card = screen.getByTestId(id);
      expect(screen.getByTestId(`${id}-summary`).textContent!.length).toBeGreaterThan(40);
      expect(within(card).getByText("Show data table")).toBeInTheDocument();
      expect(within(card).getAllByRole("row").length).toBeGreaterThan(30); // header + 30 days
    }
    expect(screen.getByTestId("chart-breach-summary")).toHaveTextContent(/^Before go-live, \d+\.\d% of tickets breached/);
  });

  it("explains each KPI in an info tooltip", () => {
    renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: "How Resolution time (median) is measured" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("pending and on-hold time excluded");
  });

  it("Download CSV saves the filtered tickets as a file, with no network call", () => {
    const blobs: Blob[] = [];
    const create = vi.fn((b: Blob) => { blobs.push(b); return "blob:test"; });
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
    const clicks: string[] = [];
    const spy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { clicks.push(this.download); });
    renderDashboard();
    fireEvent.change(screen.getByLabelText("Channel", { selector: "select" }), { target: { value: "phone" } });
    fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));
    expect(clicks).toEqual(["northwind-synthetic-tickets-2026-10-15-to-2026-11-13.csv"]);
    expect(blobs[0]!.type).toBe("text/csv;charset=utf-8");
    spy.mockRestore();
  });
});
