export function millions(amount: number): string {
  return `$${(amount / 1_000_000).toFixed(1)}M`;
}

export function signed(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

export function record(wins: number, losses: number): string {
  return `${wins}-${losses}`;
}

export function pct(value: number): string {
  return value.toFixed(3).replace(/^0/, "");
}
