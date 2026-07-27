import assert from "node:assert/strict";
import test from "node:test";
import type { Contract, DraftPick, Player, Team } from "@basketball-sim/shared";
import {
  buildProtection,
  buildTradeAsset,
  filterPicksByRound,
  formatPayrollDelta,
  formatPickLabel,
  payrollDelta,
  picksForTeam,
  summarizePickSide,
  summarizeTradeSide,
} from "./trade";

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

const pick: DraftPick = {
  id: "dp1",
  leagueId: "l1",
  seasonYear: 2027,
  round: 1,
  pick: 12,
  originalTeamId: "t1",
  ownerTeamId: "t1",
  playerId: null,
};

const teamsById = new Map<string, Pick<Team, "abbreviation" | "name">>([
  ["t1", { abbreviation: "BOS", name: "Boston" }],
  ["t2", { abbreviation: "NYK", name: "New York" }],
]);

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

test("pick labels include year, original team, and round", () => {
  assert.equal(formatPickLabel(pick, teamsById), "2027 BOS 1st");
  assert.equal(
    formatPickLabel({ ...pick, round: 2, originalTeamId: "t2" }, teamsById),
    "2027 NYK 2nd",
  );
});

test("pick summaries include protection terms and zero salary", () => {
  const unprotected = summarizePickSide(pick, teamsById, { kind: "unprotected" });
  assert.equal(unprotected.assetName, "2027 BOS 1st");
  assert.match(unprotected.detail, /unprotected/);
  assert.equal(unprotected.salary, 0);

  const protectedPick = summarizePickSide(pick, teamsById, {
    kind: "top",
    protectedThrough: 5,
  });
  assert.match(protectedPick.detail, /top-5 protected/);
});

test("buildProtection clamps top-N and defaults invalid values to 1", () => {
  assert.deepEqual(buildProtection("unprotected", 5), { kind: "unprotected" });
  assert.deepEqual(buildProtection("top", 5), { kind: "top", protectedThrough: 5 });
  assert.deepEqual(buildProtection("top", 99), { kind: "top", protectedThrough: 30 });
  assert.deepEqual(buildProtection("top", 0), { kind: "top", protectedThrough: 1 });
});

test("buildTradeAsset serializes mixed player and pick proposals", () => {
  assert.deepEqual(
    buildTradeAsset({
      kind: "player",
      playerId: "p1",
      draftPickId: "",
      protection: { kind: "unprotected" },
    }),
    { playerId: "p1" },
  );
  assert.deepEqual(
    buildTradeAsset({
      kind: "pick",
      playerId: "",
      draftPickId: "dp1",
      protection: { kind: "top", protectedThrough: 3 },
    }),
    {
      draftPickId: "dp1",
      draftPickProtection: { kind: "top", protectedThrough: 3 },
    },
  );
  assert.equal(
    buildTradeAsset({
      kind: "pick",
      playerId: "p1",
      draftPickId: "",
      protection: { kind: "unprotected" },
    }),
    null,
  );
});

test("round filters and team ownership narrow the pick list", () => {
  const picks: DraftPick[] = [
    pick,
    { ...pick, id: "dp2", round: 2, pick: 42, ownerTeamId: "t1" },
    { ...pick, id: "dp3", round: 1, pick: 8, ownerTeamId: "t2" },
  ];
  assert.equal(picksForTeam(picks, "t1").length, 2);
  assert.equal(filterPicksByRound(picks, 1).length, 2);
  assert.equal(filterPicksByRound(picksForTeam(picks, "t1"), 2).length, 1);
});
