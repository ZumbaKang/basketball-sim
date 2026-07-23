import type {
  Player,
  PlayerGameLine,
  TeamGameLine,
} from "@basketball-sim/shared";
import { describe, expect, it } from "vitest";
import {
  applyGarbageTime,
  GARBAGE_TIME_MARGIN_MIN,
  isGarbageTimeGame,
} from "./garbageTime.js";

function player(id: string, rotationOrder: number): Player {
  return {
    id,
    teamId: "team",
    name: id,
    position: "SG",
    age: 26,
    potential: 80,
    ratings: {
      overall: 80 - rotationOrder,
      offense: 80,
      defense: 80,
      shooting: 80,
      rebounding: 80,
      playmaking: 80,
      stamina: 80,
    },
    rotationOrder,
    targetMinutes: rotationOrder < 5 ? 36 : 15,
    injuredDays: 0,
    isFreeAgent: false,
  };
}

function playerLine(playerId: string, minutes: number): PlayerGameLine {
  return {
    playerId,
    playerName: playerId,
    teamId: "team",
    minutes,
    pts: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    fgm: 0,
    fga: 0,
    tpm: 0,
    tpa: 0,
    ftm: 0,
    fta: 0,
  };
}

function teamLine(
  players: PlayerGameLine[],
  teamId = "team",
  pts = 105,
): TeamGameLine {
  return {
    teamId,
    teamName: teamId,
    pts,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    fgm: 0,
    fga: 0,
    tpm: 0,
    tpa: 0,
    ftm: 0,
    fta: 0,
    players,
  };
}

describe("garbage time", () => {
  it("starts at a 15-point final margin", () => {
    const home = teamLine([], "home", 115);

    expect(
      isGarbageTimeGame(
        home,
        teamLine([], "away", 115 - GARBAGE_TIME_MARGIN_MIN),
      ),
    ).toBe(true);
    expect(
      isGarbageTimeGame(
        home,
        teamLine([], "away", 116 - GARBAGE_TIME_MARGIN_MIN),
      ),
    ).toBe(false);
  });

  it("moves two to four minutes from starters to reserves", () => {
    const roster = Array.from({ length: 8 }, (_, index) =>
      player(`player_${index}`, index),
    );
    const baseline = teamLine([
      playerLine("player_0", 36),
      playerLine("player_1", 35),
      playerLine("player_2", 34),
      playerLine("player_3", 33),
      playerLine("player_4", 32),
      playerLine("player_5", 26),
      playerLine("player_6", 24),
      playerLine("player_7", 20),
    ]);
    const baselineMinutes = baseline.players.reduce(
      (total, current) => total + current.minutes,
      0,
    );

    const thresholdBlowout = applyGarbageTime(baseline, roster, 15);
    const largeBlowout = applyGarbageTime(baseline, roster, 35);
    const thresholdById = new Map(
      thresholdBlowout.players.map((current) => [
        current.playerId,
        current.minutes,
      ]),
    );
    const largeById = new Map(
      largeBlowout.players.map((current) => [
        current.playerId,
        current.minutes,
      ]),
    );

    expect(thresholdById.get("player_3")).toBe(32);
    expect(thresholdById.get("player_4")).toBe(31);
    expect(thresholdById.get("player_5")).toBe(27);
    expect(thresholdById.get("player_6")).toBe(25);
    expect(largeById.get("player_3")).toBe(31);
    expect(largeById.get("player_4")).toBe(30);
    expect(largeById.get("player_5")).toBe(28);
    expect(largeById.get("player_6")).toBe(26);
    expect(
      thresholdBlowout.players.reduce(
        (total, current) => total + current.minutes,
        0,
      ),
    ).toBe(baselineMinutes);
    expect(
      largeBlowout.players.reduce(
        (total, current) => total + current.minutes,
        0,
      ),
    ).toBe(baselineMinutes);
    expect(baseline.players.find(({ playerId }) => playerId === "player_3"))
      .toMatchObject({ minutes: 33 });
  });

  it("does not shift a close-game rotation", () => {
    const roster = Array.from({ length: 6 }, (_, index) =>
      player(`player_${index}`, index),
    );
    const baseline = teamLine(
      roster.map((current) => playerLine(current.id, 40)),
    );

    expect(applyGarbageTime(baseline, roster, 14)).toBe(baseline);
  });
});
