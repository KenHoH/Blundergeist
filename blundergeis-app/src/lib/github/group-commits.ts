import type {
  NormalizedCommit,
  NormalizedMove,
  MoveSplitReason,
} from "@/types/github";

// ---------------------------------------------------------------------------
// Commit grouping
// Converts a flat list of NormalizedCommits into 3–10 NormalizedMoves.
//
// Rules (in priority order):
//   1–2  commits  → split by file (each file = one move)
//   1    commit   → split by hunk if the file count is 1
//   3–10 commits  → one commit per move (no grouping needed)
//   >10  commits  → group adjacent commits into buckets of ~equal size
//
// The combined diff per move is capped at 6000 chars.
// ---------------------------------------------------------------------------

const MIN_MOVES = 3;
const MAX_MOVES = 10;
const COMBINED_DIFF_CAP = 6000;

/**
 * Groups a flat list of commits into 3–10 NormalizedMoves.
 * Handles 1-commit, 2-commit, and many-commit PRs.
 */
export function groupCommits(commits: NormalizedCommit[]): NormalizedMove[] {
  if (commits.length === 0) return [];

  if (commits.length === 1) {
    return splitSingleCommit(commits[0]);
  }

  if (commits.length === 2) {
    return splitTwoCommits(commits);
  }

  if (commits.length <= MAX_MOVES) {
    // One commit per move — perfect fit
    return commits.map((c, i) => commitToMove(c, i, "one-commit"));
  }

  // More than MAX_MOVES: group into MAX_MOVES buckets
  return groupIntoMaxMoves(commits);
}

// ---------------------------------------------------------------------------
// Strategy: single commit → split by file, or by hunk if one file
// ---------------------------------------------------------------------------

function splitSingleCommit(commit: NormalizedCommit): NormalizedMove[] {
  const files = commit.files.filter((f) => !f.omitted || f.omittedReason === "budget");

  if (files.length <= 1) {
    // Split by hunk
    const hunks = extractHunks(commit.files[0]?.patch ?? "");
    if (hunks.length <= 1) {
      // Can't split further — wrap as a single move
      return [commitToMove(commit, 0, "split-by-hunk")];
    }

    // Cap hunks to MAX_MOVES
    const sliced = hunks.slice(0, MAX_MOVES);
    return sliced.map((hunk, i): NormalizedMove => ({
      index: i,
      splitReason: "split-by-hunk",
      commits: [commit],
      combinedDiff: hunk.slice(0, COMBINED_DIFF_CAP),
      anyCommitFailedCi: commit.ciStatus === "failure",
      anyCommitRevertedLater: commit.wasRevertedLater,
      filesOmitted: commit.files.filter((f) => f.omitted).length,
      linesTruncated: 0,
    }));
  }

  // Split by file — cap to MAX_MOVES
  const sliced = files.slice(0, MAX_MOVES);
  return sliced.map((file, i): NormalizedMove => ({
    index: i,
    splitReason: "split-by-file",
    commits: [commit],
    combinedDiff: file.patch.slice(0, COMBINED_DIFF_CAP),
    anyCommitFailedCi: commit.ciStatus === "failure",
    anyCommitRevertedLater: commit.wasRevertedLater,
    filesOmitted: commit.files.filter((f) => f.omitted).length,
    linesTruncated: file.patch.length > COMBINED_DIFF_CAP ? file.patch.length - COMBINED_DIFF_CAP : 0,
  }));
}

// ---------------------------------------------------------------------------
// Strategy: two commits → split each by file or use as-is
// ---------------------------------------------------------------------------

function splitTwoCommits(commits: NormalizedCommit[]): NormalizedMove[] {
  // Flatten: treat each commit's non-omitted files as potential moves
  const moves: NormalizedMove[] = [];

  for (const commit of commits) {
    const files = commit.files.filter((f) => !f.omitted);
    if (files.length === 0) {
      // No real files — emit the commit as a move
      moves.push(commitToMove(commit, moves.length, "one-commit"));
    } else {
      for (const file of files) {
        if (moves.length >= MAX_MOVES) break;
        moves.push({
          index: moves.length,
          splitReason: "split-by-file",
          commits: [commit],
          combinedDiff: file.patch.slice(0, COMBINED_DIFF_CAP),
          anyCommitFailedCi: commit.ciStatus === "failure",
          anyCommitRevertedLater: commit.wasRevertedLater,
          filesOmitted: commit.files.filter((f) => f.omitted).length,
          linesTruncated: file.patch.length > COMBINED_DIFF_CAP ? file.patch.length - COMBINED_DIFF_CAP : 0,
        });
      }
    }
  }

  // Pad to MIN_MOVES if we ended up with fewer
  if (moves.length < MIN_MOVES) {
    // Re-index as single-commit moves to meet minimum
    return commits.flatMap((c, i) => [commitToMove(c, i, "one-commit")]);
  }

  return reindex(moves);
}

// ---------------------------------------------------------------------------
// Strategy: >MAX_MOVES commits → bucket into MAX_MOVES groups
// ---------------------------------------------------------------------------

function groupIntoMaxMoves(commits: NormalizedCommit[]): NormalizedMove[] {
  const bucketSize = Math.ceil(commits.length / MAX_MOVES);
  const moves: NormalizedMove[] = [];

  for (let i = 0; i < MAX_MOVES; i++) {
    const start = i * bucketSize;
    const end = Math.min(start + bucketSize, commits.length);
    if (start >= commits.length) break;

    const bucket = commits.slice(start, end);
    const rawDiff = bucket
      .flatMap((c) => c.files.filter((f) => !f.omitted).map((f) => f.patch))
      .join("\n");

    const truncated = rawDiff.length > COMBINED_DIFF_CAP;
    const combinedDiff = rawDiff.slice(0, COMBINED_DIFF_CAP);
    const linesTruncated = truncated
      ? rawDiff.length - COMBINED_DIFF_CAP
      : 0;

    moves.push({
      index: i,
      splitReason: "grouped-commits",
      commits: bucket,
      combinedDiff,
      anyCommitFailedCi: bucket.some((c) => c.ciStatus === "failure"),
      anyCommitRevertedLater: bucket.some((c) => c.wasRevertedLater),
      filesOmitted: bucket.reduce(
        (sum, c) => sum + c.files.filter((f) => f.omitted).length,
        0
      ),
      linesTruncated,
    });
  }

  return moves;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function commitToMove(
  commit: NormalizedCommit,
  index: number,
  splitReason: MoveSplitReason
): NormalizedMove {
  const rawDiff = commit.files
    .filter((f) => !f.omitted)
    .map((f) => f.patch)
    .join("\n");

  const truncated = rawDiff.length > COMBINED_DIFF_CAP;
  return {
    index,
    splitReason,
    commits: [commit],
    combinedDiff: rawDiff.slice(0, COMBINED_DIFF_CAP),
    anyCommitFailedCi: commit.ciStatus === "failure",
    anyCommitRevertedLater: commit.wasRevertedLater,
    filesOmitted: commit.files.filter((f) => f.omitted).length,
    linesTruncated: truncated ? rawDiff.length - COMBINED_DIFF_CAP : 0,
  };
}

function extractHunks(patch: string): string[] {
  if (!patch) return [];
  // Split on unified diff hunk headers (@@...@@)
  const hunkRe = /^@@[^@]+@@/m;
  const parts = patch.split(/(?=^@@)/m).filter(Boolean);
  return parts.length > 0 ? parts : [patch];
}

function reindex(moves: NormalizedMove[]): NormalizedMove[] {
  return moves.map((m, i) => ({ ...m, index: i }));
}
