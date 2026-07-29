import { describe, expect, it } from "vitest";
import {
  FTA_BUFFER,
  MAX_FTA_PER_FGA,
  maxCredibleFreeThrowAttempts,
  maxCredibleFta,
  maxFtaFromFoulsDrawn,
} from "../src/freeThrows.js";

describe("free-throw credibility caps", () => {
  it("caps FTA at FGA ratio plus and-one buffer", () => {
    expect(MAX_FTA_PER_FGA).toBe(1);
    expect(FTA_BUFFER).toBe(2);
    expect(maxCredibleFta(0)).toBe(2);
    expect(maxCredibleFta(3)).toBe(5);
    expect(maxCredibleFta(5)).toBe(7);
    expect(maxCredibleFta(7)).toBe(9);
  });

  it("bounds fouls-drawn FTA by minutes and offense", () => {
    expect(maxFtaFromFoulsDrawn(8, 70)).toBeLessThanOrEqual(6);
    expect(maxFtaFromFoulsDrawn(36, 90)).toBeGreaterThan(10);
    expect(maxFtaFromFoulsDrawn(36, 90)).toBeLessThanOrEqual(26);
  });

  it("combines shot-attempt and fouls-drawn ceilings", () => {
    // Low-FGA reserve: FGA ceiling wins over generous minutes.
    expect(maxCredibleFreeThrowAttempts(3, 30, 95)).toBe(maxCredibleFta(3));
    // High-FGA short stint: fouls-drawn ceiling wins.
    expect(maxCredibleFreeThrowAttempts(20, 6, 60)).toBe(
      maxFtaFromFoulsDrawn(6, 60),
    );
  });
});
