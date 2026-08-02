# Next

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
