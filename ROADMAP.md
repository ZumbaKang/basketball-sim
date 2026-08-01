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
- [x] `db`: add `EXPLAIN QUERY PLAN` regression assertions that standings and
      award-history reads use their composite indexes.
- [x] `qa`: make CI build-workspace coverage data-driven from root
      `package.json`, with a regression fixture proving that omitting any
      workspace that declares a `build` script fails the QA check.
- [x] `frontend`: apply the keyboard-focusable, edge-to-edge mobile table
      treatment to standings and history; verify both at 320px without page
      overflow and with visible keyboard focus.
- [x] `sim`: redistribute 1–2 late-game shot attempts from starters to reserves
      during garbage time while preserving team shooting and point totals;
      verify with seeded 15-point and 25-point blowout box scores.
- [x] `db`: add cursor pagination to season transaction-log reads using
      `(day, createdAt, id)` as the stable boundary; verify equal-day rows have
      no duplicates or omissions across pages.
- [x] `sim`: injuries should have a small chance of affecting multiple games
      already generated as "already scheduled" — ensure return-from-injury
      is reflected in rotation/minutes.
- [x] `frontend`: add visible horizontal-scroll instructions to standings and
      history tables; associate each hint with its focusable table region and
      verify screen-reader text identifies the offscreen columns.
- [x] `gm`: coach firing/hiring logic tied to win-loss record and roster
      talent vs. expectations (currently only trades/FA are modeled).
- [x] `qa`: make root test-workspace coverage data-driven from `package.json`;
      add a regression fixture that omits one workspace declaring a `test`
      script and asserts the QA check fails.
- [x] `db`: wire unprotected draft-pick assets through `proposeTrade` and
      `applyTrade` by loading only owned, unselected picks and atomically
      transferring `ownerTeamId`; reject foreign/used picks in regression tests.
- [x] `sim`: harden injury-shortened rotations with only five to seven available
      players so no player exceeds 48 minutes and the team remains at 240;
      verify each roster size with seeded realism checks.
- [x] `frontend`: add a compact selected-assets summary above trade actions;
      verify long player and team names wrap at 320px without horizontal
      overflow.
- [x] `db`: bind transaction-log cursors to their league and season; reject
      cross-league and stale-season cursor reuse in regression tests.
- [x] `sim`: cover combined garbage-time and back-to-back rotations so fatigued
      starters remain above 20 minutes and each team stays at 240 total minutes;
      add seeded regression cases for both home and away teams.
- [x] `db`: validate every player asset belongs to its declaring team before
      trade evaluation and guard player/contract moves inside the transaction;
      verify a foreign-player injection leaves every mixed-trade asset unchanged.
- [x] `sim`: reject game inputs with fewer than five available players before
      box-score generation; verify zero-to-four-player rosters fail with a
      descriptive preflight error.
- [x] `frontend`: disable trade actions while a proposal or finder request is in
      flight and prevent duplicate submissions; verify rapid clicks issue only
      one request and controls re-enable after success or failure.
- [x] `qa`: extract shared workspace-manifest discovery for CI-build and
      root-test coverage checks; verify object-form `workspaces.packages` with
      a regression fixture.
- [x] `frontend`: add first/second-round pick selectors and top-N/unprotected
      controls to the trade builder; verify mixed player/pick proposals serialize
      correctly and remain usable at 320px.
- [x] `qa`: move CI build-command and root-test-command selector parsers into
      `workspace-manifest.ts` beside discovery; verify both omitted-workspace
      fixtures still fail with the same errors.
- [x] `qa`: add a nameless-package object-form fixture and assert coverage still
      matches workspaces by path alone when `package.json` omits `name`.
- [x] `qa`: treat `npm test -w <selector>` (without `run`) the same as
      `npm run test -w` in the shared parser; verify a shorthand fixture still
      counts as covered.
