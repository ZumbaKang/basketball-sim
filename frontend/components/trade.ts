import type {
  Contract,
  DraftPick,
  DraftPickProtection,
  Player,
  Team,
  TradeAsset,
} from "@basketball-sim/shared";

export type TradeSideSummary = {
  assetName: string;
  detail: string;
  salary: number;
};

export type AssetKind = "player" | "pick";

export type ProtectionMode = "unprotected" | "top";

const EMPTY: TradeSideSummary = { assetName: "Nobody selected", detail: "—", salary: 0 };

export function summarizeTradeSide(
  player: Player | undefined,
  contract: Contract | undefined,
): TradeSideSummary {
  if (!player) return EMPTY;

  const salary = contract?.salary ?? 0;
  const years = contract?.yearsRemaining ?? 0;
  const money = salary > 0 ? `$${(salary / 1_000_000).toFixed(1)}M` : "no contract";
  const term = years > 0 ? ` · ${years}y` : "";

  return {
    assetName: player.name,
    detail: `${player.position} · ${player.ratings.overall} ovr · age ${player.age} · ${money}${term}`,
    salary,
  };
}

export function formatPickLabel(
  pick: DraftPick,
  teamsById: Map<string, Pick<Team, "abbreviation" | "name">>,
): string {
  const owner = teamsById.get(pick.originalTeamId);
  const abbr = owner?.abbreviation ?? "ORG";
  const round = pick.round === 1 ? "1st" : pick.round === 2 ? "2nd" : `R${pick.round}`;
  return `${pick.seasonYear} ${abbr} ${round}`;
}

export function summarizePickSide(
  pick: DraftPick | undefined,
  teamsById: Map<string, Pick<Team, "abbreviation" | "name">>,
  protection: DraftPickProtection,
): TradeSideSummary {
  if (!pick) return { assetName: "No pick selected", detail: "—", salary: 0 };

  const label = formatPickLabel(pick, teamsById);
  const protectionLabel =
    protection.kind === "unprotected"
      ? "unprotected"
      : `top-${protection.protectedThrough} protected`;

  return {
    assetName: label,
    detail: `Round ${pick.round} · overall #${pick.pick} · ${protectionLabel}`,
    salary: 0,
  };
}

export function summarizeSelectedAsset(input: {
  kind: AssetKind;
  player?: Player;
  contract?: Contract;
  pick?: DraftPick;
  teamsById: Map<string, Pick<Team, "abbreviation" | "name">>;
  protection: DraftPickProtection;
}): TradeSideSummary {
  if (input.kind === "pick") {
    return summarizePickSide(input.pick, input.teamsById, input.protection);
  }
  return summarizeTradeSide(input.player, input.contract);
}

export function buildProtection(
  mode: ProtectionMode,
  protectedThrough: number,
): DraftPickProtection {
  if (mode === "top") {
    const n = Math.min(30, Math.max(1, Math.trunc(protectedThrough) || 1));
    return { kind: "top", protectedThrough: n };
  }
  return { kind: "unprotected" };
}

/** Serialize one trade-builder side into the shared TradeAsset shape. */
export function buildTradeAsset(input: {
  kind: AssetKind;
  playerId: string;
  draftPickId: string;
  protection: DraftPickProtection;
}): TradeAsset | null {
  if (input.kind === "player") {
    if (!input.playerId) return null;
    return { playerId: input.playerId };
  }
  if (!input.draftPickId) return null;
  return {
    draftPickId: input.draftPickId,
    draftPickProtection: input.protection,
  };
}

export function picksForTeam(picks: DraftPick[], teamId: string): DraftPick[] {
  return picks.filter((p) => p.ownerTeamId === teamId);
}

export function filterPicksByRound(picks: DraftPick[], round: 0 | 1 | 2): DraftPick[] {
  if (round === 0) return picks;
  return picks.filter((p) => p.round === round);
}

/** Positive means the user's payroll goes up if the trade is accepted. */
export function payrollDelta(outgoing: TradeSideSummary, incoming: TradeSideSummary): number {
  return incoming.salary - outgoing.salary;
}

export function formatPayrollDelta(delta: number): string {
  if (delta === 0) return "Payroll unchanged";
  const direction = delta > 0 ? "+" : "−";
  return `Payroll ${direction}$${(Math.abs(delta) / 1_000_000).toFixed(1)}M`;
}
