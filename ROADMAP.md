# TIPOFF Roadmap

Living backlog for continuous iteration. This file is read by the scheduled
"TIPOFF Iterate" automation (every 3 hours) as well as by any agent or human
picking the next piece of work. A separate "TIPOFF Roadmap Reprioritize"
automation (every ~4 days) reorders Now/Next/Later by priority without
implementing anything — its PRs are expected to touch only this file.

## How this gets worked

1. Pick the **first unchecked item**, top to bottom, in **Now** before moving
   to **Next** or **Later**.
2. Respect `AGENTS.md` / `.cursor/rules/ownership.mdc` — one domain per PR.
   If an item spans domains, split it into per-domain sub-tasks first (edit
   this file to do that) rather than editing multiple domain folders in one PR.
3. Implement the item, add/update tests in the owning workspace (and `qa/`
   for cross-cutting checks), run `npm test` for the touched workspace(s).
4. **In that same branch/commit — before opening the PR** — also edit this
   file: check the box for the item you just implemented, add a one-line
   dated note under **Shipped**, and add the 1–3 new backlog follow-ups
   from step 8 below. All of that is a `ROADMAP.md` diff living in the exact
   same branch as the code change. Do this before your first `git push`, not
   after.
5. Open exactly **one PR** per roadmap item, from one feature branch
   (`git checkout -b <domain>/<short-name>`), containing both the code
   change and the `ROADMAP.md` update in the same diff. Use the PR body to
   note which item this closes.
   **HARD RULE — read this if you take nothing else from this file:**
   A PR whose diff is *only* `ROADMAP.md` is a bug, not a valid PR. If you
   notice you already opened/merged a code PR without its `ROADMAP.md`
   bookkeeping, do **not** open a follow-up PR titled anything like
   "mark X shipped" and do **not** push a direct commit to `main`. Instead:
   check out the *original* branch (or a fresh branch off `main` if it was
   already merged), make the `ROADMAP.md` edit there, and either push an
   additional commit to the still-open PR, or — if it already merged —
   fold the edit into your *next* roadmap-item PR's diff instead of
   shipping a standalone docs PR for it. Missing one Shipped-log line for a
   cycle is fine; a docs-only PR is not.
6. If an item turns out to be bigger than one PR, break it into smaller
   checkboxes in place (same PR as the first sub-item you ship) rather than
   shipping a half-finished cross-domain change.
7. If blocked (needs a product decision, ambiguous spec, or touches a
   contract in `shared/`), leave the item unchecked, add a `_Blocked: why_`
   note under it, and move to the next item instead of guessing.
8. **Refill the backlog in the same PR.** Before opening the PR, spend a
   couple minutes thinking about what you just touched: obvious follow-ups,
   edge cases you deliberately skipped, adjacent gaps in that same domain,
   or realism/UX issues you noticed while in there. Add **1–3 new
   checkboxes** to **Now**, **Next**, or **Later** (whichever fits) as part
   of the same `ROADMAP.md` diff from step 4 — not a separate PR. Each new
   item must be as concrete and single-PR-sized as the existing ones — name
   the owning domain, describe the change, and note how it'd be verified.
   Do not add vague items ("improve X", "polish Y") and do not add more
   than 3 in one run — the backlog should grow steadily, not turn into noise.
9. **Do not invent CI/automation/repo-process changes on your own.**
   `.github/workflows/cursor-pr-ready.yml` is a deliberately authorized
   exception: Cursor-authored PR events do not reliably trigger other Cursor
   automations, so it marks draft PRs ready and enables GitHub-native squash
   auto-merge only after CI succeeds for the current head SHA and every
   reported check has finished successfully. Branch protection remains
   responsible for required checks. Do not add another merge workflow or
   bypass this gate. If any other part of the PR/CI/merge process seems broken
   while working an item, add it as a new `qa`-owned backlog item (per step 8)
   for explicit evaluation instead of changing repository process as a side
   effect.

## Now

- [x] `qa`: add CI (GitHub Actions) to run `npm test` on every PR
      automatically, and require it to pass before merge into `main`.
- [x] `sim`: add back-to-back/fatigue modeling — players on the second night
      of a back-to-back get a small efficiency/minutes penalty; validate box
      scores stay realistic under `assertRealisticGameResult`.
- [x] `gm`: add a bad-contract/expiring-money awareness pass to trade
      evaluation so AI GMs value expiring contracts and avoid hoarding dead
      salary.
- [x] `frontend`: add a persistent nav bar/shell across `league`, `standings`,
      `front-office`, `history`, and game pages so navigation doesn't rely on
      browser back.
- [x] `db`: add indices/query tightening for `PlayerSeasonStat` and
      `ScheduledGame` lookups used by standings/history as league history
      grows across seasons (perf, not schema shape changes).
- [x] `qa`: add a fixture-based regression test that snapshots one full
      simulated game's box score and fails if simulation output drifts
      unexpectedly between runs (deterministic seed).
- [x] `qa`: extend CI to also run `npm run build` for `frontend` (currently
      only `shared`/`sim`/`gm`/`db` are built in CI) so a broken `next build`
      fails PRs too.
- [x] `db`: tighten user next-game `ScheduledGame` lookups to the current
      season and regular season; regression-test against stale/playoff rows.