- [x] `qa`: move the build and root-test coverage assertion helpers into
      `workspace-manifest.ts` beside the parsers; verify both omitted-workspace
      fixtures still throw the same errors.
- [x] `qa`: add a mixed named/nameless object-form fixture covered by a package
      name for one workspace and a path for the other; verify CI-build and
      root-test assertions both pass.
- [x] `qa`: add a late-build CI fixture where a workspace is built after
      `- name: Run tests` and assert `assertBuildWorkspaceCoverage` throws the
      precede-tests error for that path.
- [x] `db`: when a scheduled game has fewer than five healthy players, fail before
      persist instead of substituting injured players into `simulateGame`; verify
      no `final` row or game news is written.
- [x] `sim`: distinguish empty input rosters from all-injured rosters in the
      preflight error; verify a zero-length input and a fully injured ten-man
      roster produce different messages naming the cause.
- [x] `frontend`: surface the sim roster-shortage preflight message on the league
      play flow when a game cannot be simulated; verify the alert wraps at 320px.
- [x] `sim`: cap free-throw volume against shot attempts and fouls drawn — a
      single reserve posted 30-30 FT on 3-5 FG in a regular-season game; verify
      no line exceeds a credible FTA-per-FGA ratio while team totals still
      reconcile.
- [x] `qa`: fail the build when a CSS custom property is referenced but never
      declared for a theme — an undefined `--font-*` alias silently dropped every
      page to a serif fallback; add a fixture stylesheet with a dangling `var()`.
- [x] `qa`: also flag dark/light theme-token set skew — properties declared under
      dark but omitted from light (and vice versa) even when `:root` keeps them
      available; verify with a fixture that only redefines half the light palette.
- [x] `db`: wrap `persistResult` in a single Prisma transaction so a mid-write
      failure cannot leave a `Game` row without matching `final` status or game
      news; add a fixture that forces a post-`Game` write error.
- [x] `db`: reject a second `persistResult` when the scheduled row is already
      `final` before creating another `Game`; verify a double-call leaves one
      Game row, one game news item, and unchanged team W/L.
- [x] `db`: force a post-`scheduledGame` update failure inside `persistResult`
      and assert team W/L, teamSeasonStat, and game news all roll back; extend
      the transactional fixture past the Game-create hook.
- [x] `frontend`: move keyboard focus to the play-alert when Play next fails so
      screen-reader users hear the roster-shortage reason immediately; verify
      focus lands on the alert after a failed request.
- [ ] `db`: when day advance hits a short-handed scheduled game, leave that row
      `scheduled`, write a non-game news item naming the short team, and keep
      simulating sibling games that day; verify advance does not abort mid-slate.
- [ ] `db`: bring seeded contracts under the salary cap — a 15-man roster
      totalled $869.4M against a $140M cap, so payroll and cap-space readouts are
      currently meaningless; verify every seeded team opens within cap.
- [ ] `sim`: distribute scoring-nudge makes across the top two rotation players
      instead of only the minute leader; verify under-scored seeds still land in
      the 95–125 band without one player exceeding 40 FGA.
- [ ] `frontend`: when Available drops below five on the league dashboard, show a
      soft warning beside that stat before Play next is clicked; verify it appears
      only under the threshold and wraps at 320px.
- [ ] `db`: mark the scheduled row final with a conditional `updateMany` that
      requires `status = scheduled`, and treat zero updated rows as already-final
      so concurrent double persists cannot both create Game rows; verify with a
      fixture that pre-flips status between the read and update.
- [x] `gm`: rivalries/grudges — GMs remember past lopsided trades and are
      more cautious with teams that "won" a prior trade.
- [ ] `db`: pass prior trade margins into `evaluateTrade` / `tradeFinder` as
      `priorOutcomesWithPartner` for the AI counterparty; verify a seeded
      lopsided loss causes a near-even rematch to be rejected.
- [ ] `gm`: decay `grudgeThresholdPenalty` by optional `seasonsAgo` on each
      prior outcome; verify a three-season-old -20 loss applies less caution
      than a current-season -20.
