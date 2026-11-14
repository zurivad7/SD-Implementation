# Service Desk Implementation Case Study: Build Spec v1

Nov 14, 2026 · @Ekpenyong

## 1. Purpose and success test

The app proves one claim: Eric can take a customer service operation from intake to go-live. A recruiter or hiring manager must understand this in under 2 minutes.

**Primary audience:** hiring managers for Service Delivery and Implementation Project Manager roles in the Netherlands and fully remote.

**Secondary audience:** Zendesk-centric employers who want proof of admin skills (routing, SLAs, triggers, macros).

**Success test:**

1. A visitor opens the home page and reads the one-line claim and three proof links in under 30 seconds.
2. A visitor creates a ticket in the sandbox and sees the routing rule, the SLA timer and the escalation fire.
3. A visitor sees the KPI dashboard change when they change a filter.
4. Eric can run a 5-minute screen-share demo in an interview without a script failure.

**Working title:** "Northwind Support Go-Live: A Service Desk Implementation Case Study". The client name is fictional.

## 2. Scope and hard rules

| In scope (v1) | Out of scope (v1) |
| --- | --- |
| Ticket sandbox with routing, SLA timers, escalations, macros | Real email or chat channels |
| 30 days of seeded synthetic tickets | User accounts, login, multi-user editing |
| KPI dashboard with filters | A real Zendesk API connection |
| Case study pages (brief to retro) | AI auto-replies or chatbots |
| Static deploy, free hosting | A paid backend or database |

**Hard rules. Claude Code must obey all of them.**

1. Label all data as synthetic. Show a fixed banner on every data page: "All tickets, customers and metrics in this demo are synthetic."
2. Do not show a synthetic number as a real result for Eric. Real results go only on the "About Eric" page, and only from the verified list in section 8.
3. Do not use em dashes in any visible text. Use a colon, a comma or a full stop.
4. Use "Executive MBA (EMBA), Quantic School of Business and Technology, 2020" when the page names the degree.
5. Do not use real company names for the client, the vendors or the customers. Do not use the Zendesk logo. The text can say "Zendesk-style".
6. Write all visible text in plain English: short sentences, active voice.
7. The app must work with no network calls after the first page load.

## 3. Tech stack and architecture

The app is a static single-page app. All logic runs in the browser. There is no backend. This keeps hosting free and the demo reliable.

| Layer | Choice | Reason |
| --- | --- | --- |
| Build | Vite + React 18 + TypeScript (strict) | Eric knows React; fast build |
| Styling | Tailwind CSS | Fast, consistent spacing |
| Charts | Recharts | Simple React charts |
| Routing | React Router (hash router) | Works on any static host |
| State | Zustand, saved to localStorage | Sandbox changes survive a reload |
| Random data | seedrandom, seed "northwind-2026" | Same data on every build |
| Tests | Vitest + Testing Library; Playwright for 3 smoke tests | Proves the engines work |
| Deploy | GitHub Pages or Cloudflare Pages | Free |

**Folder structure**

```
src/
  data/
    generator.ts      # seeded synthetic data (section 5)
    seed.json         # build output, committed
  engine/
    routing.ts        # trigger evaluation (section 6)
    sla.ts            # SLA clock and breach logic
    escalation.ts     # escalation rules
    macros.ts         # macro apply
    metrics.ts        # KPI calculations (section 7)
  store/
    useDesk.ts        # Zustand store + localStorage + reset
  pages/
    Home.tsx
    Sandbox.tsx
    TicketDetail.tsx
    Admin.tsx         # rules, SLAs, macros (read and edit)
    Dashboard.tsx
    CaseStudy/*.tsx   # one file per chapter (section 8)
    About.tsx
  components/
  content/
    case-study/*.md   # case study text, edited by Eric
tests/
```

**Key rule:** all engine files are pure functions with no React imports. The UI calls them. The tests call them directly. The engine takes the current time as a parameter, so tests can control the clock.

## 4. Data model

Use these TypeScript types as the single source of truth. All times are ISO 8601 strings in UTC. The UI shows times in Europe/Amsterdam.

