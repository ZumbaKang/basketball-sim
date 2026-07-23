import { describe, expect, it } from "vitest";
import { assertRealisticGameResult, simulateGame } from "@basketball-sim/sim";
import { deterministicGameFixture } from "./fixtures/deterministic-game.js";

describe("deterministic game regression", () => {
  it("matches the approved full-game box score fixture", async () => {
    const result = simulateGame(deterministicGameFixture);
    const boxScore = {
      home: result.home,
      away: result.away,
    };

    expect(() => assertRealisticGameResult(result)).not.toThrow();
    await expect(`${JSON.stringify(boxScore, null, 2)}\n`).toMatchFileSnapshot(
      "./fixtures/deterministic-game-box-score.json",
    );
  });
});
