import { describe, expect, it } from "vitest";
import { FRANCHISE_TEAMS, makeRoster, salaryFromOverall } from "./seedData.js";

describe("seeded contract salaries", () => {
  const salaryCap = 140_000_000;

  it("maps overall to a rising salary curve with a $1M floor", () => {
    expect(salaryFromOverall(55)).toBe(1_000_000);
    expect(salaryFromOverall(70)).toBeGreaterThan(salaryFromOverall(55));
    expect(salaryFromOverall(84)).toBeGreaterThan(salaryFromOverall(70));
    expect(salaryFromOverall(84)).toBeLessThan(40_000_000);
  });

  it("keeps every seeded 15-man roster within the league salary cap", () => {
    const payrolls = FRANCHISE_TEAMS.map((def, teamIndex) => {
      const roster = makeRoster(teamIndex, def.strength);
      expect(roster).toHaveLength(15);
      const payroll = roster.reduce((sum, player) => sum + player.salary, 0);
      return { name: def.name, payroll };
    });

    for (const { name, payroll } of payrolls) {
      expect(payroll, `${name} payroll ${payroll}`).toBeLessThanOrEqual(salaryCap);
      expect(payroll, `${name} payroll ${payroll}`).toBeGreaterThan(0);
    }

    const maxPayroll = Math.max(...payrolls.map((p) => p.payroll));
    const minPayroll = Math.min(...payrolls.map((p) => p.payroll));
    // Contenders should sit near the cap; tanks should leave meaningful space.
    expect(maxPayroll).toBeGreaterThan(100_000_000);
    expect(salaryCap - minPayroll).toBeGreaterThan(50_000_000);
  });
});
