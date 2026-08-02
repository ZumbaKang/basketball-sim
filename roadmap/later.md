# Later

- [ ] `qa`: update TIPOFF Iterate and TIPOFF Roadmap Reprioritize automation
      prompts to edit `roadmap/now.md` / `next.md` / `later.md` / `shipped.md`
      (not a monolithic `ROADMAP.md` backlog), and verify a dry-run prompt quotes
      the split paths.
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
