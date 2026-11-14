// Chapter list and proof links from SPEC.md section 8. Text lives in src/content/case-study/*.md.
import { SEED_DATA } from "../../data/seed";

const { goLiveDate, startDate } = SEED_DATA.meta;
const shiftDay = (day: string, by: number) => {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + by)).toISOString().slice(0, 10);
};

export interface Chapter {
  n: number;
  slug: string;
  title: string;
  /** Shows data from the demo, so the synthetic banner is on (hard rule 1). */
  synthetic: boolean;
  proof: { label: string; to: string } | null;
}

export const CHAPTERS: Chapter[] = [
  { n: 1, slug: "client-brief", title: "Client brief", synthetic: false, proof: { label: "Dashboard: the \"before\" period", to: `/dashboard?from=${startDate}&to=${shiftDay(goLiveDate, -1)}` } },
  { n: 2, slug: "discovery", title: "Discovery", synthetic: true, proof: { label: "Category mix chart (on this page)", to: "#category-mix" } },
  { n: 3, slug: "design", title: "Design", synthetic: false, proof: { label: "Admin view: triggers, SLAs, escalations, macros", to: "/admin" } },
  { n: 4, slug: "plan", title: "Plan", synthetic: false, proof: { label: "Timeline graphic (on this page)", to: "#timeline" } },
  { n: 5, slug: "raid-log", title: "RAID log", synthetic: false, proof: { label: "RAID table (on this page)", to: "#raid" } },
  { n: 6, slug: "cutover", title: "Cutover", synthetic: false, proof: { label: "Dashboard: the week each side of go-live (day 15)", to: `/dashboard?from=${shiftDay(goLiveDate, -7)}&to=${shiftDay(goLiveDate, 7)}` } },
  { n: 7, slug: "results", title: "Results", synthetic: true, proof: { label: "Dashboard tiles", to: "/dashboard" } },
  { n: 8, slug: "retrospective", title: "Retrospective", synthetic: false, proof: null },
];

const files = import.meta.glob("../../content/case-study/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

export function chapterSource(n: number): string {
  const entry = Object.entries(files).find(([path]) => path.split("/").pop()!.startsWith(`${n}-`));
  return entry ? entry[1] : "";
}
