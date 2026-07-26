import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const leaguePage = readFileSync(new URL("../app/(shell)/league/page.tsx", import.meta.url), "utf8");
const frontOfficePage = readFileSync(new URL("../app/(shell)/front-office/page.tsx", import.meta.url), "utf8");
const standingsPage = readFileSync(new URL("../app/(shell)/standings/page.tsx", import.meta.url), "utf8");
const historyPage = readFileSync(new URL("../app/(shell)/history/page.tsx", import.meta.url), "utf8");

test("league dashboard exposes responsive action and roster scroll hooks", () => {
  assert.match(leaguePage, /className="cta-row dashboard-actions"/);
  assert.match(leaguePage, /className="table-scroll"/);
  assert.match(leaguePage, /role="region" aria-label="Franchise roster" tabIndex=\{0\}/);

  assert.match(css, /\.table-scroll\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /\.table-scroll \.box-table (?:th|td):first-child,[^}]*position:\s*sticky/s);
});

test("mobile breakpoint stacks trade fields and keeps actions touch friendly", () => {
  assert.match(frontOfficePage, /className="form trade-form"/);
  assert.match(frontOfficePage, /className="cta-row trade-actions"/);

  const mobileRules = css.slice(css.indexOf("@media (max-width: 720px)"));
  assert.match(mobileRules, /\.trade-form\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
  assert.match(mobileRules, /\.dashboard-actions \.btn,[^}]*min-height:\s*3rem/s);
  assert.match(mobileRules, /@media \(max-width:\s*420px\)[^]*\.trade-actions\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
});

test("standings and history tables expose accessible mobile scroll instructions", () => {
  assert.match(standingsPage, /className="panel mobile-table-panel"/);
  assert.match(
    standingsPage,
    /id=\{hintId\}[^]*Offscreen columns include wins, losses, winning percentage, and point differential\./,
  );
  assert.match(
    standingsPage,
    /className="table-scroll"[^]*aria-label=\{`\$\{title\} standings`\}[^]*aria-describedby=\{hintId\}[^]*tabIndex=\{0\}/,
  );
  assert.match(historyPage, /className="panel mobile-table-panel"/);
  assert.match(
    historyPage,
    /id="scoring-leaders-scroll-hint"[^]*Offscreen columns include games played, points, rebounds, and assists per game\./,
  );
  assert.match(
    historyPage,
    /className="table-scroll"[^]*aria-label="Scoring leaders"[^]*aria-describedby="scoring-leaders-scroll-hint"[^]*tabIndex=\{0\}/,
  );

  const mobileRules = css.slice(css.indexOf("@media (max-width: 720px)"));
  assert.match(css, /\.table-scroll-hint\s*\{[^}]*display:\s*none/s);
  assert.match(
    mobileRules,
    /\.mobile-table-panel \.table-scroll-hint\s*\{[^}]*display:\s*flex/s,
  );
  assert.match(
    mobileRules,
    /\.mobile-table-panel\s*\{[^}]*overflow:\s*hidden[^}]*\}[^]*\.mobile-table-panel \.table-scroll\s*\{[^}]*width:\s*calc\(100% \+ 2rem\)[^}]*margin-inline:\s*-1rem/s,
  );
  assert.match(
    mobileRules,
    /\.mobile-table-panel \.table-scroll:focus-visible\s*\{[^}]*box-shadow:\s*inset 0 0 0 3px var\(--hardwood\)/s,
  );
});
