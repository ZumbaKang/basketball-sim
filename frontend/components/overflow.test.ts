import assert from "node:assert/strict";
import test from "node:test";
import { isAtInlineEnd, isOverflowing, shouldShowScrollHint } from "./overflow";

test("a table that fits its region is not overflowing", () => {
  assert.ok(!isOverflowing({ scrollLeft: 0, scrollWidth: 600, clientWidth: 600 }));
  assert.ok(!isOverflowing({ scrollLeft: 0, scrollWidth: 601, clientWidth: 600 }));
  assert.ok(isOverflowing({ scrollLeft: 0, scrollWidth: 900, clientWidth: 600 }));
});

test("the far edge is detected even with sub-pixel rounding", () => {
  assert.ok(isAtInlineEnd({ scrollLeft: 300, scrollWidth: 900, clientWidth: 600 }));
  assert.ok(isAtInlineEnd({ scrollLeft: 299, scrollWidth: 900, clientWidth: 600 }));
  assert.ok(!isAtInlineEnd({ scrollLeft: 120, scrollWidth: 900, clientWidth: 600 }));
});

test("the hint appears only when columns are actually offscreen", () => {
  assert.ok(!shouldShowScrollHint({ scrollLeft: 0, scrollWidth: 600, clientWidth: 600 }));
  assert.ok(shouldShowScrollHint({ scrollLeft: 0, scrollWidth: 900, clientWidth: 600 }));
});

test("the hint retires once the reader reaches the right edge", () => {
  assert.ok(shouldShowScrollHint({ scrollLeft: 100, scrollWidth: 900, clientWidth: 600 }));
  assert.ok(!shouldShowScrollHint({ scrollLeft: 300, scrollWidth: 900, clientWidth: 600 }));
});