- [ ] `gm`: compound multiple lopsided losses against the same partner up to
      the existing grudge cap; verify two -10 losses demand more caution than
      one -10.
- [ ] `db`: persist current coaches and an available-candidate pool, evaluate AI
      teams at 20/40/60-game checkpoints, and atomically apply emitted coach
      staffing intents; verify replacements cannot be hired by two teams.
- [ ] `sim`: add a return-to-play minutes cap after absences of four or more
      games, redistributing the difference across healthy reserves; verify the
      returning player ramps up without changing 240-minute team totals.
- [ ] `db`: reject proposals that list the same `playerId` more than once across
      `fromAssets`/`toAssets`; verify duplicated ids leave both rosters and
      contracts unchanged.
- [ ] `frontend`: surface cap space and luxury-tax distance next to payroll on
      the franchise and front-office pages once seeded contracts respect the cap;
      verify the readout wraps at 320px.
- [ ] `sim`: when 1–4 players are available, include the injured remainder count
      in the preflight message (e.g. `3 available, 7 injured`); verify against a
      ten-man roster with mixed health.
- [ ] `qa`: scan frontend TSX string literals for `var(--*)` without fallbacks the
      same way as stylesheets; verify a fixture component referencing an
      undeclared token fails.
- [ ] `db`: treat free agents (`teamId = null`) as invalid trade assets even when
      injected into a mixed package; verify the FA row and any null-team contract
      stay put while owned picks remain with their teams.
- [ ] `frontend`: let the trade finder return mixed player/pick packages and
      hydrate both asset kinds in the builder; verify a pick-heavy finder result
      focuses the summary and stays usable at 320px.
- [ ] `frontend`: show each team's current coach, style, and latest staffing
      rationale on front-office pages; verify long names and rationale wrap at
      320px without horizontal overflow.
- [ ] `db`: when apply-time player ownership fails mid-transaction, assert no
      trade news row is written and sibling pick moves roll back; add a fixture
      that retargets a player between validation and apply.
- [ ] `frontend`: while a play-alert is visible, point the Play next button at it
      with `aria-describedby` so assistive tech announces the shortage reason with
      the control; verify the association clears when the alert dismisses.
- [ ] `sim`: reject input rosters that list the same `playerId` more than once on
      a side before box-score generation; verify a duplicated id fails with a
      descriptive preflight error naming the side.
- [ ] `db`: mirror empty-roster vs all-injured wording in scheduled-game preflight
      by inspecting the unfiltered team roster before the healthy filter; verify
      both causes produce distinct `Cannot simulate scheduled game` errors.
- [ ] `frontend`: move keyboard focus to the play-alert for Sim day / Sim week /
      Sim to my game failures the same way as Play next; verify each advance
      catch path sets the focus flag and the alert receives focus.

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
- [x] `db`: add a composite `NewsItem` index for season transaction-log filters;
      use an `EXPLAIN QUERY PLAN` regression assertion to prove the query uses it.
- [x] `db`: persist protected-pick conveyance terms and resolve them during
      offseason draft-order creation; verify a protected slot stays with its
      original owner while an unprotected slot conveys.
- [x] `db`: validate every player asset belongs to its declaring team before
      trade evaluation and guard player/contract moves inside the transaction;
      verify a foreign-player injection leaves every mixed-trade asset unchanged.
- [x] `frontend`: add first/second-round pick selectors and top-N/unprotected
      controls to the trade builder; verify mixed player/pick proposals serialize
      correctly and remain usable at 320px.
- [x] `sim`: cover combined garbage-time and back-to-back rotations so fatigued
      starters remain above 20 minutes and each team stays at 240 total minutes;
      add seeded regression cases for both home and away teams.
- [x] `sim`: reject game inputs with fewer than five available players before
      box-score generation; verify zero-to-four-player rosters fail with a
      descriptive preflight error.
