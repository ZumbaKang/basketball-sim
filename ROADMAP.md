# TIPOFF Roadmap

Living backlog for continuous iteration. This file is read by the scheduled
"TIPOFF Iterate" automation (every 3 hours) as well as by any agent or human
picking the next piece of work.

## How this gets worked

1. Pick the **first unchecked item**, top to bottom, in **Now** before moving
   to **Next** or **Later**.
2. Respect `AGENTS.md` / `.cursor/rules/ownership.mdc` — one domain per PR.
   If an item spans domains, split it into per-domain sub-tasks first (edit
   this file to do that) rather than editing multiple domain folders in one PR.
3. Implement the item, add/update tests in the owning workspace (and `qa/`
   for cross-cutting checks), run `npm test` for the touched workspace(s).
4. Open a PR from a feature branch (`git checkout -b <domain>/<short-name>`).
   Use the PR body to note which item this closes.
5. Once merged, check the box below in the same PR (or a tiny immediate
   follow-up) and add a one-line dated note under **Shipped**.
6. If an item turns out to be bigger than one PR, break it into smaller
   checkboxes in place rather than shipping a half-finished cross-domain change.
7. If blocked (needs a product decision, ambiguous spec, or touches a
   contract in `shared/`), leave the item unchecked, add a `_Blocked: why_`
   note under it, and move to the next item instead of guessing.

## Now

- [ ] `qa`: add CI (GitHub Actions) to run `npm test` on every PR
      automatically, and require it to pass before merge into `main`.
- [ ] `sim`: add back-to-back/fatigue modeling — players on the second night
      of a back-to-back get a small efficiency/minutes penalty; validate box
      scores stay realistic under `assertRealisticGameResult`.
- [ ] `gm`: add a bad-contract/expiring-money awareness pass to trade
      evaluation so AI GMs value expiring contracts and avoid hoarding dead
      salary.
- [ ] `frontend`: add a persistent nav bar/shell across `league`, `standings`,
      `front-office`, `history`, and game pages so navigation doesn't rely on
      browser back.
- [ ] `db`: add indices/query tightening for `PlayerSeasonStat` and
      `ScheduledGame` lookups used by standings/history as league history
      grows across seasons (perf, not schema shape changes).
- [ ] `qa`: add a fixture-based regression test that snapshots one full
      simulated game's box score and fails if simulation output drifts
      unexpectedly between runs (deterministic seed).

## Next

- [ ] `sim`: model clutch-time (last 2 min, close score) minute/usage shifts
      for star players.
- [ ] `sim`: injuries should have a small chance of affecting multiple games
      already generated as "already scheduled" — ensure return-from-injury
      is reflected in rotation/minutes.
- [ ] `gm`: coach firing/hiring logic tied to win-loss record and roster
      talent vs. expectations (currently only trades/FA are modeled).
- [ ] `gm`: draft-pick valuation in trades (protect/unprotect logic, and
      valuing future picks vs. present talent).
- [ ] `frontend`: player detail page (season stats, career game log, contract
      info) linked from roster views.
- [ ] `frontend`: mobile-responsive pass on `league` dashboard and
      `front-office` trade builder.
- [ ] `db`: add a lightweight audit/transaction log query API so frontend can
      show "all moves this season" beyond the news feed.
- [ ] `qa`: add a franchise-mode soak test that plays a full season + offseason
      end-to-end and asserts standings/awards/draft invariants hold.
- [ ] `qa`: extend CI to also run `npm run build` for `frontend` (currently
      only `shared`/`sim`/`gm`/`db` are built in CI) so a broken `next build`
      fails PRs too.

## Later

- [ ] `sim`: playoff-intensity tuning (slightly different pace/foul rates in
      playoff games vs. regular season, matching real NBA tendencies).
- [ ] `gm`: rivalries/grudges — GMs remember past lopsided trades and are
      more cautious with teams that "won" a prior trade.
- [ ] `frontend`: dark/light theme toggle and accessibility pass (contrast,
      focus states, keyboard nav for trade builder).
- [ ] `db`: multi-user leagues (more than one human-controlled team) — needs
      a `shared/` contract update first before any domain touches it.

## Shipped

<!-- Add one line per completed item: `- YYYY-MM-DD: <what> (PR #N)` -->
