# Basketball Sim

Multi-agent basketball league simulator. Users log in, manage leagues/teams, and play games that produce realistic NBA-style box scores — with AI owners/GMs making credible front-office moves.

## Setup

```bash
cp .env.example db/.env
printf 'DATABASE_URL="file:./dev.db"\nSESSION_SECRET="dev-session-secret"\n' > frontend/.env.local
npm install
npm run db:migrate
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — register, open your league, tip off a game, read the box score.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm test` | Run sim + db + qa suites |
| `npm run build` | Build workspace packages |
| `npm run dev` | Start TIPOFF frontend |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:seed` | Seed sample user/league |

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
