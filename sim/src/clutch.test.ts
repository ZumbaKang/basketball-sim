import type { Player, PlayerGameLine, TeamGameLine } from "@basketball-sim/shared";
import { describe, expect, it } from "vitest";
import { applyClutchTime, isClutchGame } from "./clutch.js";

function player(id: string, overall: number, rotationOrder: number): Player {
  return {
    id,
    teamId: "team",
    name: id,
    position: "SG",
    age: 26,
    potential: overall,
    ratings: {
      overall,
      offense: overall,
      defense: overall,
      shooting: overall,
      rebounding: overall,
      playmaking: overall,
      stamina: overall,
    },
    rotationOrder,
    targetMinutes: 24,
    injuredDays: 0,
    isFreeAgent: false,
  };
}

function line(
  playerId: string,
  minutes: number,
  fgm: number,
  fga: number,
  tpm: number,
  tpa: number,
): PlayerGameLine {
  return {
    playerId,
    playerName: playerId,
    teamId: "team",
    minutes,
    pts: (fgm - tpm) * 2 + tpm * 3,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    fgm,
    fga,
    tpm,
    tpa,
    ftm: 0,
    fta: 0,
  };
}

function teamLine(players: PlayerGameLine[], pts?: number): TeamGameLine {
  const sum = (key: keyof PlayerGameLine) =>
    players.reduce((total, current) => total + (typeof current[key] === "number" ? (current[key] as number) : 0), 0);

  return {
    teamId: "team",
    teamName: "Test Team",
    pts: pts ?? sum("pts"),
    reb: sum("reb"),
    ast: sum("ast"),
    stl: sum("stl"),
    blk: sum("blk"),
    tov: sum("tov"),
    fgm: sum("fgm"),
    fga: sum("fga"),
    tpm: sum("tpm"),
    tpa: sum("tpa"),
    ftm: sum("ftm"),
    fta: sum("fta"),
    players,
  };
}

describe("clutch time", () => {
  it("uses the NBA close-game margin", () => {
    const home = teamLine([], 105);

    expect(isClutchGame(home, { ...home, teamId: "away", pts: 100 })).toBe(true);
    expect(isClutchGame(home, { ...home, teamId: "away", pts: 99 })).toBe(false);
  });

  it("shifts closing minutes and usage to the top two players", () => {
    const roster = [
      player("star_one", 94, 0),
      player("star_two", 90, 1),
      player("bench_one", 75, 7),
      player("bench_two", 70, 9),
    ];
    const original = teamLine([
      line("star_one", 36, 10, 20, 3, 8),
      line("star_two", 34, 8, 16, 2, 6),
      line("bench_one", 22, 3, 8, 1, 4),
      line("bench_two", 18, 2, 6, 1, 3),
    ]);
    const originalMinutes = original.players.reduce((total, current) => total + current.minutes, 0);

    const adjusted = applyClutchTime(original, roster);
    const byId = new Map(adjusted.players.map((current) => [current.playerId, current]));

    expect(byId.get("star_one")).toMatchObject({ minutes: 37.5, fga: 21 });
    expect(byId.get("star_two")).toMatchObject({ minutes: 35.5, fga: 17 });
    expect(byId.get("bench_two")).toMatchObject({ minutes: 15, fga: 4, tpa: 1 });
    expect(adjusted.players.reduce((total, current) => total + current.minutes, 0)).toBe(originalMinutes);
    expect(adjusted.fga).toBe(original.fga);
    expect(adjusted.pts).toBe(original.pts);
    expect(original.players.find((current) => current.playerId === "star_one")).toMatchObject({
      minutes: 36,
      fga: 20,
    });
  });
});