- [x] `frontend`: player detail page linked from roster and box-score views —
      attributes, contract, rotation role, injury status, and a recent game log
      built from the existing league payload.
- [x] `frontend`: show mobile table scroll hints only when columns actually
      overflow and hide each hint after its region reaches the right edge; verify
      resize and scroll behavior at 320px and desktop widths.
- [x] `frontend`: disable trade actions while a proposal or finder request is in
      flight and prevent duplicate submissions; verify rapid clicks issue only
      one request and controls re-enable after success or failure.
- [x] `frontend`: announce trade-finder asset changes through the selected-assets
      summary and move focus to it; verify keyboard and screen-reader users hear
      both updated player and partner names.
- [ ] `db`: force a post-W/L update failure inside `persistResult` and assert the
      scheduled row, Game, season stats, and game news all roll back; extend the
      transactional fixture past the team W/L increments.
- [ ] `db`: force a post-`teamSeasonStat` upsert failure inside `persistResult`
      and assert Game, scheduled final flip, W/L, and game news all roll back;
      verify with a hook after both season-stat upserts.
- [ ] `db`: force a failure after game-news create inside `persistResult` and
      assert the entire transaction including injury news rolls back; verify no
      orphan news rows remain.
- [ ] `db`: reject `persistResult` when `gameResultId` is already set even if
      `status` is still `scheduled`; verify a mismatched row leaves W/L and news
      unchanged and creates no second Game.
- [ ] `db`: when `Game.create` collides on a reused result id, roll the
      transaction back without flipping the scheduled row; verify with a
      pre-inserted Game id fixture.
- [ ] `db`: surface the already-final persist rejection through
      `simulateScheduledGame` when a caller bypasses the early status return;
      verify a forced second simulate against a final row does not invent a new
      result id.
- [ ] `db`: expose per-player season totals and career game log through an
      owned query/endpoint; the player page can only show the last ten league
      games until this lands.
- [ ] `frontend`: extend the player page with season averages and a full career
      game log once the `db` endpoint above exists; verify the added columns stay
      scrollable at 320px.
- [ ] `sim`: cover combined clutch-time and back-to-back rotations so fatigued
      stars still receive the closing-lineup usage shift while both teams stay
      at 240 minutes; add seeded home and away regression cases.
- [ ] `sim`: make emergency-minute redistribution for five-to-seven-player
      rotations preserve fatigue priority; verify fatigued low-stamina players
      do not gain more minutes than comparable rested teammates.
- [ ] `sim`: add direct made-two and made-three fallback coverage for field-goal
      attempt transfers; verify every player shooting equation and all team
      shooting and point totals still reconcile.
- [ ] `db`: make next-game selection deterministic when malformed schedules
      contain two user games on the same day; add a duplicate-matchup regression
      fixture that asserts a stable tie-break.
- [ ] `db`: reject transaction-log cursors with negative days or noncanonical
      timestamps; add malformed-cursor regressions for each invalid boundary.
- [ ] `db`: record draft selections and offseason contract expirations as
      `draft`/`transaction` news items; verify the season transaction log
      includes both move types.
- [ ] `db`: record protected-pick draft-order resolutions as transaction news
      items; verify retained and conveyed outcomes identify the slot and recipient
      exactly once.
- [ ] `frontend`: show each team's owned future picks on the front-office page
      as a read-only chip list beside the builder; verify long labels wrap at
      320px without horizontal overflow.
- [ ] `db`: add a composite index for tradable draft-pick reads across league,
      owner, selection status, and season; prove the loader avoids a table scan
      with an `EXPLAIN QUERY PLAN` regression.
- [ ] `db`: add an `EXPLAIN QUERY PLAN` regression for current-season next-game
      reads that proves the schedule index covers league, season, status,
      playoff, and day-range filters.
