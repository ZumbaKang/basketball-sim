import type { Contract, Player } from "@basketball-sim/shared";

export type TradeSideSummary = {
  assetName: string;
  detail: string;
  salary: number;
};

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

/** Positive means the user's payroll goes up if the trade is accepted. */
export function payrollDelta(outgoing: TradeSideSummary, incoming: TradeSideSummary): number {
  return incoming.salary - outgoing.salary;
}

export function formatPayrollDelta(delta: number): string {
  if (delta === 0) return "Payroll unchanged";
  const direction = delta > 0 ? "+" : "−";
  return `Payroll ${direction}$${(Math.abs(delta) / 1_000_000).toFixed(1)}M`;
}
