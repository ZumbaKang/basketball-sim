import assert from "node:assert/strict";
import test from "node:test";
import { getActiveNavHref, NAV_ITEMS } from "./navigation";

test("navigation exposes every persistent league destination", () => {
  assert.deepEqual(NAV_ITEMS, [
    { href: "/league", label: "Franchise" },
    { href: "/standings", label: "Standings" },
    { href: "/front-office", label: "Front office" },
    { href: "/history", label: "History" },
  ]);
});

test("navigation marks league pages and game pages consistently", () => {
  assert.equal(getActiveNavHref("/league"), "/league");
  assert.equal(getActiveNavHref("/standings"), "/standings");
  assert.equal(getActiveNavHref("/front-office"), "/front-office");
  assert.equal(getActiveNavHref("/history"), "/history");
  assert.equal(getActiveNavHref("/games/game-123"), "/league");
  assert.equal(getActiveNavHref("/"), null);
});
