# Basketball Sim

Multi-agent basketball league simulator. Users log in, manage leagues/teams, and play games that produce realistic NBA-style box scores — with AI owners/GMs making credible front-office moves.

## Status

**Wiring only.** Domain folders, agent ownership rules, and specialist skills are in place. Application code comes next.

## Domains

| Folder | Purpose |
| --- | --- |
| `db/` | Users, players, teams, leagues, persistence |
| `frontend/` | Slick user UI |
| `sim/` | Game simulation & realistic box scores |
| `gm/` | Owner/GM logic (trades, coaches, roster) |
| `shared/` | Contracts between domains |
| `qa/` | Tests and PR gates |

Agent boundaries: see [AGENTS.md](./AGENTS.md).
