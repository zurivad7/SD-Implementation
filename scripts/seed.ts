// `npm run seed`: writes src/data/seed.json.
// The period ends the day before today (Amsterdam). Override with `npm run seed -- --end YYYY-MM-DD`.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { dayBefore, generate, serialize } from "../src/data/generator";

const endArg = process.argv.indexOf("--end");
const endDate = endArg > -1 ? process.argv[endArg + 1] : dayBefore(new Date());
if (!endDate) throw new Error("Pass a date after --end, for example --end 2026-11-13.");

const started = Date.now();
const data = generate({ endDate });
const text = serialize(data);
const out = join(import.meta.dirname, "..", "src", "data", "seed.json");
writeFileSync(out, text);
console.log(
  `Wrote ${data.tickets.length} tickets, ${data.customers.length} customers to src/data/seed.json ` +
    `(${(text.length / 1e6).toFixed(1)} MB) for ${data.meta.startDate} to ${data.meta.endDate}, go-live ${data.meta.goLiveDate}, in ${Date.now() - started} ms.`,
);
