DRAFT: Eric to review

## Design principles

- Route on facts the customer gives us: category, tier and language.
- Keep the rules few and readable, so leads can maintain them.
- Measure in business hours, so targets are fair to the team.
- Warn early, then escalate. Never escalate silently.

## Groups

Four groups replace the single inbox:

| Group | Owns | Why |
| --- | --- | --- |
| Tier 1 | Account access and general questions | Fast, broad first line |
| Billing | Billing and refunds | Finance rules need trained people |
| Technical | License activation, download and install | The largest share of work needs product skills |
| Escalations | Enterprise customers and breached tickets | Senior agents and leads, for the cases that matter most |

## Routing logic

Eight triggers run in order when a ticket arrives and on every update. The first trigger that sets a group wins, so the enterprise rule comes first. Each trigger fires once per ticket, so a later update cannot undo an escalation.

1. **Enterprise fast lane:** raise priority to high, tag vip, send to Escalations.
2. **Urgent keywords:** words like "outage" or "cannot work" raise priority to urgent and notify a lead.
3. **Refund requests** and 4. **Billing:** send to Billing.
5. **Activation and install:** send to Technical.
6. **Account access:** send to Tier 1 with a security check tag.
7. **Dutch language:** tag the ticket so a Dutch speaker can pick it up.
8. **Catch-all:** anything left goes to Tier 1.

After routing, the ticket goes to the next on-shift agent in the group, in turn.

## SLA tiers

Each customer tier has its own targets. The clock counts business minutes only. It pauses while we wait for the customer (pending) or for another team (on hold).

| Tier | Hours | Example: normal priority |
| --- | --- | --- |
| Enterprise | 24 hours a day, 7 days a week | First reply 4 h, resolution 24 h |
| Business | 08:00 to 20:00, Monday to Saturday | First reply 8 h, resolution 40 h |
| Standard | 08:00 to 20:00, Monday to Friday | First reply 12 h, resolution 48 h |

## Escalation rules

- At 25% of the target left: notify the lead and tag the ticket as at risk.
- At breach: move the ticket to Escalations and notify the lead.
- When a customer reopens a ticket twice: tag it and notify the lead.
- On a bad satisfaction rating: tag it and add a note for the lead to review within 1 business day.

## Macros

Six macros cover the most common answers: one for each main category, plus "Request more info". Each macro fills in the customer's name and ticket number, then sets the right status.

The Admin view shows the full configuration, and lets you switch triggers on and off.
