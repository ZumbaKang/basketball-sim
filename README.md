# Basketball Sim (TIPOFF)

Single-player franchise basketball simulator. Pick one of 30 teams, advance a full season calendar, trade with AI GMs, and read NBA-style box scores.

## Setup

```bash
cp .env.example db/.env
printf 'DATABASE_URL="file:./dev.db"\nSESSION_SECRET="dev-session-secret"\n' > frontend/.env.local
npm install
cd db && npx prisma migrate deploy && npx prisma generate && cd ..
npm run build -w shared && npm run build -w sim && npm run build -w gm && npm run build -w db
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or the port Next prints).

## Domains

| Folder | Purpose |
| --- | --- |
| `db/` | Auth, calendar, schedule, persistence |
| `frontend/` | TIPOFF UI |
| `sim/` | Game engine & box scores |
| `gm/` | AI owner/GM decisions |
| `shared/` | Contracts |
| `qa/` | Tests and merge gates |

See [AGENTS.md](./AGENTS.md).
