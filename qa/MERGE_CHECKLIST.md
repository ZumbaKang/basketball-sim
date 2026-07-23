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
      is intentionally the single **merge** path — do not add a second workflow that
      calls `gh pr merge`; that duplicates and races with this gate. If a PR isn't
      merging, check its comments for what Merge Gate flagged instead of merging around it.
- [ ] `.github/workflows/cursor-pr-ready.yml` is a deliberate, kept exception to the
      "no invented CI" rule below: Cursor cloud automations sometimes open PRs as
      drafts (see PR #14, which got stuck as a draft and was closed unmerged), and
      draft PRs don't reliably trigger CI/Bugbot/Review Gate/Merge Gate. This workflow
      only flips them to ready — it never merges. Do not remove it without confirming
      via the raw REST API (`gh api repos/OWNER/REPO/pulls/N --jq .user.login`) whether
      `cursor[bot]`-authored draft PRs are still happening; `gh pr view --json author`
      displays bot logins differently (e.g. `app/cursor`) and will make this workflow
      look dead when it isn't.
- [ ] PR diff is not `ROADMAP.md`-only, **except** a `TIPOFF Roadmap Reprioritize` PR
      (title like "roadmap: reprioritize backlog"), whose entire job is reordering
      Now/Next/Later every ~4 days — that one is expected to touch only `ROADMAP.md`.
      Any other `ROADMAP.md`-only PR (e.g. a standalone "mark X shipped" PR) is a bug —
      see `ROADMAP.md`'s "How this gets worked".
- [ ] No new `.github/workflows/*.yml`, repo settings, or merge-process changes were
      added as a side effect of an unrelated roadmap item. Process/CI changes need
      their own backlog item and explicit review, not ad hoc invention mid-PR.
