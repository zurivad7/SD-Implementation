// `npm run check:content`: content checks from SPEC.md section 10.
// Fails (exit 1) on: em dashes, en dashes used as dashes, missing synthetic banners,
// and "DRAFT: Eric to review" lines when PUBLISH=true.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { findDashes, findDraftMarkers, hasSyntheticBanner, type Finding } from "./contentRules";

const ROOT = join(import.meta.dirname, "..");
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "coverage", "test-results", "playwright-report"]);
const TEXT_EXT = /\.(tsx?|md|json|html|css)$/;
const SKIP_FILES = new Set(["package-lock.json"]);
const BANNER_PAGES = ["src/pages/Sandbox.tsx", "src/pages/Admin.tsx", "src/pages/Dashboard.tsx", "src/pages/TicketDetail.tsx"];

function walk(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || SKIP_FILES.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (TEXT_EXT.test(name)) files.push(full);
  }
  return files;
}

const publish = process.env.PUBLISH === "true";
const findings: Finding[] = [];
const files = walk(ROOT);

for (const full of files) {
  const rel = relative(ROOT, full);
  const content = readFileSync(full, "utf8");
  findings.push(...findDashes(rel, content));
  if (publish && rel.endsWith(".md")) findings.push(...findDraftMarkers(rel, content));
}

for (const page of BANNER_PAGES) {
  if (!hasSyntheticBanner(readFileSync(join(ROOT, page), "utf8")))
    findings.push({ file: page, line: 0, rule: "synthetic data banner missing", text: "" });
}

console.log(`check:content scanned ${files.length} files (PUBLISH=${publish}).`);
console.log(`  [${findings.some((f) => f.rule.includes("dash")) ? "FAIL" : "PASS"}] No em dash or en dash used as a dash`);
console.log(`  [${findings.some((f) => f.rule.includes("banner")) ? "FAIL" : "PASS"}] Synthetic banner on ${BANNER_PAGES.map((p) => p.split("/").pop()).join(", ")}`);
console.log(`  [${!publish ? "SKIP" : findings.some((f) => f.rule.includes("draft")) ? "FAIL" : "PASS"}] No draft markers (only checked when PUBLISH=true)`);

if (findings.length > 0) {
  for (const f of findings) console.error(`  ${f.file}:${f.line}  ${f.rule}  ${f.text.trim().slice(0, 100)}`);
  console.error(`check:content failed with ${findings.length} finding(s).`);
  process.exit(1);
}
console.log("check:content passed.");
