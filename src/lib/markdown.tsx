// A small, safe markdown renderer for the case study and About text (SPEC.md section 8).
// It builds React elements directly, never HTML strings. Supported: # to ### headings, paragraphs,
// "-" and "1." lists, tables, **bold**, `code`, [links](url), and block markers like [[timeline]]
// that the page swaps for a component.
import { Fragment, type ReactNode } from "react";
import { DRAFT_MARKER } from "../../scripts/contentRules";

export interface ParsedDoc {
  draft: boolean;
  blocks: Block[];
}

export type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "table"; header: string[]; rows: string[][] }
  | { kind: "marker"; name: string };

const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function parseMarkdown(source: string): ParsedDoc {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const draft = lines.some((l) => l.trim() === DRAFT_MARKER);
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const t = line.trim();
    if (t === "" || t === DRAFT_MARKER) { i++; continue; }
    const marker = /^\[\[([a-z0-9-]+)\]\]$/.exec(t);
    if (marker) { blocks.push({ kind: "marker", name: marker[1]! }); i++; continue; }
    const h = /^(#{1,3})\s+(.*)$/.exec(t);
    if (h) { blocks.push({ kind: "heading", level: h[1]!.length as 1 | 2 | 3, text: h[2]! }); i++; continue; }
    if (t.startsWith("|") && lines[i + 1]?.trim().match(/^\|?\s*:?-{3,}/)) {
      const header = cells(t);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i]!.trim().startsWith("|")) rows.push(cells(lines[i++]!));
      blocks.push({ kind: "table", header, rows });
      continue;
    }
    const listMatch = /^(-|\d+\.)\s+/.exec(t);
    if (listMatch) {
      const ordered = listMatch[1] !== "-";
      const items: string[] = [];
      while (i < lines.length && /^(-|\d+\.)\s+/.test(lines[i]!.trim())) items.push(lines[i++]!.trim().replace(/^(-|\d+\.)\s+/, ""));
      blocks.push({ kind: "list", ordered, items });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== "" && !/^(#{1,3}\s|\||-\s|\d+\.\s|\[\[)/.test(lines[i]!.trim())) para.push(lines[i++]!.trim());
    blocks.push({ kind: "paragraph", text: para.join(" ") });
  }
  return { draft, blocks };
}

const linkCls = "font-medium text-accent-700 underline dark:text-accent-300";

/** Inline: **bold**, `code`, [text](url). Internal links start with "#/". */
export function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={k++}>{m[1]}</strong>);
    else if (m[2]) out.push(<code key={k++} className="rounded bg-slate-100 px-1 dark:bg-slate-800">{m[2]}</code>);
    else {
      const href = m[4]!;
      const external = /^https?:/.test(href);
      out.push(
        <a key={k++} href={href} className={linkCls} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {m[3]}{external && <span className="sr-only"> (opens in a new tab)</span>}
        </a>,
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ doc, markers = {}, headingOffset = 0 }: { doc: ParsedDoc; markers?: Record<string, ReactNode>; headingOffset?: number }) {
  return (
    <div className="space-y-4 leading-relaxed">
      {doc.blocks.map((b, i) => {
        switch (b.kind) {
          case "heading": {
            const level = Math.min(6, b.level + headingOffset);
            const cls = level <= 2 ? "mt-8 text-xl font-semibold" : "mt-6 text-lg font-semibold";
            const Tag = `h${level}` as "h2";
            return <Tag key={i} className={cls}>{renderInline(b.text)}</Tag>;
          }
          case "paragraph":
            return <p key={i} className="max-w-3xl">{renderInline(b.text)}</p>;
          case "list": {
            const Tag = b.ordered ? "ol" : "ul";
            return (
              <Tag key={i} className={`max-w-3xl space-y-1 pl-6 ${b.ordered ? "list-decimal" : "list-disc"}`}>
                {b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}
              </Tag>
            );
          }
          case "table":
            return (
              <div key={i} className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <thead className="border-b border-slate-300 dark:border-slate-600">
                    <tr>{b.header.map((h, j) => <th key={j} scope="col" className="py-2 pr-3 align-bottom font-semibold">{renderInline(h)}</th>)}</tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j} className="border-b border-slate-200 align-top dark:border-slate-800">
                        {r.map((c, k) => <td key={k} className="py-2 pr-3">{renderInline(c)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "marker":
            return <Fragment key={i}>{markers[b.name] ?? null}</Fragment>;
        }
      })}
    </div>
  );
}
