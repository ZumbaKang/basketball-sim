# Deploying TIPOFF (Fly.io)

TIPOFF runs as a single always-on container with its SQLite save on a persistent
volume. This keeps `db/`, `sim/`, and `gm/` unchanged — the hosted app uses the
exact same engine as local dev.

## Why this shape

- **One machine, always.** SQLite allows a single writer, so `fly.toml` pins
  `max_machines_running = 1` and uses the `immediate` deploy strategy (a rolling
  deploy would need two machines sharing one volume).
- **Volume-backed save.** `DATABASE_URL="file:/data/tipoff.db"` lives on the
  `tipoff_data` volume, so deploys never wipe the league.
- **No serverless timeouts.** Advancing days/seasons simulates many games in one
  request, which can exceed serverless function limits. A container has none.

## First-time setup

```bash
brew install flyctl
fly auth login
fly launch --no-deploy --copy-config --name tipoff-basketball-sim
fly volumes create tipoff_data --size 1 --region iad
fly deploy --remote-only
```

`--remote-only` builds on Fly's builder, so Docker isn't needed locally.

## Move your existing save up

The image never contains a database (see `.dockerignore`), so upload the local
one once:

```bash
fly ssh console -C "mkdir -p /data"
fly ssh sftp shell
# then, at the sftp prompt:
put db/prisma/dev.db /data/tipoff.db
```

Pending migrations are applied on every boot by `deploy/entrypoint.sh`, so an
older save file is fine.

## Keeping it private

The deployment is single-user by design:

- `REGISTRATION_ENABLED=false` (set in `fly.toml`) makes
  `POST /api/auth/register` return 403, so the public login screen cannot be used
  to create additional accounts. Your existing account in the uploaded save still
  logs in normally.
- Sessions are random 32-byte tokens stored as SHA-256 hashes, and the session
  cookie is `httpOnly` + `secure` in production.
- `force_https = true` rejects plaintext HTTP.

To create the very first account on a fresh volume (no uploaded save), flip the
flag temporarily:

```bash
fly secrets set REGISTRATION_ENABLED=true   # register, then:
fly secrets set REGISTRATION_ENABLED=false
```

### Stricter: no public internet at all

For VPN-only access, remove the public addresses and reach the app over Fly's
private network (requires WireGuard or Tailscale on each device, including
phones):

```bash
fly ips list
fly ips release <v4> && fly ips release <v6>
```

## Routine deploys

```bash
fly deploy --remote-only
fly logs
fly status
```

## Local checks before deploying

```bash
npm ci && npm run prisma:generate -w db && npm run migrate -w db
npm run build && npm test
```
