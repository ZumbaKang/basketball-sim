import assert from "node:assert/strict";
import test from "node:test";
import type { Contract, Player } from "@basketball-sim/shared";
import { formatPayrollDelta, payrollDelta, summarizeTradeSide } from "./trade";

const player: Player = {
  id: "p1",
  teamId: "t1",
  name: "Marcus Vale",
  position: "SG",
  age: 27,
  potential: 82,
  ratings: {
    overall: 78,
    offense: 80,
    defense: 71,
    shooting: 84,
    rebounding: 45,
    playmaking: 66,
    stamina: 74,
  },
  rotationOrder: 2,
  targetMinutes: 32,
  injuredDays: 0,
  isFreeAgent: false,
};

const contract: Contract = {
  id: "c1",
  playerId: "p1",
  teamId: "t1",
  salary: 18_400_000,
  yearsRemaining: 3,
};

test("a selected asset summarizes position, rating, age, and money", () => {
  const summary = summarizeTradeSide(player, contract);
  assert.equal(summary.assetName, "Marcus Vale");
  assert.equal(summary.detail, "SG · 78 ovr · age 27 · $18.4M · 3y");
  assert.equal(summary.salary, 18_400_000);
});

test("an unsigned player reads as having no contract rather than $0.0M", () => {
  const summary = summarizeTradeSide(player, undefined);
  assert.match(summary.detail, /no contract/);
  assert.ok(!summary.detail.includes("0y"));
  assert.equal(summary.salary, 0);
});

test("an empty side is stated plainly instead of rendering blank", () => {
  const summary = summarizeTradeSide(undefined, undefined);
  assert.equal(summary.assetName, "Nobody selected");
  assert.equal(summary.salary, 0);
});

test("payroll delta is positive when the incoming contract is larger", () => {
  const out = summarizeTradeSide(player, contract);
  const incoming = summarizeTradeSide(player, { ...contract, id: "c2", salary: 25_000_000 });
  assert.equal(payrollDelta(out, incoming), 6_600_000);
  assert.equal(formatPayrollDelta(payrollDelta(out, incoming)), "Payroll +$6.6M");
});

test("payroll delta is negative when salary is shed, and flat when it matches", () => {
  const out = summarizeTradeSide(player, contract);
  const cheaper = summarizeTradeSide(player, { ...contract, id: "c3", salary: 8_400_000 });
  assert.equal(formatPayrollDelta(payrollDelta(out, cheaper)), "Payroll −$10.0M");
  assert.equal(formatPayrollDelta(payrollDelta(out, out)), "Payroll unchanged");
});
