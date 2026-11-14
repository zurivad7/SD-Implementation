// `npm run check:a11y`: Lighthouse accessibility score must be 95 or more on Home and Dashboard
// (SPEC.md section 10). Builds first, serves dist with `vite preview`, then audits both routes.
// Set CHROME_PATH to use a specific Chrome or Chromium binary.
import { existsSync } from "node:fs";
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import { preview } from "vite";

const MIN_SCORE = 95;
const ROUTES = [
  { name: "Home", hash: "#/" },
  { name: "Dashboard", hash: "#/dashboard" },
  // Extra coverage beyond section 10:
  { name: "Sandbox", hash: "#/sandbox" },
  { name: "Admin", hash: "#/admin" },
];

const fallbackChrome = "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
if (!process.env.CHROME_PATH && existsSync(fallbackChrome)) process.env.CHROME_PATH = fallbackChrome;

const server = await preview({ preview: { port: 4173, strictPort: true }, logLevel: "silent" });
const base = server.resolvedUrls?.local[0] ?? "http://localhost:4173/";
const chrome = await launch({ chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"] });

let failed = false;
try {
  for (const route of ROUTES) {
    const result = await lighthouse(`${base}${route.hash}`, {
      port: chrome.port,
      onlyCategories: ["accessibility"],
      output: "json",
      logLevel: "error",
    });
    const score = Math.round((result?.lhr.categories.accessibility?.score ?? 0) * 100);
    const ok = score >= MIN_SCORE;
    if (!ok) failed = true;
    console.log(`  [${ok ? "PASS" : "FAIL"}] ${route.name} accessibility ${score} (minimum ${MIN_SCORE})`);
    if (!ok && result) {
      for (const audit of Object.values(result.lhr.audits)) {
        if (audit.score === 0) console.log(`        ${audit.id}: ${audit.title}`);
      }
    }
  }
} finally {
  await chrome.kill();
  await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
}

if (failed) {
  console.error("check:a11y failed.");
  process.exit(1);
}
console.log("check:a11y passed.");
