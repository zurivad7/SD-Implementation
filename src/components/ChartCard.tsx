import type { ReactNode } from "react";

interface Props {
  id: string;
  title: string;
  /** Plain-text summary of what the chart shows (WCAG: every chart has a text summary). */
  summary: string;
  columns: string[];
  rows: Array<Array<string | number>>;
  children: ReactNode;
}

/** A chart with its title, a text summary and a data table view. */
export default function ChartCard({ id, title, summary, columns, rows, children }: Props) {
  return (
    <figure aria-labelledby={`${id}-title`} className="min-w-0 rounded-lg border border-slate-200 p-4 dark:border-slate-700" data-testid={id}>
      <h3 id={`${id}-title`} className="font-semibold">{title}</h3>
      <figcaption className="mt-1 text-sm text-slate-700 dark:text-slate-300" data-testid={`${id}-summary`}>{summary}</figcaption>
      <div className="mt-3 h-64" aria-hidden="true">{children}</div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer font-medium text-accent-700 dark:text-accent-300">Show data table</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full text-left">
            <caption className="sr-only">{title}</caption>
            <thead><tr>{columns.map((c) => <th key={c} scope="col" className="pr-3 font-semibold">{c}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className="pr-3">{v}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