```typescript
type Channel = "email" | "web_form" | "chat" | "phone";
type Priority = "low" | "normal" | "high" | "urgent";
type Status = "new" | "open" | "pending" | "on_hold" | "solved" | "closed";
type Category = "billing" | "license_activation" | "download_install" | "refund" | "account_access" | "other";
type Tier = "standard" | "business" | "enterprise";

interface Customer { id: string; name: string; email: string; tier: Tier; language: "en" | "nl" | "de"; }
interface Agent { id: string; name: string; groupIds: string[]; role: "agent" | "lead"; shift: "early" | "late"; }
interface Group { id: string; name: string; } // Tier 1, Billing, Technical, Escalations

interface Ticket {
  id: number;                  // starts at 10001
  subject: string; body: string;
  channel: Channel; category: Category; priority: Priority; status: Status;
  customerId: string; groupId: string | null; assigneeId: string | null;
  tags: string[];
  createdAt: string; firstReplyAt: string | null; solvedAt: string | null;
  slaPolicyId: string | null;
  events: TicketEvent[];       // full audit trail
  csat: { score: "good" | "bad"; comment?: string } | null;
}

interface TicketEvent {
  at: string;
  type: "created" | "rule_fired" | "assigned" | "status_changed" | "public_reply" | "internal_note" | "sla_warning" | "sla_breached" | "escalated" | "macro_applied" | "csat_received";
  actor: string;               // agent id, "system" or "customer"
  detail: string;              // plain-English sentence for the timeline
  ruleId?: string;
}

interface SlaPolicy {
  id: string; name: string;
  match: Condition[];          // e.g. tier = enterprise
  targets: Record<Priority, { firstReplyMins: number; resolutionMins: number }>;
  businessHours: { tz: "Europe/Amsterdam"; start: "08:00"; end: "20:00"; days: number[] } | "24x7";
}

interface Condition { field: keyof Ticket | "customer.tier" | "body"; op: "is" | "is_not" | "contains" | "in"; value: string | string[]; }
interface Action { type: "set_group" | "set_priority" | "add_tag" | "set_status" | "notify_lead"; value: string; }

interface Trigger { id: string; name: string; order: number; active: boolean; all: Condition[]; any: Condition[]; actions: Action[]; }
interface EscalationRule { id: string; name: string; when: "sla_warning" | "sla_breached" | "reopened_twice" | "bad_csat"; actions: Action[]; }
interface Macro { id: string; name: string; reply: string; actions: Action[]; } // reply supports {{customer.name}}, {{ticket.id}}
```

## 5. Synthetic data generator

The generator makes about 4,500 tickets over 30 days. It uses a fixed seed, so every build gives the same data. Run it with `npm run seed`. It writes `src/data/seed.json`.

The data tells a story: the first 14 days are "before go-live" and the last 16 days are "after go-live". The new routing and SLA rules start on day 15. The dashboard must show this change.

| Parameter | Value |
| --- | --- |
| Period | 30 days, ending the day before the build date |
| Volume | 120 to 180 tickets per weekday, 50 to 80 per weekend day |
| Hourly shape | Peak 09:00 to 12:00 and 14:00 to 16:00 Amsterdam time |
| Channels | Email 45%, web form 30%, chat 20%, phone 5% |
| Categories | License activation 30%, download/install 25%, billing 20%, refund 10%, account access 10%, other 5% |
| Priorities | Low 20%, normal 55%, high 20%, urgent 5% |
| Customer tiers | Standard 70%, business 22%, enterprise 8% |
| Customers | 1,800 unique, about 20% with more than one ticket |
| Agents | 10 agents + 2 leads, in 4 groups, early and late shifts |
| CSAT response rate | About 25% of solved tickets |

**Before go-live (days 1 to 14):** no triggers. All tickets land in one queue. Median first reply is slower. About 18% of tickets breach the SLA. About 12% of tickets are reassigned more than once.

**After go-live (days 15 to 30):** the triggers in section 6 run. Breach rate falls toward 6% over the first week, then holds. Reassignments fall. CSAT rises a little.

**Rules for realism:**

- Generate subjects and bodies from templates per category (at least 8 templates each). Use plausible software-license support text. Use no real brand names.
- Customer names come from a mixed Dutch, German and English name list.
- Every generated ticket has a full event trail. The trail must agree with the timestamps.
- Tickets created in the last 2 days can stay open. Older tickets are mostly solved or closed.
- These are target ranges, not fixed results. The dashboard computes the real values from the data.

