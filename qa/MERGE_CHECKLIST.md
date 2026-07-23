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
- [ ] PR Review Gate verdict is Approve
- [ ] `TIPOFF Merge Gate` is the only automation that merges PRs (squash + delete branch)
      once CI/Bugbot/Review Gate are all green and its own ownership skim is clean. It
      is intentionally the single merge path — do not add a second auto-merge workflow
      (e.g. a `.github/workflows/*.yml` that calls `gh pr merge`); that duplicates and
      races with this gate. If a PR isn't merging, check its comments for what Merge
      Gate flagged instead of merging around it.
- [ ] PR diff is not `ROADMAP.md`-only. Roadmap bookkeeping (checkbox, Shipped line,
      new backlog items) belongs in the same PR as the code change it documents — see
      `ROADMAP.md`'s "How this gets worked". A standalone "mark X shipped" PR is a bug.
- [ ] No new `.github/workflows/*.yml`, repo settings, or merge-process changes were
      added as a side effect of an unrelated roadmap item. Process/CI changes need
      their own backlog item and explicit review, not ad hoc invention mid-PR.