- [ ] `db`: add an order-covering `NewsItem` index for transaction cursor pages;
      prove with `EXPLAIN QUERY PLAN` that bounded reads avoid a temporary sort.
- [ ] `frontend`: restore focus to the Play next button when a later action clears
      the play-alert; verify the button is focused after a successful reload that
      dismisses the shortage message.
- [ ] `frontend`: give the play-alert an accessible name that prefixes the
      shortage reason (e.g. "Could not tip off"); verify the focused alert
      announces both the name and body to a screen reader.
- [ ] `qa`: treat `@property --token` registrations as declarations so
      Houdini-registered custom properties count; verify a fixture that only
      registers via `@property` passes.
- [ ] `qa`: combine undeclared-var and theme-skew checks behind one
      `assertCssThemeContracts` entrypoint; verify a half-light fixture fails
      mentioning skew and a dangling-font fixture still fails undeclared.
- [ ] `qa`: attribute declarations inside `@layer` theme blocks the same as
      unlayered ones; verify a fixture that declares tokens only inside
      `@layer theme` still passes undeclared and skew checks.
- [ ] `qa`: flag light→dark skew the same as dark→light when only the light
      block declares an extra token; verify a fixture that adds `--accent-ink`
      under light alone fails skew for dark.
- [ ] `qa`: assert every CI workspace build runs after Prisma generation as
      well as before tests; add an out-of-order workflow fixture that fails the
      QA check.
- [ ] `qa`: when a workspace is built both before and after `- name: Run tests`,
      keep the earliest build position so a pre-test build still passes; verify
      with a duplicate-build fixture that currently would fail on the last match.
- [ ] `qa`: when the CI workflow omits `- name: Run tests` entirely, assert every
      buildable workspace is reported as late; verify with a no-test-step fixture.
- [ ] `qa`: when two workspaces are built after `- name: Run tests`, assert the
      precede-tests error lists both paths; verify with a dual late-build fixture.
- [ ] `sim`: after a shared `PlayerGameLine.foulsDrawn` field lands, assert
      FTA ≤ 2×foulsDrawn + 1 in realism checks; verify against the deterministic
      box-score fixture.

## Later

- [x] `frontend`: dark/light theme toggle and accessibility pass (contrast,
      focus states, keyboard nav for trade builder).
- [ ] `sim`: playoff-intensity tuning (slightly different pace/foul rates in
      playoff games vs. regular season, matching real NBA tendencies).
- [ ] `db`: multi-user leagues (more than one human-controlled team) — needs
      a `shared/` contract update first before any domain touches it.
- [ ] `qa`: add a franchise-mode soak test that plays a full season + offseason
      end-to-end and asserts standings/awards/draft invariants hold.
      _Blocked: playoff bracket promotion can index incomplete Western
      first-round winners when the Eastern first round finishes first, crashing
      before awards and the offseason draft; persistence must fix this first._
- [ ] `qa`: add a root package fixture with no `scripts.test` and assert
      `assertTestWorkspaceCoverage` throws "Root package is missing a test script".
- [ ] `qa`: stop unquoted workspace selectors at `;` the same as `&`/`|`/`#` so
      `npm test -w alpha; npm test -w beta` still counts both; verify with a
      chained fixture.
- [ ] `qa`: cover a mixed root-test command that chains both `npm test -w` and
      `npm run test -w`; verify both selector forms count toward coverage.
- [ ] `qa`: fail mixed named/nameless coverage when only the named package is
      selected and the nameless path is omitted; verify CI-build and root-test
      assertions both throw for the missing path.
- [ ] `qa`: accept `--workspace=<name>` covering a named package while a sibling
      nameless workspace is covered by path in the same CI/root command; verify
      both assertions pass.
- [ ] `qa`: treat `npm test --workspace=<selector>` shorthand (equals form,
      no `run`) the same as spaced `--workspace`; verify a fixture using the
      equals form still counts as covered.
