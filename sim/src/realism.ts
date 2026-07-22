import type { GameResult, PlayerGameLine, TeamGameLine } from "@basketball-sim/shared";

function assertPlayerLine(line: PlayerGameLine, label: string): void {
  if (line.minutes < 0) throw new Error(`${label}: negative minutes`);
  if (line.fgm > line.fga) throw new Error(`${label}: fgm > fga`);
  if (line.tpm > line.tpa) throw new Error(`${label}: tpm > tpa`);
  if (line.ftm > line.fta) throw new Error(`${label}: ftm > fta`);
  if (line.tpm > line.fgm) throw new Error(`${label}: tpm > fgm`);
  const ptsFromShooting = (line.fgm - line.tpm) * 2 + line.tpm * 3 + line.ftm;
  if (line.pts !== ptsFromShooting) {
    throw new Error(`${label}: pts ${line.pts} != shooting breakdown ${ptsFromShooting}`);
  }
}

function assertTeamLine(line: TeamGameLine, label: string): void {
  for (const player of line.players) {
    assertPlayerLine(player, `${label}/${player.playerName}`);
  }

  const sum = (key: keyof PlayerGameLine) =>
    line.players.reduce((acc, p) => acc + (typeof p[key] === "number" ? (p[key] as number) : 0), 0);

  const checks: (keyof PlayerGameLine)[] = [
    "pts",
    "reb",
    "ast",
    "stl",
    "blk",
    "tov",
    "fgm",
    "fga",
    "tpm",
    "tpa",
    "ftm",
    "fta",
  ];

  for (const key of checks) {
    const total = sum(key);
    const teamVal = line[key as keyof TeamGameLine];
    if (typeof teamVal === "number" && teamVal !== total) {
      throw new Error(`${label}: team ${key} ${teamVal} != player sum ${total}`);
    }
  }

  const minutes = sum("minutes");
  if (minutes < 230 || minutes > 250) {
    throw new Error(`${label}: team minutes ${minutes} outside 230-250`);
  }
}

/** Throws if the box score violates NBA-style realism invariants. */
export function assertRealisticGameResult(result: GameResult): void {
  if (result.home.teamId === result.away.teamId) {
    throw new Error("home and away team ids must differ");
  }
  assertTeamLine(result.home, "home");
  assertTeamLine(result.away, "away");
}
