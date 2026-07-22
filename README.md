# Basketball Sim

Multi-agent basketball league simulator. Users log in, manage leagues/teams, and play games that produce realistic NBA-style box scores — with AI owners/GMs making credible front-office moves.

## Setup

```bash
cp .env.example .env
npm install
npm test
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm test` | Run QA suite |
| `npm run build` | Build workspace packages |
| `npm run dev` | Start frontend (once configured) |
| `npm run db:migrate` | Run DB migrations |
| `npm run db:seed` | Seed fictional league |

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
