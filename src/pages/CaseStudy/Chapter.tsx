import { Link, useParams } from "react-router-dom";
import PageShell from "../../components/PageShell";
import Placeholder from "../../components/Placeholder";
import NotFound from "../NotFound";
import { CHAPTERS } from "./chapters";

export default function CaseStudyChapter() {
  const { chapter } = useParams();
  const n = Number(chapter);
  const current = CHAPTERS.find((c) => c.n === n);
  if (!current) return <NotFound />;
  const prev = CHAPTERS.find((c) => c.n === n - 1);
  const next = CHAPTERS.find((c) => c.n === n + 1);

  return (
    <PageShell title={`${current.n}. ${current.title}`}>
      <Placeholder milestone="M6" what="this chapter" />
      <nav aria-label="Chapters" className="mt-8 flex justify-between gap-4">
        {prev ? (
          <Link to={`/case-study/${prev.n}`} className="text-accent-700 underline dark:text-accent-300">
            Back: {prev.n}. {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link to={`/case-study/${next.n}`} className="text-accent-700 underline dark:text-accent-300">
            Next: {next.n}. {next.title}
          </Link>
        )}
      </nav>
    </PageShell>
  );
}
