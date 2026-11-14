import { useMemo } from "react";
import PageShell from "../components/PageShell";
import aboutSource from "../content/about.md?raw";
import { Markdown, parseMarkdown } from "../lib/markdown";

/** Real data only: the verified facts from SPEC.md section 8, kept in src/content/about.md. */
export const LINKEDIN_URL = "https://linkedin.com/in/ekpenyong-effiong";
export const CV_PATH = "Ekpenyong_Effiong_CV.docx";

const btn = "inline-flex items-center rounded-md px-4 py-2 font-medium";

export default function About() {
  const doc = useMemo(() => parseMarkdown(aboutSource), []);
  return (
    <PageShell title="About Eric">
      {doc.draft && <p className="inline-block rounded border border-slate-400 px-2 py-0.5 text-sm font-medium" data-testid="draft-badge">Draft: Eric to review</p>}
      <p className="mt-4 max-w-3xl text-slate-700 dark:text-slate-300">
        This page is about the real person behind the case study. Everything else on this site uses a fictional client and synthetic data.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" className={`${btn} bg-accent-600 text-white hover:bg-accent-700`}>
          LinkedIn profile<span className="sr-only"> (opens in a new tab)</span>
        </a>
        <a href={CV_PATH} download className={`${btn} border border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800`}>
          Download CV (Word document)
        </a>
      </div>
      <div className="mt-6"><Markdown doc={doc} /></div>
    </PageShell>
  );
}
