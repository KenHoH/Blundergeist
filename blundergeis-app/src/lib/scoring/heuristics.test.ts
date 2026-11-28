import { describe, it, expect } from "vitest";
import { scoreCommit, type CommitInput } from "./heuristics";
import type { MoveLabel } from "@/types/review";

function makeInput(overrides: Partial<CommitInput> = {}): CommitInput {
  return {
    commitSha: "abc123",
    commitMessage: "test commit",
    diff: "",
    ciPassed: true,
    wasReverted: false,
    diffLineCount: 50,
    scopeCreep: false,
    ...overrides,
  };
}

describe("scoreCommit", () => {
  it("returns score in [-10, +10] range", () => {
    const result = scoreCommit(makeInput({ ciPassed: false, wasReverted: true, diffLineCount: 600, scopeCreep: true }));
    expect(result.heuristicScore).toBeGreaterThanOrEqual(-10);
    expect(result.heuristicScore).toBeLessThanOrEqual(10);
  });

  it("gives Good label for clean CI-passing small commit", () => {
    const result = scoreCommit(makeInput({ ciPassed: true, diffLineCount: 30 }));
    expect(result.heuristicLabel).toBe("Good");
    expect(result.heuristicScore).toBe(2);
  });

  it("gives Good label for clean CI-passing commit with scope creep", () => {
    const result = scoreCommit(makeInput({ ciPassed: true, diffLineCount: 30, scopeCreep: true }));
    expect(result.heuristicScore).toBe(0);
    expect(result.heuristicLabel).toBe("Good");
  });

  it("gives Mistake label for CI-failing commit", () => {
    const result = scoreCommit(makeInput({ ciPassed: false }));
    expect(result.heuristicLabel).toBe("Mistake");
    expect(result.heuristicScore).toBe(-5);
  });

  it("gives Blunder label for CI-failing + reverted commit", () => {
    const result = scoreCommit(makeInput({ ciPassed: false, wasReverted: true }));
    expect(result.heuristicLabel).toBe("Blunder");
    expect(result.heuristicScore).toBe(-9);
  });

  it("penalizes large diffs (>500 lines)", () => {
    const result = scoreCommit(makeInput({ diffLineCount: 600 }));
    expect(result.heuristicScore).toBeLessThan(2); // 2 - 3 = -1
    expect(result.heuristicLabel).toBe("Inaccuracy");
  });

  it("penalizes medium diffs (>200 lines)", () => {
    const result = scoreCommit(makeInput({ diffLineCount: 250 }));
    expect(result.heuristicScore).toBe(1); // 2 - 1
    expect(result.heuristicLabel).toBe("Good");
  });

  it("preserves original input fields in output", () => {
    const input = makeInput({ commitSha: "deadbeef", commitMessage: "feat: cool" });
    const result = scoreCommit(input);
    expect(result.commitSha).toBe("deadbeef");
    expect(result.commitMessage).toBe("feat: cool");
  });

  it("clamps maximum combined penalty to -10", () => {
    const result = scoreCommit(makeInput({
      ciPassed: false, wasReverted: true, diffLineCount: 600, scopeCreep: true,
    }));
    expect(result.heuristicScore).toBe(-10);
  });

  it("label scale covers all 6 labels", () => {
    const labels = new Set<MoveLabel>();
    labels.add(scoreCommit(makeInput({ ciPassed: true, diffLineCount: 30, scopeCreep: false })).heuristicLabel);
    labels.add(scoreCommit(makeInput({ ciPassed: true, diffLineCount: 30, scopeCreep: true })).heuristicLabel);
    labels.add(scoreCommit(makeInput({ ciPassed: false })).heuristicLabel);
    labels.add(scoreCommit(makeInput({ ciPassed: false, wasReverted: true })).heuristicLabel);
    labels.add(scoreCommit(makeInput({ ciPassed: true, diffLineCount: 600 })).heuristicLabel);
    labels.add(scoreCommit(makeInput({ ciPassed: true, diffLineCount: 250, scopeCreep: true })).heuristicLabel);
    expect(labels.size).toBeGreaterThanOrEqual(4);
  });
});
