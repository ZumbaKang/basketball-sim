import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const leaguePage = readFileSync(new URL("../app/(shell)/league/page.tsx", import.meta.url), "utf8");
const frontOfficePage = readFileSync(new URL("../app/(shell)/front-office/page.tsx", import.meta.url), "utf8");

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
