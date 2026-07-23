import type { Player, Team } from "@basketball-sim/shared";
import type { SimulateGameInput } from "@basketball-sim/sim";

const positions = ["PG", "SG", "SF", "PF", "C", "PG", "SG", "SF", "PF", "C"] as const;

function roster(teamId: string, prefix: string, overallOffset: number): Player[] {
  return positions.map((position, index) => {
    const overall = 70 + ((index * 3 + overallOffset) % 13);

    return {
      id: `${teamId}_player_${index + 1}`,
      teamId,
      name: `${prefix} Player ${index + 1}`,
      position,
      age: 23 + (index % 8),
      potential: Math.min(90, overall + 5),
      ratings: {
        overall,
        offense: overall + (index % 3),
        defense: overall - 3 + (index % 2),
        shooting: overall - 2 + (index % 4),
        rebounding: overall - 7 + (position === "C" || position === "PF" ? 7 : 0),
        playmaking: overall - 5 + (position === "PG" ? 6 : 0),
        stamina: 72 + (index % 5) * 4,
      },
      rotationOrder: index,
      targetMinutes: index < 5 ? 34 - index : 17 - (index - 5),
      injuredDays: 0,
      isFreeAgent: false,
    };
  });
}

const homeTeam: Team = {
  id: "fixture_home",
  leagueId: "fixture_league",
  name: "Harbor Hawks",
  abbreviation: "HHK",
  conference: "East",
  division: "Atlantic",
  wins: 0,
  losses: 0,
  gmDirection: "window",
};

const awayTeam: Team = {
  id: "fixture_away",
  leagueId: "fixture_league",
  name: "Metro Foxes",
  abbreviation: "MFX",
  conference: "West",
  division: "Pacific",
  wins: 0,
  losses: 0,
  gmDirection: "rebuild",
};

export const deterministicGameFixture: SimulateGameInput = {
  leagueId: "fixture_league",
  homeTeam,
  awayTeam,
  homePlayers: roster(homeTeam.id, "Harbor", 1),
  awayPlayers: roster(awayTeam.id, "Metro", 5),
  seed: 20260723,
};
