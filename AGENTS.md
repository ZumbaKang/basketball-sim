# Basketball Sim — Agent Ownership Map

This repo is built by specialized agents. Stay in your lane. Cross-domain work goes through `shared/` contracts only.

## Domain Owners

| Domain | Folder(s) | Owns | Never touches |
| --- | --- | --- | --- |
| **Persistence** | `db/` | Schema, migrations, auth/session, league save/load, queries | UI styling, box-score math, GM decision logic |
| **Frontend** | `frontend/` | Slick UI, client state, pages/components, UX flows | DB schema, simulation formulas, trade AI |
| **Simulation** | `sim/` | Game engine, realistic NBA-like box scores, pace/usage math | GM decisions, auth, visual design |
| **Owner / GM** | `gm/` | Trades, coaching staff, roster moves, AI owner logic | Box-score generation, UI polish, schema shape |
| **QA / PR** | `qa/` | Tests, fixtures, PR review checklists, merge gates | Inventing features or changing domain logic |

## Shared Contracts (`shared/`)

- Only place for cross-domain types, event shapes, and API contracts.
- If Persistence, Sim, GM, or Frontend need to talk, define/update the contract here first.
- Do not put implementation logic in `shared/`.

## Handoff Rules

1. **One domain per PR** when possible. Mixed PRs need an explicit handoff note in the PR body.
2. **Contract-first**: change `shared/` → get consuming domains updated → then ship behavior.
3. **Simulation owns numbers**. GM proposes intents (trade X for Y); Sim/Persistence apply validated outcomes.
4. **Persistence owns truth**. League state after login must round-trip through `db/` only.
5. **Frontend is presentation**. It renders state and sends intents; it does not invent sim or GM rules.
6. **QA does not ship features**. It blocks merge on failing tests, broken contracts, or unrealistic box scores.

## Specialist Skills

Invoke these when working in a domain:

- `.cursor/skills/persistence-agent`
- `.cursor/skills/frontend-agent`
- `.cursor/skills/simulation-agent`
- `.cursor/skills/gm-agent`
- `.cursor/skills/pr-qa-agent`

## PR Gate Agents

Automations (once the repo is on GitHub) should:

1. **Test** — run the test suite on PR open/push; comment pass/fail.
2. **Review** — check ownership boundaries, contracts, and realism; approve only when clean.