## 6. Ticket sandbox

The sandbox is the live demo. A visitor creates a ticket and watches the rules act on it. Every rule that fires writes a plain-English line to the ticket timeline.

**6.1 Create ticket form.** Fields: customer (pick or new), tier, channel, category, subject, body, priority (optional). A "Fill example" button loads one of 5 preset scenarios, for example an enterprise customer with an urgent license failure.

**6.2 Routing triggers.** Triggers run in `order` on create and on every update. The first matching `set_group` wins. Seed these 8 triggers:

| # | Name | Conditions | Actions |
| --- | --- | --- | --- |
| 1 | Enterprise fast lane | tier is enterprise | set priority high (if lower), add tag vip, set group Escalations |
| 2 | Urgent keywords | body contains "down", "outage", "cannot work" | set priority urgent, notify lead |
| 3 | Refund requests | category is refund | set group Billing, add tag refund |
| 4 | Billing | category is billing | set group Billing |
| 5 | Activation and install | category in license_activation, download_install | set group Technical |
| 6 | Account access | category is account_access | set group Tier 1, add tag security_check |
| 7 | Dutch language | customer.language is nl | add tag lang_nl |
| 8 | Catch-all | group is empty | set group Tier 1 |

After routing, assign the ticket round-robin to an on-shift agent in the group. Write an "assigned" event.

**6.3 SLA engine.** Pick the first SLA policy that matches. Seed 3 policies:

| Policy | Applies to | Urgent | High | Normal | Low | Hours |
| --- | --- | --- | --- | --- | --- | --- |
| Enterprise | tier enterprise | 30 min / 4 h | 1 h / 8 h | 4 h / 24 h | 8 h / 48 h | 24x7 |
| Business | tier business | 1 h / 8 h | 2 h / 16 h | 8 h / 40 h | 16 h / 72 h | 08:00 to 20:00, Mon to Sat |
| Standard | all others | 2 h / 16 h | 4 h / 24 h | 12 h / 48 h | 24 h / 96 h | 08:00 to 20:00, Mon to Fri |

The first value is first reply time. The second is resolution time. The clock counts business minutes only. The clock pauses when status is pending or on_hold.

Show each timer as a badge: green (more than 25% of target left), amber (25% or less left: write sla_warning), red (breached: write sla_breached).

**6.4 Escalation rules.** Seed 4 rules:

- On sla_warning: notify lead, add tag sla_risk.
- On sla_breached: set group Escalations, notify lead.
- When a ticket reopens twice: add tag repeat_contact, notify lead.
- On bad CSAT: add tag csat_followup, create an internal note "Lead to review within 1 business day."

"Notify lead" only writes an event and shows a toast. It sends nothing.

**6.5 Macros.** Seed 6 macros, one per category plus "Request more info" (sets status pending). Applying a macro adds the reply text and runs its actions.

**6.6 Time controls.** The sandbox has a clock bar: Play, Pause, and "+15 min", "+1 h", "+1 day". This lets a visitor see an SLA warning and breach in seconds. A "Reset sandbox" button restores the seed state.

**6.7 Admin view.** One page lists triggers, SLA policies, escalation rules and macros. A visitor can turn a trigger on or off and change its order. They cannot write new conditions in v1.

## 7. KPI dashboard

The dashboard shows the before and after go-live story. A vertical line marks go-live (day 15) on every time chart. All numbers come from `engine/metrics.ts`. No number is typed by hand.

**Metric definitions (show these in an info tooltip):**

| KPI | Definition |
| --- | --- |
| Tickets created | Count of tickets by createdAt |
| First reply time (median) | Business minutes from createdAt to firstReplyAt, median |
| Resolution time (median) | Business minutes from createdAt to solvedAt, pending time excluded, median |
| SLA breach rate | Tickets with any sla_breached event / tickets with an SLA policy |
| CSAT | Good ratings / all ratings, as % |
| Reassignment rate | Tickets with more than 1 assigned event / all tickets |
| One-touch resolution | Solved tickets with exactly 1 public reply / solved tickets |
| Backlog | Tickets not solved or closed at end of each day |

**Layout:**

