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

test("standings and history tables are focusable edge-to-edge mobile regions", () => {
  assert.match(standingsPage, /className="panel mobile-table-panel"/);
  assert.match(
    standingsPage,
    /className="table-scroll" role="region" aria-label=\{`\$\{title\} standings`\} tabIndex=\{0\}/,
  );
  assert.match(historyPage, /className="panel mobile-table-panel"/);
  assert.match(
    historyPage,
    /className="table-scroll" role="region" aria-label="Scoring leaders" tabIndex=\{0\}/,
  );

  const mobileRules = css.slice(css.indexOf("@media (max-width: 720px)"));
  assert.match(
    mobileRules,
    /\.mobile-table-panel\s*\{[^}]*overflow:\s*hidden[^}]*\}[^]*\.mobile-table-panel \.table-scroll\s*\{[^}]*width:\s*calc\(100% \+ 2rem\)[^}]*margin-inline:\s*-1rem/s,
  );
  assert.match(
    mobileRules,
    /\.mobile-table-panel \.table-scroll:focus-visible\s*\{[^}]*box-shadow:\s*inset 0 0 0 3px var\(--hardwood\)/s,
  );
});
