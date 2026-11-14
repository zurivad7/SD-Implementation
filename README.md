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
| `npm run seed` | Regenerate `src/data/seed.json` (period ends the day before today) |
| `npm run test:e2e` | Build, then run the 3 Playwright smoke tests (desktop and phone) |
| `npm run check:all` | Every check above, in order |
| `npm run build` | Run the content check, type-check, then build to `dist/` |

Set `CHROME_PATH` if `check:a11y` cannot find Chrome.

## Editing the text

- Case study chapters: `src/content/case-study/1-client-brief.md` to `8-retrospective.md`.
- About page: `src/content/about.md`. Use only verified facts.
- Each file starts with `DRAFT: Eric to review`. Delete that line when the text is final.
- Markers such as `[[timeline]]` place a chart or graphic. Keep them on their own line.

## Deploy (GitHub Pages)

The workflow in `.github/workflows/deploy.yml` tests every push. Pushes to `main` also build with
`PUBLISH=true` and deploy. That build fails while any page still has the draft line, so nothing
unreviewed goes live.

One-time set-up:

1. In the repository on GitHub: Settings, Pages, Source: **GitHub Actions**.
2. Merge to `main`. The first deploy runs once the draft lines are gone.
3. Custom domain: add a file `public/CNAME` that holds only the domain (for example `demo.example.com`),
   then set the same domain under Settings, Pages, and add the DNS record GitHub shows there.

The app uses a hash router and relative asset paths, so it works on any domain or sub-path.
