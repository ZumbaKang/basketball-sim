import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

const css = read("../app/globals.css");
const leaguePage = read("../app/(shell)/league/page.tsx");
const frontOfficePage = read("../app/(shell)/front-office/page.tsx");
const standingsPage = read("../app/(shell)/standings/page.tsx");
const historyPage = read("../app/(shell)/history/page.tsx");
const playerPage = read("../app/(shell)/players/[id]/page.tsx");
const scrollableTable = read("./ScrollableTable.tsx");

const mobileRules = css.slice(css.indexOf("@media (max-width: 720px)"));

test("league dashboard exposes responsive action and roster scroll hooks", () => {
  assert.match(leaguePage, /className="cta-row dashboard-actions"/);
  assert.match(leaguePage, /<ScrollableTable[^>]*label="Franchise roster"/s);

  assert.match(css, /\.table-scroll\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /\.table-scroll \.box-table (?:th|td):first-child,[^}]*position:\s*sticky/s);
});

test("league play flow surfaces roster-shortage preflight errors that wrap at 320px", () => {
  const playNextBody = leaguePage.slice(
    leaguePage.indexOf("async function playNext()"),
    leaguePage.indexOf("if (choices)"),
  );
  assert.match(playNextBody, /fetch\("\/api\/games\/play-next"/);
  assert.match(playNextBody, /throw new Error\(json\.error \?\? "Play failed"\)/);
  assert.match(playNextBody, /setError\(e instanceof Error \? e\.message : "Play failed"\)/);

  assert.match(
    leaguePage,
    /className="error play-alert"\s*role="alert"[\s\S]*?\{error\}[\s\S]*?className="cta-row dashboard-actions"/,
  );

  assert.match(
    css,
    /\.error\s*\{[^}]*max-width:\s*100%[^}]*overflow-wrap:\s*anywhere/s,
  );
  assert.match(css, /\.play-alert\s*\{[^}]*margin:\s*0 0 1rem/s);

  const narrowRules = css.slice(css.indexOf("@media (max-width: 420px)"));
  assert.match(narrowRules, /\.dashboard-actions\s*,\s*\.trade-actions\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
});

test("mobile breakpoint stacks trade fields and keeps actions touch friendly", () => {
  assert.match(frontOfficePage, /className="form trade-form"/);
  assert.match(frontOfficePage, /className="cta-row trade-actions"/);

  assert.match(mobileRules, /\.trade-form\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
  assert.match(mobileRules, /\.dashboard-actions \.btn,[^}]*min-height:\s*3rem/s);
  assert.match(
    mobileRules,
    /@media \(max-width:\s*420px\)[^]*\.trade-actions\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s,
  );
});

test("trade actions include a mobile-safe selected-assets summary", () => {
  assert.match(
    frontOfficePage,
    /className="trade-summary"\s*aria-label="Selected trade assets"\s*aria-live="polite"/s,
  );
  assert.match(frontOfficePage, /\{outgoing\.assetName\}/);
  assert.match(frontOfficePage, /\{incoming\.assetName\}/);
  assert.match(frontOfficePage, /\{selectedPartner\?\.name \?\? "Trade partner"\}/);
  assert.match(frontOfficePage, /className="trade-summary"[^]*className="cta-row trade-actions"/);

  assert.match(
    css,
    /\.trade-summary\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto minmax\(0,\s*1fr\)/s,
  );
  assert.match(css, /\.trade-summary-side\s*\{[^}]*min-width:\s*0/s);
  assert.match(
    css,
    /\.trade-summary-name,\s*\.trade-summary-team\s*\{[^}]*overflow-wrap:\s*anywhere/s,
  );
  assert.match(mobileRules, /\.trade-summary\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
});

test("trade builder exposes first/second-round pick selectors and protection controls", () => {
  assert.match(frontOfficePage, /Draft pick/);
  assert.match(frontOfficePage, /First round/);
  assert.match(frontOfficePage, /Second round/);
  assert.match(frontOfficePage, /Unprotected/);
  assert.match(frontOfficePage, /Top-N protected/);
  assert.match(frontOfficePage, /buildTradeAsset/);
  assert.match(frontOfficePage, /givePickId/);
  assert.match(frontOfficePage, /getPickId/);
  assert.match(css, /\.trade-side\s*\{/);
  assert.match(css, /\.asset-kind-toggle\s*\{/);
  assert.match(mobileRules, /\.trade-form\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
});

test("trade requests cannot be double-submitted and controls re-enable afterwards", () => {
  assert.match(frontOfficePage, /const busy = pending !== null;/);
  for (const action of ["propose", "finder", "offer"]) {
    const body = frontOfficePage.slice(frontOfficePage.indexOf(`async function ${action}()`));
    assert.match(body.slice(0, 200), /if \(busy/, `${action} must bail out while busy`);
    assert.match(body.slice(0, 2000), /finally \{\s*setPending\(null\);/s, `${action} must clear pending`);
  }
  assert.match(frontOfficePage, /className="btn btn-primary"[\s\S]*?disabled=\{busy/);
  assert.match(frontOfficePage, /className="btn btn-secondary"[\s\S]*?disabled=\{busy/);
});

test("the trade finder moves focus to the summary it just rewrote", () => {
  assert.match(frontOfficePage, /ref=\{summaryRef\}/);
  assert.match(frontOfficePage, /tabIndex=\{-1\}/);
  const finderBody = frontOfficePage.slice(
    frontOfficePage.indexOf("async function finder()"),
    frontOfficePage.indexOf("async function offer()"),
  );
  assert.match(finderBody, /setToTeamId\(top\.teamId\)/);
  assert.match(finderBody, /summaryRef\.current\?\.focus\(\)/);
});

test("wide tables bleed to the screen edge on mobile without overflowing the page", () => {
  for (const page of [standingsPage, historyPage, leaguePage, playerPage]) {
    assert.match(page, /className="panel mobile-table-panel[^"]*"/);
  }

  assert.match(
    mobileRules,
    /\.mobile-table-panel\s*\{[^}]*overflow:\s*hidden[^}]*\}[^]*\.mobile-table-panel \.table-scroll\s*\{[^}]*width:\s*calc\(100% \+ 2\.2rem\)[^}]*margin-inline:\s*-1\.1rem/s,
  );
  assert.match(
    mobileRules,
    /\.mobile-table-panel \.table-scroll:focus-visible\s*\{[^}]*box-shadow:\s*inset 0 0 0 3px var\(--accent\)/s,
  );
});

test("scrollable tables stay keyboard reachable and describe their offscreen columns", () => {
  assert.match(scrollableTable, /role="region"/);
  assert.match(scrollableTable, /aria-label=\{label\}/);
  assert.match(scrollableTable, /tabIndex=\{0\}/);
  assert.match(scrollableTable, /aria-describedby=\{showHint \? hintId : undefined\}/);
  assert.match(scrollableTable, /Offscreen columns include \{offscreenColumns\}/);

  assert.match(
    standingsPage,
    /offscreenColumns="wins, losses, winning percentage, and point differential"/,
  );
  assert.match(
    historyPage,
    /offscreenColumns="games played, points, rebounds, and assists per game"/,
  );
});

test("every theme exposes the tokens the layout depends on", () => {
  for (const scope of ['[data-theme="dark"]', '[data-theme="light"]']) {
    const block = css.slice(css.indexOf(scope), css.indexOf("}", css.indexOf(scope)));
    for (const token of ["--bg-base", "--text", "--text-soft", "--text-faint", "--line", "--accent"]) {
      assert.ok(block.includes(`${token}:`), `${scope} is missing ${token}`);
    }
  }
});

test("motion is disabled for readers who ask for reduced motion", () => {
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)[^]*animation-duration:\s*0\.01ms\s*!important/s,
  );
});
