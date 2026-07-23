# Merge checklist — vertical slice

Use this before merging PRs into `main`.

## Ownership

- [ ] PR touches one domain, or documents an explicit handoff
- [ ] No domain logic leaked into `frontend/` (UI calls APIs/contracts only)
- [ ] `shared/` breakages update consumers in the same PR or a stacked follow-up

## Quality

- [ ] `npm test` passes locally
- [ ] Sim changes include realism coverage
- [ ] Persistence changes prove auth/league round-trip
- [ ] No secrets (`.env`, credentials) committed

## Vertical slice smoke

- [ ] Register a new user
- [ ] Log out and log back in — same league
- [ ] Play a game between two teams
- [ ] Box score shows reconciled player/team lines

## Automations

- [ ] CI (`.github/workflows/ci.yml`) is green on the PR — required to merge, not just advisory
- [ ] Cursor-authored same-repository PRs are marked ready and merged only after CI succeeds
- [ ] PR Review Gate verdict is Approve
