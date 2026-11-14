import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppRoutes } from "../src/App";
import { SYNTHETIC_BANNER_TEXT } from "../src/components/SyntheticBanner";
import { ROUTER_FUTURE } from "../src/routerFuture";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]} future={ROUTER_FUTURE}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

describe("routes (SPEC section 9)", () => {
  const cases: Array<[string, RegExp, boolean]> = [
    ["/", /messy inbox to measured go-live/, false],
    ["/sandbox", /Ticket sandbox/, true],
    ["/sandbox/10001", /Ticket #10001/, true],
    ["/admin", /^Admin$/, true],
    ["/dashboard", /KPI dashboard/, true],
    ["/case-study/1", /1\. Client brief/, false],
    ["/case-study/2", /2\. Discovery/, true],
    ["/case-study/8", /8\. Retrospective/, false],
    ["/about", /About Eric/, false],
  ];

  it.each(cases)("%s renders its page", (path, heading, synthetic) => {
    renderAt(path);
    expect(screen.getByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
    const banner = screen.queryByText(SYNTHETIC_BANNER_TEXT);
    if (synthetic) expect(banner).toBeInTheDocument();
    else expect(banner).not.toBeInTheDocument();
  });

  it("uses the exact banner text from hard rule 1", () => {
    expect(SYNTHETIC_BANNER_TEXT).toBe("All tickets, customers and metrics in this demo are synthetic.");
  });

  it("case study chapters link next and back", () => {
    renderAt("/case-study/4");
    expect(screen.getByRole("link", { name: /Back: 3\. Design/ })).toHaveAttribute("href", "/case-study/3");
    expect(screen.getByRole("link", { name: /Next: 5\. RAID log/ })).toHaveAttribute("href", "/case-study/5");
  });

  it("unknown chapters and paths show not found", () => {
    renderAt("/case-study/9");
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });

  it("home page has the 3 proof links", () => {
    renderAt("/");
    const cards = screen.getByRole("main").querySelectorAll("ul a");
    expect([...cards].map((a) => a.getAttribute("href"))).toEqual(["/sandbox", "/dashboard", "/case-study/1"]);
  });
});
