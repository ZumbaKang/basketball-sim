# Now

- [ ] `qa`: **pre-merge gate** — update TIPOFF Iterate
      (`https://cursor.com/automations/6bdf2d4e-8614-11f1-a7d1-d6b4613131ce`)
      and TIPOFF Roadmap Reprioritize
      (`https://cursor.com/automations/fb625847-8642-11f1-a7d1-d6b4613131ce`)
      automation prompts to edit `roadmap/now.md` / `next.md` / `later.md` /
      `shipped.md` (not a monolithic `ROADMAP.md` checkbox backlog). Keep both
      automations **disabled/paused** until the prompt bodies quote those split
      paths; verify with a dry-run that the agent reads `roadmap/now.md` first.
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
- [ ] `db`: pass prior trade margins into `evaluateTrade` / `tradeFinder` as
      `priorOutcomesWithPartner` for the AI counterparty; verify a seeded
      lopsided loss causes a near-even rematch to be rejected.
- [ ] `gm`: decay `grudgeThresholdPenalty` by optional `seasonsAgo` on each
      prior outcome; verify a three-season-old -20 loss applies less caution
      than a current-season -20.
- [ ] `gm`: apply optional `seasonsAgo` age decay to each compounded loss before
      summing (not only the worst); verify two aged -10s demand less caution than
      two current-season -10s while still exceeding one current -10.
- [ ] `gm`: keep the multi-loss count after a contract-context clause on rejects;
      verify a near-even contend deal with two -10s plus an incoming overpay still
      places "after 2 prior lopsided trades" after the bad-salary note.
- [ ] `gm`: keep the multi-loss count after a clears-bad-salary contract clause on
      accepts; verify sending a long-term overpay with two -10s still ends with
      "after 2 prior lopsided trades" following the clears-salary note.
- [ ] `gm`: include "after 3 prior lopsided trades" when a capped three-loss grudge
      still accepts a star-for-role upgrade; verify three -8 margins on contend.
- [ ] `gm`: keep the multi-loss count after an expiring-money contract clause on
      rejects; verify a near-even contend deal with two -10s plus an incoming
      $40M/1yr overpay still places "after 2 prior lopsided trades" after the
      expiring-money note.
- [ ] `gm`: keep the multi-loss count after a "turns long-term bad salary into
      expiring money" clause on accepts; verify sending a long-term overpay and
      receiving a $40M/1yr overpay with two -10s ends with "after 2 prior
      lopsided trades" following that note.
- [ ] `gm`: keep the multi-loss count after an expiring-money clause on a cheap
      direction accept; verify a clear upgrade with two -10s plus an incoming
      $40M/1yr overpay still places "after 2 prior lopsided trades" after the
      expiring-money note.
- [ ] `frontend`: show the counterparty grudge caution sentence on rejected
      proposals in the trade builder; verify long reasons wrap at 320px without
      overflow.
- [ ] `gm`: include the worst single prior margin in multi-loss caution text
      (e.g. "after 2 prior lopsided trades, worst -20"); verify a -10/-20 pair
      names -20.
- [ ] `db`: pass every stored prior outcome against a partner into
      `priorOutcomesWithPartner` (not only the latest) so GM compounding can fire;
      verify two persisted -10 margins both reach evaluateTrade.
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
