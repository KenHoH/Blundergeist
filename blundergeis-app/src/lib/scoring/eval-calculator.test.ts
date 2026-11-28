import { describe, it, expect } from "vitest";
import { calculateEval } from "./eval-calculator";
import type { MoveLabel } from "@/types/review";

function makeJudgeResult(label: MoveLabel, evalScore: number, index: number) {
  const needsBestMove = ["Inaccuracy", "Mistake", "Blunder"].includes(label);
  return {
    label,
    evalScore,
    reason: "test",
    bestMove: needsBestMove ? "fix it" : undefined,
    codeSnippet: undefined,
    commitSha: `sha${index}`,
    index,
  };
}

describe("calculateEval", () => {
  it("returns empty result for empty input", () => {
    const result = calculateEval([]);
    expect(result.moves).toEqual([]);
    expect(result.accuracyScore).toBe(0);
  });

  it("accuracyScore is 0-100 integer", () => {
    const result = calculateEval([
      makeJudgeResult("Brilliant", 9, 0),
      makeJudgeResult("Blunder", -9, 1),
    ]);
    expect(result.accuracyScore).toBeGreaterThanOrEqual(0);
    expect(result.accuracyScore).toBeLessThanOrEqual(100);
    expect(Number.isInteger(result.accuracyScore)).toBe(true);
  });

  it("all Brilliant moves → accuracyScore 100", () => {
    const result = calculateEval([
      makeJudgeResult("Brilliant", 8, 0),
      makeJudgeResult("Brilliant", 9, 1),
      makeJudgeResult("Brilliant", 10, 2),
    ]);
    expect(result.accuracyScore).toBe(100);
  });

  it("all Blunder moves → accuracyScore 0", () => {
    const result = calculateEval([
      makeJudgeResult("Blunder", -9, 0),
      makeJudgeResult("Blunder", -10, 1),
    ]);
    expect(result.accuracyScore).toBe(0);
  });

  it("preserves index and commitSha from input", () => {
    const result = calculateEval([
      makeJudgeResult("Good", 1, 0),
      makeJudgeResult("Best", 4, 1),
      makeJudgeResult("Mistake", -6, 2),
    ]);
    expect(result.moves[0].index).toBe(0);
    expect(result.moves[0].commitSha).toBe("sha0");
    expect(result.moves[1].index).toBe(1);
    expect(result.moves[1].commitSha).toBe("sha1");
    expect(result.moves[2].index).toBe(2);
    expect(result.moves[2].commitSha).toBe("sha2");
  });

  it("mixed labels give intermediate accuracy", () => {
    const result = calculateEval([
      makeJudgeResult("Brilliant", 8, 0),   // 100
      makeJudgeResult("Good", 1, 1),         // 70
    ]);
    // mean = (100 + 70) / 2 = 85
    expect(result.accuracyScore).toBe(85);
  });
});
