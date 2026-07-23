import type {
  GmDirection,
  Player,
  TradeDecision,
  TradeProposal,
} from "@basketball-sim/shared";

export type EvaluablePlayer = Player & { salary: number; yearsRemaining: number };

function contractProfile(p: EvaluablePlayer, direction: GmDirection) {
  const salaryMillions = p.salary / 1_000_000;
  const estimatedMarketSalary = Math.max(2, (p.ratings.overall - 60) * 1.25);
  const overpay = Math.max(0, salaryMillions - estimatedMarketSalary);
  const yearsRemaining = Math.max(1, Math.round(p.yearsRemaining));
  const futureYears = yearsRemaining - 1;
  const penaltyRate =
    direction === "cheap"
      ? 0.35
      : direction === "rebuild" || direction === "tank"
        ? 0.3
        : direction === "window"
          ? 0.2
          : 0.15;
  const expiringBonusRate =
    direction === "cheap"
      ? 0.25
      : direction === "rebuild" || direction === "tank"
        ? 0.2
        : direction === "window"
          ? 0.15
          : 0.1;

  return {
    adjustment:
      yearsRemaining === 1
        ? overpay * expiringBonusRate
        : -(overpay * futureYears * penaltyRate),
    isBadContract: overpay >= 5 && futureYears > 0,
    isExpiringMoney: overpay >= 5 && yearsRemaining === 1,
  };
}

function playerValue(p: EvaluablePlayer, direction: GmDirection): number {
  const agePenalty = p.age > 30 ? (p.age - 30) * 3 : 0;
  const youthBonus = p.age < 25 ? (25 - p.age) * 2 : 0;
  const pot = (p.potential - p.ratings.overall) * (direction === "rebuild" || direction === "tank" ? 1.4 : 0.6);
  const star = Math.max(0, p.ratings.overall - 80) * 2;
  let value =
    p.ratings.overall +
    pot +
    youthBonus +
    star -
    agePenalty -
    p.salary / 5_000_000 +
    contractProfile(p, direction).adjustment;
  if (direction === "cheap") value -= p.salary / 4_000_000;
  if (direction === "contend") value += Math.max(0, p.ratings.overall - 78) * 1.5;
  return value;
}

function contractReason(
  incoming: EvaluablePlayer[],
  outgoing: EvaluablePlayer[],
  direction: GmDirection,
): string {
  const incomingProfiles = incoming.map((p) => contractProfile(p, direction));
  const outgoingProfiles = outgoing.map((p) => contractProfile(p, direction));
  const addsBadContract = incomingProfiles.some((p) => p.isBadContract);
  const sendsBadContract = outgoingProfiles.some((p) => p.isBadContract);
  const addsExpiringMoney = incomingProfiles.some((p) => p.isExpiringMoney);
  const sendsExpiringMoney = outgoingProfiles.some((p) => p.isExpiringMoney);

  if (addsExpiringMoney && sendsBadContract) {
    return " The deal turns long-term bad salary into expiring money.";
  }
  if (addsBadContract && !sendsBadContract) {
    return " The return adds long-term bad salary.";
  }
  if (addsExpiringMoney && !sendsExpiringMoney) {
    return " Expiring money improves future cap flexibility.";
  }
  if (sendsBadContract && !addsBadContract) {
    return " The deal clears long-term bad salary.";
  }
  return "";
}

export function evaluateTrade(input: {
  proposal: TradeProposal;
  direction: GmDirection;
  ourPlayers: EvaluablePlayer[];
  theirPlayers: EvaluablePlayer[];
}): TradeDecision {
  const giveIds = new Set(input.proposal.toAssets.map((a) => a.playerId).filter(Boolean));
  const getIds = new Set(input.proposal.fromAssets.map((a) => a.playerId).filter(Boolean));

  // Perspective: evaluating team is toTeam (receiving fromAssets, sending toAssets)
  const outgoing = input.ourPlayers.filter((p) => giveIds.has(p.id));
  const incoming = input.theirPlayers.filter((p) => getIds.has(p.id));

  if (!outgoing.length && !incoming.length) {
    return { accepted: false, reason: "No player assets in the proposal.", proposal: input.proposal };
  }

  const outValue = outgoing.reduce((s, p) => s + playerValue(p, input.direction), 0);
  const inValue = incoming.reduce((s, p) => s + playerValue(p, input.direction), 0);
  const margin = inValue - outValue;
  const contractContext = contractReason(incoming, outgoing, input.direction);

  const threshold =
    input.direction === "tank" || input.direction === "rebuild"
      ? -2
      : input.direction === "cheap"
        ? 1
        : input.direction === "contend"
          ? 0
          : -0.5;

  if (margin >= threshold) {
    const namesIn = incoming.map((p) => p.name).join(", ") || "assets";
    const namesOut = outgoing.map((p) => p.name).join(", ") || "assets";
    return {
      accepted: true,
      reason: `Accepted: fits a ${input.direction} approach — value on ${namesIn} outweighs ${namesOut}.${contractContext}`,
      proposal: input.proposal,
    };
  }

  return {
    accepted: false,
    reason: `Rejected: as a ${input.direction} team, the return (${inValue.toFixed(1)}) does not beat what they give up (${outValue.toFixed(1)}).${contractContext}`,
    proposal: input.proposal,
  };
}

export function findTradePackages(input: {
  targetPlayer: EvaluablePlayer;
  ourPlayers: EvaluablePlayer[];
  direction: GmDirection;
}): TradeProposal[] {
  const candidates = [...input.ourPlayers]
    .filter((p) => p.id !== input.targetPlayer.id)
    .sort(
      (a, b) =>
        Math.abs(playerValue(a, input.direction) - playerValue(input.targetPlayer, input.direction)) -
        Math.abs(playerValue(b, input.direction) - playerValue(input.targetPlayer, input.direction)),
    )
    .slice(0, 5);

  return candidates.map((c) => ({
    leagueId: "",
    fromTeamId: "",
    toTeamId: "",
    fromAssets: [{ playerId: input.targetPlayer.id }],
    toAssets: [{ playerId: c.id }],
  }));
}

export function preferFreeAgent(
  player: EvaluablePlayer,
  offers: { teamId: string; salary: number; years: number; direction: GmDirection; wins: number }[],
): string | null {
  if (!offers.length) return null;
  const ranked = offers
    .map((o) => ({
      teamId: o.teamId,
      score:
        o.salary * (0.7 + o.years * 0.05) +
        o.wins * 200_000 +
        (o.direction === "contend" ? 1_000_000 : 0),
    }))
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.teamId ?? null;
}
