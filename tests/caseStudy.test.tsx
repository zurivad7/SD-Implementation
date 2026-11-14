import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "../src/App";
import { parseMarkdown, renderInline } from "../src/lib/markdown";
import { CHAPTERS } from "../src/pages/CaseStudy/chapters";
import { ROUTER_FUTURE } from "../src/routerFuture";
import { useDesk } from "../src/store/useDesk";
import { TOUR_STEPS, useTour } from "../src/store/useTour";
import { SYNTHETIC_BANNER_TEXT } from "../src/components/SyntheticBanner";
import { DRAFT_MARKER } from "../scripts/contentRules";

const CONTENT = join(__dirname, "..", "src", "content");
const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]} future={ROUTER_FUTURE}><AppRoutes /></MemoryRouter>);

describe("markdown renderer", () => {
  it("parses headings, lists, tables and markers, and spots the draft line", () => {
    const doc = parseMarkdown(`${DRAFT_MARKER}\n\n## Title\n\nOne line\nsame paragraph.\n\n- a\n- b\n\n1. x\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n[[timeline]]`);
    expect(doc.draft).toBe(true);
    expect(doc.blocks.map((b) => b.kind)).toEqual(["heading", "paragraph", "list", "list", "table", "marker"]);
    expect(doc.blocks[1]).toEqual({ kind: "paragraph", text: "One line same paragraph." });
    expect(doc.blocks[4]).toEqual({ kind: "table", header: ["A", "B"], rows: [["1", "2"]] });
  });

  it("renders inline bold, code and links, and opens external links in a new tab", () => {
    const { container } = render(<p>{renderInline("**Bold** and `code` and [in](#/admin) and [out](https://example.com)")}</p>);
    expect(container.querySelector("strong")).toHaveTextContent("Bold");
    expect(container.querySelector("code")).toHaveTextContent("code");
    const links = container.querySelectorAll("a");
    expect(links[0]).toHaveAttribute("href", "#/admin");
    expect(links[1]).toHaveAttribute("target", "_blank");
    expect(links[1]).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("never renders raw HTML", () => {
    const { container } = render(<p>{renderInline("<img src=x onerror=alert(1)>")}</p>);
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("case study content (SPEC section 8)", () => {
  const files = readdirSync(join(CONTENT, "case-study")).filter((f) => f.endsWith(".md")).sort();

  it("has one markdown file per chapter, each starting with the draft line", () => {
    expect(files).toHaveLength(8);
    for (const f of files) expect(readFileSync(join(CONTENT, "case-study", f), "utf8").split("\n")[0]).toBe(DRAFT_MARKER);
  });

  it("the RAID log has at least 8 rows with the 7 required columns", () => {
    const doc = parseMarkdown(readFileSync(join(CONTENT, "case-study", "5-raid-log.md"), "utf8"));
    const table = doc.blocks.find((b) => b.kind === "table");
    expect(table && table.kind === "table" && table.header).toEqual(["ID", "Type", "Description", "Impact", "Owner role", "Mitigation", "Status"]);
    const rows = table && table.kind === "table" ? table.rows : [];
    expect(rows.length).toBeGreaterThanOrEqual(8);
    for (const r of rows) {
      expect(r).toHaveLength(7);
      expect(["H", "M", "L"]).toContain(r[3]);
    }
  });

  it("states no percentages or durations as results in the chapter text (numbers come from the data)", () => {
    for (const f of ["1-client-brief.md", "2-discovery.md", "7-results.md"]) {
      expect(readFileSync(join(CONTENT, "case-study", f), "utf8")).not.toMatch(/\d+(\.\d+)?\s?%/);
    }
  });

  it.each(CHAPTERS.map((c) => [c.n, c.title, c.synthetic] as const))("chapter %i (%s) renders with its proof link and the right banner", (n, title, synthetic) => {
    renderAt(`/case-study/${n}`);
    expect(screen.getByRole("heading", { level: 1, name: `${n}. ${title}` })).toBeInTheDocument();
    expect(screen.getByTestId("draft-badge")).toBeInTheDocument();
    expect(screen.queryByText(SYNTHETIC_BANNER_TEXT) !== null).toBe(synthetic);
    if (n === 8) expect(screen.queryByTestId("proof-link")).toBeNull();
    else expect(screen.getByTestId("proof-link")).toBeInTheDocument();
  });

  it("chapter 2 shows the category mix chart, computed from the data", () => {
    renderAt("/case-study/2");
    expect(screen.getByTestId("chart-category-mix-summary")).toHaveTextContent(/^[\d,]+ tickets in the audit period\. License activation is the largest category/);
  });

  it("chapter 4 shows the timeline with 5 phases and 3 gates", () => {
    renderAt("/case-study/4");
    const svg = within(screen.getByTestId("plan-timeline")).getByRole("img", { name: "10-week rollout plan" });
    for (const phase of ["Discover", "Design", "Build and test", "Train and cut over", "Hypercare"]) expect(within(svg).getByText(phase)).toBeInTheDocument();
    for (const gate of ["Gate 1: Design sign-off", "Gate 2: UAT sign-off", "Gate 3: Go/no-go"]) expect(within(svg).getByText(gate)).toBeInTheDocument();
  });

  it("chapter 7 shows computed tiles, labelled synthetic", () => {
    renderAt("/case-study/7");
    expect(screen.getByText(/Not a real client outcome/)).toBeInTheDocument();
    expect(within(screen.getByTestId("tile-slaBreachRate")).getByTestId("tile-after")).toHaveTextContent(/\d+\.\d%/);
  });

  it("chapter 1 links to the dashboard's before period, and the dashboard opens filtered", () => {
    renderAt("/case-study/1");
    const link = within(screen.getByTestId("proof-link")).getByRole("link");
    expect(link).toHaveAttribute("href", "/dashboard?from=2026-10-15&to=2026-10-28");
    fireEvent.click(link);
    expect(screen.getByLabelText("To")).toHaveValue("2026-10-28");
    expect(within(screen.getByTestId("tile-csat")).getByTestId("tile-after")).toHaveTextContent("no data");
  });
});

describe("About Eric (real data only)", () => {
  it("shows the verified facts, the exact degree wording, LinkedIn and the CV", () => {
    renderAt("/about");
    expect(screen.getByText(/Executive MBA \(EMBA\), Quantic School of Business and Technology, 2020/)).toBeInTheDocument();
    expect(screen.getByText(/PMP certified/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /LinkedIn profile/ })).toHaveAttribute("href", "https://linkedin.com/in/ekpenyong-effiong");
    expect(screen.getByRole("link", { name: /Download CV/ })).toHaveAttribute("href", "Ekpenyong_Effiong_CV.docx");
    expect(screen.queryByText(SYNTHETIC_BANNER_TEXT)).toBeNull();
  });

  it("the CV file exists in public/", () => {
    expect(readFileSync(join(__dirname, "..", "public", "Ekpenyong_Effiong_CV.docx")).length).toBeGreaterThan(10_000);
  });
});

describe("5-minute demo mode", () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => { useDesk.getState().reset(); useTour.getState().end(); });
  });

  it("walks 6 steps: claim, create, triggers, SLA warning, dashboard, RAID log", () => {
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: "5-minute demo" }));
    const titles: string[] = [];
    const pages: string[] = [];
    for (let i = 0; i < TOUR_STEPS.length; i++) {
      const panel = screen.getByTestId("demo-tour");
      titles.push(within(panel).getByRole("heading").textContent!);
      pages.push(screen.getAllByRole("heading", { level: 1 })[0]!.textContent!);
      if (i === 2) expect(within(screen.getByTestId("timeline")).getByText(/Trigger "Enterprise fast lane" fired/)).toBeInTheDocument();
      if (i === 3) {
        expect(within(screen.getByTestId("timeline")).getAllByText(/SLA warning: 25% of the/).length).toBeGreaterThan(0);
        expect(screen.getByTestId("sandbox-time")).toHaveTextContent("10:00");
      }
      fireEvent.click(within(panel).getByRole("button", { name: i === TOUR_STEPS.length - 1 ? "Finish" : "Next" }));
    }
    expect(titles).toEqual(TOUR_STEPS.map((s) => s.title));
    expect(pages[0]).toMatch(/messy inbox/);
    expect(pages.slice(1)).toEqual(["Ticket sandbox", "Ticket #14551", "Ticket #14551", "KPI dashboard", "5. RAID log"]);
    expect(screen.queryByTestId("demo-tour")).toBeNull();
    expect(useDesk.getState().tickets).toHaveLength(1); // one example ticket, created once
  });

  it("Back does not create a second ticket or move the clock twice", () => {
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: "5-minute demo" }));
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(useDesk.getState().tickets).toHaveLength(1);
    expect(screen.getByTestId("sandbox-time")).toHaveTextContent("10:00");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("demo-tour")).toBeNull();
  });
});