- [ ] `qa`: accept lifecycle shorthands for `start`/`stop`/`restart` the same
      way as `test`; verify an `npm start -w` fixture counts when checking a
      start script and still rejects `npm build -w`.
- [ ] `qa`: treat an empty-string package `name` the same as an omitted name so
      coverage still matches by path only; verify a `"name": ""` fixture fails
      when its path is missing from the command.
- [ ] `qa`: accept single-quoted and double-quoted workspace selectors that
      contain spaces in both parsers; add a fixture path with a space and assert
      coverage still matches.
- [ ] `qa`: reject duplicate workspace selectors in the root test command; add
      a fixture that invokes one workspace by both path and package name.

## Shipped

<!-- Add one line per completed item: `- YYYY-MM-DD: <what> (PR #N)` -->
- 2026-08-01: GM trade eval raises the bar after prior lopsided losses to a partner
- 2026-07-31: Moved keyboard focus to the play-alert after Play next failures
- 2026-07-30: Extended persistResult rollback coverage past the scheduledGame update
- 2026-07-30: Rejected a second persistResult against an already-final scheduled game
- 2026-07-30: Wrapped persistResult in a Prisma transaction with mid-write rollback
- 2026-07-30: Surfaced roster-shortage preflight errors on the league play flow
- 2026-07-29: Distinguished empty vs all-injured sim preflight shortage messages
- 2026-07-28: Failed short-handed scheduled games before persist (no injured substitution)
- 2026-07-28: Asserted late CI workspace builds after Run tests fail coverage
- 2026-07-28: Covered mixed named/nameless object-form workspaces by package name and path
- 2026-07-28: Moved CI-build and root-test coverage assertion helpers into workspace-manifest
- 2026-07-28: Treated `npm test -w` shorthand as covered in the shared workspace parser
- 2026-07-28: Asserted nameless object-form packages still match CI/root coverage by path
- 2026-07-27: Moved CI build and root-test workspace selector parsers into shared workspace-manifest helpers
- 2026-07-27: Extracted shared workspace-manifest discovery for CI-build and root-test coverage
- 2026-07-27: Rejected sub-five available-player game inputs before box-score generation
- 2026-07-27: Validated trade player assets against declaring teams and guarded moves
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
- 2026-07-24: Asserted standings and award-history reads use composite indexes
- 2026-07-24: Made CI build-workspace coverage follow root package declarations
- 2026-07-24: Made standings and history tables focusable and edge-to-edge on mobile
- 2026-07-24: Shifted 1–2 garbage-time shot attempts from starters to reserves
- 2026-07-24: Indexed current-season transaction-log filters
- 2026-07-25: Added stable cursor pagination to season transaction-log reads
- 2026-07-25: Made simulation rotations honor multi-game injuries and player returns
- 2026-07-25: Added accessible horizontal-scroll instructions to standings and history tables
- 2026-07-25: Added expectation-based GM coach firing and hiring intents
- 2026-07-25: Made root test-workspace coverage follow package declarations
- 2026-07-26: Covered combined garbage-time and back-to-back rotation invariants
- 2026-07-26: Wired owned, unselected draft picks into atomic persisted trades
- 2026-07-26: Capped five-to-seven-player injury rotations at 48 minutes per player
- 2026-07-26: Added a compact, mobile-safe selected-assets trade summary
- 2026-07-26: Bound transaction-log cursors to their issuing league and season
- 2026-07-26: Persisted and resolved protected-pick conveyance during offseason draft ordering
- 2026-07-26: Rebuilt the UI on a dark-first design system with a light theme toggle
- 2026-07-26: Made table scroll hints appear only while columns are actually offscreen
- 2026-07-26: Added a player detail page with attributes, contract, and recent game log
- 2026-07-26: Locked trade actions while a request is in flight and focused the updated summary
- 2026-07-26: Modernized the frontend (cool slate light theme, motion, brand-first auth)
      and shipped trade-builder draft-pick selectors with protection controls
