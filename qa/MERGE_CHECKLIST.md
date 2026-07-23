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
- [ ] PR Review Gate and Bugbot findings are addressed when those automations run.
      Cursor-authored PR events do not reliably dispatch other Cursor automations, so
      neither gate may be used as the only trigger for merging.
- [ ] `.github/workflows/cursor-pr-ready.yml` is the only automated merge path for
      same-repository `cursor[bot]` PRs. It reacts to a successful CI `workflow_run`,
      verifies that CI tested the current head SHA, waits for every reported check to
      finish successfully, and asks GitHub to squash auto-merge and delete the branch.
      GitHub branch protection remains responsible for required checks. Do not add a
      second workflow that calls `gh pr merge`.
- [ ] `TIPOFF Merge Gate` may still perform its ownership/quality skim, but it is not
      relied on to execute the merge: Cursor automation events do not chain reliably,
      and the gate currently has no merge/delete action configured.
- [ ] `.github/workflows/cursor-pr-ready.yml` is a deliberate, kept exception to the
      "no invented CI" rule below: Cursor cloud automations sometimes open PRs as
      drafts (see PR #14, which got stuck as a draft and was closed unmerged), and
      draft PRs don't reliably trigger CI/Bugbot/Review Gate/Merge Gate. This workflow
      marks them ready before enabling auto-merge after successful CI. Do not remove it
      without confirming via the raw REST API
      (`gh api repos/OWNER/REPO/pulls/N --jq .user.login`) whether `cursor[bot]`-authored
      PRs are still happening; `gh pr view --json author` displays bot logins differently
      (e.g. `app/cursor`) and will make this workflow look dead when it isn't.
- [ ] PR diff is not `ROADMAP.md`-only, **except** a `TIPOFF Roadmap Reprioritize` PR
      (title like "roadmap: reprioritize backlog"), whose entire job is reordering
      Now/Next/Later every ~4 days — that one is expected to touch only `ROADMAP.md`.
      Any other `ROADMAP.md`-only PR (e.g. a standalone "mark X shipped" PR) is a bug —
      see `ROADMAP.md`'s "How this gets worked".
- [ ] No new `.github/workflows/*.yml`, repo settings, or merge-process changes were
      added as a side effect of an unrelated roadmap item. Process/CI changes need
      their own backlog item and explicit review, not ad hoc invention mid-PR.