- [x] `sim`: add garbage-time rotation shifts for games decided by 15+ points,
      moving 2–4 minutes from starters to bench players while preserving team
      minute totals; verify with seeded blowout comparisons and realism checks.
- [x] `frontend`: mobile-responsive pass on `league` dashboard and
      `front-office` trade builder.

## Next

- [x] `sim`: model clutch-time (last 2 min, close score) minute/usage shifts
      for star players.
- [x] `db`: constrain regular-season next-game lookups to `day >= league.day`;
      regression-test against an orphaned current-season scheduled row from an
      earlier day.
- [x] `db`: add a lightweight audit/transaction log query API so frontend can
      show "all moves this season" beyond the news feed.
- [x] `gm`: draft-pick valuation in trades (protect/unprotect logic, and
      valuing future picks vs. present talent).
- [ ] `sim`: injuries should have a small chance of affecting multiple games
      already generated as "already scheduled" — ensure return-from-injury
      is reflected in rotation/minutes.
- [ ] `db`: add `EXPLAIN QUERY PLAN` regression assertions that standings and
      award-history reads use their composite indexes.
- [ ] `sim`: playoff-intensity tuning (slightly different pace/foul rates in
      playoff games vs. regular season, matching real NBA tendencies).
- [ ] `sim`: redistribute 1–2 late-game shot attempts from starters to reserves
      during garbage time while preserving team shooting and point totals;
      verify with seeded 15-point and 25-point blowout box scores.
- [ ] `sim`: cover combined garbage-time and back-to-back rotations so fatigued
      starters remain above 20 minutes and each team stays at 240 total minutes;
      add seeded regression cases for both home and away teams.
- [ ] `frontend`: dark/light theme toggle and accessibility pass (contrast,
      focus states, keyboard nav for trade builder).
- [ ] `frontend`: apply the keyboard-focusable, edge-to-edge mobile table
      treatment to standings and history; verify both at 320px without page
      overflow and with visible keyboard focus.
- [ ] `frontend`: add a compact selected-assets summary above trade actions;
      verify long player and team names wrap at 320px without horizontal
      overflow.
- [ ] `qa`: add a franchise-mode soak test that plays a full season + offseason
      end-to-end and asserts standings/awards/draft invariants hold.
- [ ] `qa`: make CI build-workspace coverage data-driven from root
      `package.json`, with a regression fixture proving that omitting any
      workspace that declares a `build` script fails the QA check.
- [ ] `db`: make next-game selection deterministic when malformed schedules
      contain two user games on the same day; add a duplicate-matchup regression
      fixture that asserts a stable tie-break.
- [ ] `db`: record draft selections and offseason contract expirations as
      `draft`/`transaction` news items; verify the season transaction log
      includes both move types.
- [ ] `db`: add a composite `NewsItem` index for season transaction-log filters;
      use an `EXPLAIN QUERY PLAN` regression assertion to prove the query uses it.
- [ ] `db`: wire unprotected draft-pick assets through `proposeTrade` and
      `applyTrade` by loading only owned, unselected picks and atomically
      transferring `ownerTeamId`; reject foreign/used picks in regression tests.
- [ ] `db`: persist protected-pick conveyance terms and resolve them during
      offseason draft-order creation; verify a protected slot stays with its
      original owner while an unprotected slot conveys.
- [ ] `frontend`: add first/second-round pick selectors and top-N/unprotected
      controls to the trade builder; verify mixed player/pick proposals serialize
      correctly and remain usable at 320px.

## Later

- [ ] `frontend`: player detail page (season stats, career game log, contract
      info) linked from roster views.
- [ ] `gm`: coach firing/hiring logic tied to win-loss record and roster
      talent vs. expectations (currently only trades/FA are modeled).
- [ ] `gm`: rivalries/grudges — GMs remember past lopsided trades and are
      more cautious with teams that "won" a prior trade.
- [ ] `db`: multi-user leagues (more than one human-controlled team) — needs
      a `shared/` contract update first before any domain touches it.

## Shipped

<!-- Add one line per completed item: `- YYYY-MM-DD: <what> (PR #N)` -->
- 2026-07-22: Required the CI `test` check before merges to `main` (PR #10)
- 2026-07-22: Added stamina-scaled back-to-back fatigue modeling (PR #11)
- 2026-07-23: GM trade evaluation now values expiring/bad contracts (PR #16)
- 2026-07-23: Added persistent navigation across league screens (PR #18)
- 2026-07-23: Indexed and tightened league history lookups (PR #21)
- 2026-07-23: Snapshotted a deterministic full-game box score in QA (PR #23)
- 2026-07-23: Modeled clutch-time rotation and usage shifts for star players
- 2026-07-23: Added the frontend Next.js production build to the CI merge gate
- 2026-07-23: Scoped user next-game lookups to the current regular season
- 2026-07-23: Added garbage-time starter-to-bench rotation shifts for blowouts
- 2026-07-23: Made the league dashboard and trade builder mobile responsive
- 2026-07-23: Excluded earlier-day schedule rows from next-game lookups
- 2026-07-23: Added an owner-scoped current-season transaction log query API
- 2026-07-24: Added direction-aware draft-pick trade valuation and protection discounts
