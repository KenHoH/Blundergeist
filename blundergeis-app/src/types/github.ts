// src/types/github.ts
// LOCKED CONTRACT: M1 (GitHub ingestion) -> M2 (Truth Layer scoring)
// Imports nothing. Do not modify without cross-role coordination.

/** CI roll-up for a single commit SHA. "unknown" = no check-runs reported. */
export type CommitCiStatus = "success" | "failure" | "pending" | "unknown";

/** Final head-commit CI, used only to pick the chess game ending. */
export type PrOutcomeSignal = "passing" | "failing" | "unresolved";

/** How a move was formed, so M2/M3 can label the grouping honestly. */
export type MoveSplitReason =
  | "one-commit" // 3-12 commit PRs: 1 commit = 1 move
  | "grouped-commits" // >12 commits: adjacent commits bundled
  | "split-by-file" // 1-2 commit PRs: each file is a move
  | "split-by-hunk"; // single commit + single file: each hunk is a move

export type FileChangeStatus = "added" | "modified" | "removed" | "renamed";

/** One changed file within a commit. Metadata always survives diff trimming. */
export interface NormalizedFile {
  path: string;
  previousPath: string | null; // set when status === "renamed"
  status: FileChangeStatus;
  additions: number;
  deletions: number;
  /** Trimmed unified-diff hunks for this file. "" when fully omitted by denylist/budget. */
  patch: string;
  /** True when dropped by denylist (lockfile/min/build) or binary. */
  omitted: boolean;
  omittedReason: "denylist" | "binary" | "budget" | null;
}

/** A single real commit. CI and hindsight are commit-level facts. */
export interface NormalizedCommit {
  sha: string;
  message: string;
  authorLogin: string | null;
  authoredAt: string; // ISO 8601
  ciStatus: CommitCiStatus;
  files: NormalizedFile[];
  additions: number; // commit totals (pre-trim, true numbers)
  deletions: number;
  // Hindsight (message scan + same-file overlap)
  wasRevertedLater: boolean;
  fixedByLaterCommit: string | null; // SHA of the later fixing commit
}

/** One board move. The LLM emits exactly one label per move. */
export interface NormalizedMove {
  index: number; // 0-based, sequential
  splitReason: MoveSplitReason;
  /** Raw commits bundled into this move (always >= 1). */
  commits: NormalizedCommit[];
  /** Combined, trimmed diff across this move's commits, capped at 6000 chars. */
  combinedDiff: string;
  /** True if any bundled commit failed CI. */
  anyCommitFailedCi: boolean;
  /** True if any bundled commit was reverted/fixed later. */
  anyCommitRevertedLater: boolean;
  // Trimming transparency
  filesOmitted: number; // count dropped by denylist/binary/budget
  linesTruncated: number; // diff lines cut to meet the 6000-char cap
}

/** Review comments, fetched once at PR level (not per commit). */
export interface NormalizedReviewComment {
  author: string | null;
  body: string;
  path: string | null; // file the comment is anchored to, if any
  createdAt: string; // ISO 8601
}

/** The locked M1 -> M2 contract. One object per PR. */
export interface NormalizedPR {
  // Identity
  owner: string;
  repo: string; // bare repo name, e.g. "next.js"
  prNumber: number;
  title: string;
  headSha: string;
  prState: "open" | "closed" | "merged";

  // Ending signal (head CI only)
  outcomeSignal: PrOutcomeSignal;

  // Core payload
  moves: NormalizedMove[]; // 3-10 entries after grouping rules
  reviewComments: NormalizedReviewComment[];

  // Raw counts for scope-creep heuristics (pre-grouping, pre-trim)
  totalCommits: number; // real commits after noise filter
  rawCommitCount: number; // before noise filter
  totalFilesChanged: number;
  totalAdditions: number;
  totalDeletions: number;
}
