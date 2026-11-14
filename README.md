# Northwind Support Go-Live

A service desk implementation case study. Northwind Software is a fictional client.
All tickets, customers and metrics in this demo are synthetic.

SPEC.md is the source of truth.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm test` | Run the Vitest unit tests |
| `npm run typecheck` | Type-check in strict mode |
| `npm run check:content` | Check for dashes, the synthetic banner and (with `PUBLISH=true`) draft markers |
| `npm run check:a11y` | Build, then run Lighthouse accessibility on Home and Dashboard (minimum 95) |
| `npm run build` | Run the content check, type-check, then build to `dist/` |

Set `CHROME_PATH` if `check:a11y` cannot find Chrome.
