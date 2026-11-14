DRAFT: Eric to review

## How the log works

The RAID log holds the project's risks, assumptions, issues and dependencies in one place. I reviewed it with the support leads every week and brought the high-impact rows to the sponsor's status meeting.

## RAID log

[[raid-anchor]]

| ID | Type | Description | Impact | Owner role | Mitigation | Status |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | Risk | Agents keep working from the old inbox after go-live | H | Support leads | Old inbox set to forward only; daily check in hypercare | Closed |
| R2 | Risk | Routing rules send tickets to the wrong group | H | Project manager | UAT with real ticket samples; catch-all rule; daily review in week 1 | Closed |
| R3 | Risk | Business-hours targets confuse agents on shift handover | M | Support leads | Training on SLA badges; one-page guide | Closed |
| R4 | Risk | Ticket volume spikes in the first week after go-live | M | Head of Support | Extra lead cover in hypercare; macros ready | Closed |
| A1 | Assumption | Customer tier is correct in the customer records | H | Enterprise account managers | Tier list checked and fixed before cutover | Validated |
| A2 | Assumption | No new hires are needed to run four groups | M | Head of Support | Workload checked by group in hypercare | Validated |
| I1 | Issue | Refund approvals need a finance sign-off the desk cannot hold | M | Finance | On-hold status while finance checks; refund macro after approval | Resolved |
| I2 | Issue | Dutch-speaking agents not marked in the old tool | L | Support leads | Language tag trigger; Dutch skills list added | Resolved |
| D1 | Dependency | IT must set up single sign-on before training | H | IT and security | Training booked after the SSO test date; fallback logins prepared | Done |
| D2 | Dependency | Finance must approve the refund process before UAT | M | Finance | Process walkthrough in week 4; sign-off at Gate 1 | Done |

## What the log taught me

The two highest risks were about people, not software: old habits and wrong routing. Both were closed by testing with real tickets and by being present on the floor in the first week.
