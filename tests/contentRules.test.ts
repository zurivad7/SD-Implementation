import { findDashes, findDraftMarkers, hasSyntheticBanner, DRAFT_MARKER } from "../scripts/contentRules";

describe("content rules (SPEC section 10)", () => {
  it("flags an em dash", () => {
    expect(findDashes("a.md", "Fast \u2014 and cheap")).toHaveLength(1);
  });

  it("flags an en dash used as a dash", () => {
    expect(findDashes("a.md", "Fast \u2013 and cheap")).toHaveLength(1);
  });

  it("allows an en dash in a number range", () => {
    expect(findDashes("a.md", "Weeks 1\u20132")).toHaveLength(0);
  });

  it("allows plain hyphens, colons and commas", () => {
    expect(findDashes("a.md", "Go-live: day 15, then hypercare.")).toHaveLength(0);
  });

  it("reports the line number", () => {
    expect(findDashes("a.md", "ok\nbad \u2014 line")[0]?.line).toBe(2);
  });

  it("finds the draft marker line", () => {
    expect(findDraftMarkers("c.md", `${DRAFT_MARKER}\n\n# Brief`)).toHaveLength(1);
    expect(findDraftMarkers("c.md", "# Brief")).toHaveLength(0);
  });

  it("detects the synthetic banner in page source", () => {
    expect(hasSyntheticBanner('<PageShell title="x" synthetic>')).toBe(true);
    expect(hasSyntheticBanner("<SyntheticBanner />")).toBe(true);
    expect(hasSyntheticBanner('<PageShell title="x">')).toBe(false);
  });
});