1. Top row: 6 KPI tiles. Each tile shows the "after" value, the "before" value, and the change. Green or red shows if the change is good.
2. Line chart: daily SLA breach rate, with the go-live line.
3. Line chart: daily median first reply time, with the go-live line.
4. Stacked bar: daily tickets by channel.
5. Bar chart: backlog at end of day.
6. Table: tickets by group with volume, median first reply, breach rate.

**Filters:** date range, channel, category, tier, group. Filters change every chart and tile together. A "Sandbox tickets" toggle adds tickets the visitor made.

**Export:** a "Download CSV" button exports the filtered tickets. This shows that Eric thinks about reporting handoff.

## 8. Case study pages

The case study is a simulated engagement. It shows how Eric runs an implementation. Each chapter links to the part of the app that proves it. Text lives in `src/content/case-study/*.md` so Eric can edit it without code.

Claude Code writes a first draft of each chapter. Each draft starts with the line "DRAFT: Eric to review". The site build fails if any page still has this line and the env flag `PUBLISH=true` is set.

**Scenario:** Northwind Software (fictional) sells software licenses online in the EU. Support runs from one shared inbox. Customers wait too long. Enterprise customers get the same queue as everyone. Eric leads a 10-week rollout of a Zendesk-style service desk.

| Chapter | Content | Proof link in app |
| --- | --- | --- |
| 1. Client brief | Problem, goals, constraints, stakeholders | Dashboard, "before" period |
| 2. Discovery | Ticket audit, category taxonomy, agent interviews (simulated) | Category mix chart |
| 3. Design | Groups, routing logic, SLA tiers, macros | Admin view |
| 4. Plan | 10-week plan, milestones, RACI | Timeline graphic |
| 5. RAID log | Risks, assumptions, issues, dependencies, with owner and status | Table on page |
| 6. Cutover | Go-live checklist, rollback plan, hypercare rota | Day 15 on dashboard |
| 7. Results | Before and after, from synthetic data, clearly labelled | Dashboard tiles |
| 8. Retrospective | What worked, what did not, what I would change | None |

The chapter 4 timeline is an SVG graphic with 5 phases: Discover (weeks 1 to 2), Design (3 to 4), Build and test (5 to 7), Train and cut over (8), Hypercare (9 to 10). Show 3 gates: design sign-off, UAT sign-off, go/no-go.

The chapter 5 RAID log has at least 8 rows. Columns: ID, type, description, impact (H/M/L), owner role, mitigation, status.

**About Eric page (real data only).** Use only these verified facts:

- Senior Project and Programme Manager, 12+ years across telecoms, IT customer success, infrastructure delivery and business analysis. PMP certified.
- Executive MBA (EMBA), Quantic School of Business and Technology, 2020. B.Eng Electrical/Electronic Engineering, University of Port Harcourt.
- SoftwareKeep, IT Customer Success Specialist: CSAT consistently above 90%, 20% support volume reduction, 15% retention improvement, 10% efficiency increase. Team of about 10 handling 100 to 200 tickets per day.
- Alphamead Group (MTN National Account), Project Manager: 24/7 regional operations, team of up to 25, ran daily HSE toolbox meetings.
- First Class Group (Airtel Regional Account), Project Manager: team of 8.
- Grange School, Project Manager, Infrastructure: 20% inspection process improvement.
- Tools: Zendesk, Jira, SQL, Tableau, Power BI, advanced Excel.

Add links to LinkedIn and a CV download. Eric supplies both URLs.

## 9. Pages, routes and design rules

| Route | Page | Purpose |
| --- | --- | --- |
| `#/` | Home | One-line claim, 3 proof cards (Sandbox, Dashboard, Case study), "5-minute demo" button |
| `#/sandbox` | Sandbox | Ticket list, create form, clock bar |
| `#/sandbox/:id` | Ticket detail | Fields, SLA badges, timeline of events, macro picker |
| `#/admin` | Admin | Triggers, SLA policies, escalations, macros |
| `#/dashboard` | Dashboard | KPIs and charts |
| `#/case-study/:chapter` | Case study | Chapters 1 to 8 with next and back links |
| `#/about` | About Eric | Verified facts, LinkedIn, CV |

**Home page claim (draft):** "I take customer service operations from messy inbox to measured go-live. This demo shows how."

**5-minute demo mode.** A guided tour with 6 steps and a "Next" button. It highlights one element per step: Home claim, Create ticket (preset), trigger fires, clock +1 h shows SLA warning, Dashboard before and after, Case study RAID log.

