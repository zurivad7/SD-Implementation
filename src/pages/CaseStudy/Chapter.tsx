import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import CategoryMix from "../../components/CategoryMix";
import PageShell from "../../components/PageShell";
import PlanTimeline from "../../components/PlanTimeline";
import ResultsTiles from "../../components/ResultsTiles";
import { Markdown, parseMarkdown } from "../../lib/markdown";
import NotFound from "../NotFound";
import { CHAPTERS, chapterSource } from "./chapters";

const link = "font-medium text-accent-700 underline dark:text-accent-300";

/** On-page proof targets ("#raid") scroll; app routes navigate. */
function ProofLink({ to, label }: { to: string; label: string }) {
  if (to.startsWith("#")) {
    return (
      <a href={to} className={link} onClick={(e) => { e.preventDefault(); document.getElementById(to.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
        {label}
      </a>
    );
  }
  return <Link to={to} className={link}>{label}</Link>;
}

export default function CaseStudyChapter() {
  const { chapter } = useParams();
  const n = Number(chapter);
  const current = CHAPTERS.find((c) => c.n === n);
  const doc = useMemo(() => parseMarkdown(chapterSource(n)), [n]);
  if (!current) return <NotFound />;
  const prev = CHAPTERS.find((c) => c.n === n - 1);
  const next = CHAPTERS.find((c) => c.n === n + 1);

  return (
    <PageShell title={`${current.n}. ${current.title}`} synthetic={current.synthetic}>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Case study: Northwind Support Go-Live, a simulated engagement with a fictional client. Chapter {current.n} of {CHAPTERS.length}.
      </p>
      {doc.draft && (
        <p className="mt-3 inline-block rounded border border-slate-400 px-2 py-0.5 text-sm font-medium" data-testid="draft-badge">
          Draft: Eric to review
        </p>
      )}
      {current.proof && (
        <p className="mt-4 rounded-md border-l-4 border-accent-600 bg-accent-50 p-3 dark:bg-slate-900" data-testid="proof-link">
          <span className="font-semibold">Proof in the app: </span>
          <ProofLink to={current.proof.to} label={current.proof.label} />
        </p>
      )}
      <div className="mt-6">
        <Markdown
          doc={doc}
          markers={{
            timeline: <div id="timeline" className="scroll-mt-16"><PlanTimeline /></div>,
            "category-mix": <div id="category-mix" className="scroll-mt-16"><CategoryMix /></div>,
            "results-tiles": <ResultsTiles />,
            "raid-anchor": <span id="raid" className="block scroll-mt-16" data-tour="raid" />,
          }}
        />
      </div>
      <nav aria-label="Chapters" className="mt-10 flex justify-between gap-4 border-t border-slate-200 pt-4 dark:border-slate-700">
        {prev ? <Link to={`/case-study/${prev.n}`} className={link}>Back: {prev.n}. {prev.title}</Link> : <span />}
        {next && <Link to={`/case-study/${next.n}`} className={link}>Next: {next.n}. {next.title}</Link>}
      </nav>
    </PageShell>
  );
}
