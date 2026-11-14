// Pure rules for `npm run check:content` (SPEC.md section 10). No Node imports, so tests can call them.

export interface Finding {
  file: string;
  line: number;
  rule: string;
  text: string;
}

export const DRAFT_MARKER = "DRAFT: Eric to review";
const EM_DASH = "\u2014";
const EN_DASH = "\u2013";
/** An en dash between two digits is a range ("1\u20132"), not a dash. Any other en dash is a dash. */
const EN_DASH_AS_DASH = /(?<!\d)\u2013|\u2013(?!\d)/;

export function findDashes(file: string, content: string): Finding[] {
  const out: Finding[] = [];
  content.split("\n").forEach((text, i) => {
    if (text.includes(EM_DASH)) out.push({ file, line: i + 1, rule: "em dash (U+2014)", text });
    if (text.includes(EN_DASH) && EN_DASH_AS_DASH.test(text))
      out.push({ file, line: i + 1, rule: "en dash used as a dash (U+2013)", text });
  });
  return out;
}

export function findDraftMarkers(file: string, content: string): Finding[] {
  const out: Finding[] = [];
  content.split("\n").forEach((text, i) => {
    if (text.trim() === DRAFT_MARKER) out.push({ file, line: i + 1, rule: "draft marker with PUBLISH=true", text });
  });
  return out;
}

/** A page shows the banner if it renders <SyntheticBanner /> or <PageShell ... synthetic>. */
export function hasSyntheticBanner(source: string): boolean {
  return /<SyntheticBanner\b/.test(source) || /<PageShell\b[^>]*\bsynthetic\b/.test(source);
}
