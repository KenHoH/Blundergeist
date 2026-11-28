import { describe, it, expect } from "vitest";
import { groupCommits } from "./group-commits";
import type { NormalizedCommit } from "@/types/github";

function makeCommit(
  sha: string,
  files: number = 1,
  ci: "success" | "failure" = "success",
  reverted: boolean = false,
): NormalizedCommit {
  return {
    sha,
    message: `commit ${sha}`,
    authorLogin: "dev",
    authoredAt: "2024-01-01T00:00:00Z",
    ciStatus: ci,
    wasRevertedLater: reverted,
    fixedByLaterCommit: null,
    additions: files * 10,
    deletions: files * 2,
    files: Array.from({ length: files }, (_, i) => ({
      path: `src/file${i}.ts`,
      previousPath: null,
      status: "modified" as const,
      additions: 10,
      deletions: 2,
      patch: `@@ -1,5 +1,5 @@\n-old line ${i}\n+new line ${i}\n`,
      omitted: false,
      omittedReason: null,
    })),
  };
}

describe("groupCommits", () => {
  it("returns empty array for empty input", () => {
    expect(groupCommits([])).toEqual([]);
  });

  it("splits single commit by file when multiple files", () => {
    const moves = groupCommits([makeCommit("aaa", 4)]);
    expect(moves).toHaveLength(4);
    expect(moves.every((m) => m.splitReason === "split-by-file")).toBe(true);
  });

  it("uses one-commit strategy for 3-10 commits", () => {
    const moves = groupCommits(Array.from({ length: 5 }, (_, i) => makeCommit(`c${i}`)));
    expect(moves).toHaveLength(5);
    expect(moves.every((m) => m.splitReason === "one-commit")).toBe(true);
  });

  it("groups >10 commits into ≤10 moves", () => {
    const moves = groupCommits(Array.from({ length: 15 }, (_, i) => makeCommit(`d${i}`)));
    expect(moves.length).toBeLessThanOrEqual(10);
    expect(moves.every((m) => m.splitReason === "grouped-commits")).toBe(true);
  });

  it("50 commits never exceeds 10 moves", () => {
    const moves = groupCommits(Array.from({ length: 50 }, (_, i) => makeCommit(`h${i}`)));
    expect(moves.length).toBeLessThanOrEqual(10);
  });

  it("indices are 0-based sequential", () => {
    const moves = groupCommits(Array.from({ length: 7 }, (_, i) => makeCommit(`e${i}`)));
    moves.forEach((m, i) => expect(m.index).toBe(i));
  });

  it("CI failure propagates to anyCommitFailedCi", () => {
    const commits = [
      makeCommit("f0", 1, "success"),
      makeCommit("f1", 1, "failure"),
      makeCommit("f2", 1, "success"),
    ];
    const moves = groupCommits(commits);
    expect(moves[1].anyCommitFailedCi).toBe(true);
    expect(moves[0].anyCommitFailedCi).toBe(false);
  });

  it("revert flag propagates to anyCommitRevertedLater", () => {
    const commits = [
      makeCommit("r0", 1, "success", false),
      makeCommit("r1", 1, "success", true),
    ];
    const moves = groupCommits(commits);
    expect(moves[1].anyCommitRevertedLater).toBe(true);
    expect(moves[0].anyCommitRevertedLater).toBe(false);
  });

  it("combinedDiff is capped at 6000 chars", () => {
    const bigPatch = "x".repeat(8000);
    const bigCommit: NormalizedCommit = {
      ...makeCommit("g0", 1),
      files: [
        {
          path: "big.ts",
          previousPath: null,
          status: "modified",
          additions: 100,
          deletions: 0,
          patch: bigPatch,
          omitted: false,
          omittedReason: null,
        },
      ],
    };
    const moves = groupCommits([bigCommit]);
    moves.forEach((m) => expect(m.combinedDiff.length).toBeLessThanOrEqual(6000));
  });

  it("all commits are accounted for after grouping", () => {
    const commits = Array.from({ length: 12 }, (_, i) => makeCommit(`i${i}`));
    const moves = groupCommits(commits);
    const totalCommits = moves.reduce((s, m) => s + m.commits.length, 0);
    expect(totalCommits).toBe(12);
  });

  it("two-commit PR splits by file", () => {
    const moves = groupCommits([makeCommit("a", 2), makeCommit("b", 2)]);
    expect(moves.length).toBeGreaterThanOrEqual(3);
    expect(moves.every((m) => m.splitReason === "split-by-file")).toBe(true);
  });

  it("grouped moves bundle correct number of commits", () => {
    const commits = Array.from({ length: 20 }, (_, i) => makeCommit(`g${i}`));
    const moves = groupCommits(commits);
    const totalCommits = moves.reduce((s, m) => s + m.commits.length, 0);
    expect(totalCommits).toBe(20);
    expect(moves.length).toBeLessThanOrEqual(10);
  });
});