**Design rules:**

- Calm, professional look. Light theme by default, dark theme toggle.
- One accent colour. Status colours: green ok, amber warning, red breach. Never use colour alone: add an icon or text.
- Font: Inter or system UI. Base size 16 px.
- Works at 375 px wide (phone) and 1440 px wide. The dashboard stacks to one column on a phone.
- WCAG 2.1 AA: contrast 4.5:1 for text, keyboard focus visible, all charts have a text summary.
- Synthetic data banner on Sandbox, Admin and Dashboard pages.

## 10. Acceptance criteria and tests

The build is done only when all items pass. Claude Code must run the tests and show the output.

**Unit tests (Vitest):**

- [ ] Routing: each of the 8 triggers fires on a matching ticket and not on a non-matching ticket.
- [ ] Routing: trigger order is respected; the first set_group wins.
- [ ] SLA: business-hours maths is correct across a weekend and across 20:00 to 08:00.
- [ ] SLA: the clock pauses in pending and on_hold, and resumes on open.
- [ ] SLA: warning fires at 25% left; breach fires at 0%.
- [ ] Escalation: each of the 4 rules fires once, not on every tick.
- [ ] Macros: placeholders fill in; actions run.
- [ ] Metrics: each KPI matches a hand-computed value on a 10-ticket fixture.
- [ ] Generator: the same seed gives byte-identical seed.json.
- [ ] Generator: every ticket event trail is in time order and agrees with createdAt, firstReplyAt, solvedAt.

**Smoke tests (Playwright):**

- [ ] Create a preset enterprise ticket. Timeline shows "Enterprise fast lane" and an assignee.
- [ ] Press "+1 h" until the SLA badge turns amber then red.
- [ ] Change the channel filter on the dashboard. Tile values change.

**Content checks (script `npm run check:content`):**

- [ ] No em dash (U+2014) and no en dash used as a dash in any visible text or markdown file.
- [ ] No "DRAFT: Eric to review" line when `PUBLISH=true`.
- [ ] The synthetic data banner exists on Sandbox, Admin and Dashboard.
- [ ] Lighthouse accessibility score 95 or more on Home and Dashboard.

## 11. Build milestones and kickoff prompt

Build in 6 milestones. Stop after each one. Show the test output. Wait for Eric to say "next".

1. **M1 Foundation:** project setup, types (section 4), routes with empty pages, synthetic data banner, content check script.
2. **M2 Data:** generator and seed.json (section 5), with generator tests.
3. **M3 Engines:** routing, SLA, escalation, macros, metrics as pure functions (sections 6 and 7), with unit tests.
4. **M4 Sandbox and Admin UI:** create form, ticket list, ticket detail timeline, clock bar, reset, admin view.
5. **M5 Dashboard:** tiles, charts, filters, CSV export.
6. **M6 Case study, About, demo mode, deploy:** draft chapters, timeline SVG, RAID table, About page, guided tour, Playwright tests, deploy workflow.

**How to use this spec:** export this doc as Markdown. Save it as `SPEC.md` in an empty repo. Then paste this prompt into Claude Code:

```text
Read SPEC.md in full before you write any code. It is the source of truth.

Build the app in the 6 milestones in section 11. Start with M1 only.

Rules:
- Obey every hard rule in section 2. If a rule blocks you, stop and ask me.
- Do not add features that are not in the spec. Put ideas in IDEAS.md.
- Keep all engine code as pure functions with no React imports.
- Do not invent facts about me. The About page uses only the facts in section 8.
- After each milestone: run the tests, show the output, list the files you changed, and wait for me to type "next".
- If the spec is unclear, ask one question. Do not guess.

Start M1 now.
```

## 12. Open decisions for Eric

Answer these before M6. M1 to M5 can start now.

- [ ] Domain: a subdomain of an existing site, or a new domain?
- [ ] Host: GitHub Pages or Cloudflare Pages?
- [ ] LinkedIn URL and CV file for the About page.
- [ ] Keep the client name "Northwind Software", or pick another fictional name?
- [ ] Final home page claim (section 9 has a draft).
- [ ] Retrospective (chapter 8): write it yourself. It is the most personal part and the strongest interview material.
