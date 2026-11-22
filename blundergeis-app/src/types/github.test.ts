// src/types/github.test.ts
// Compile-time type-check for the NormalizedPR contract.
// Builds a fully-populated sample object exercising every field and union
// variant. This file has no runtime assertions; `tsc --noEmit` is the test:
// if it compiles, the contract holds.

import type {
  CommitCiStatus,
  PrOutcomeSignal,
  MoveSplitReason,
  FileChangeStatus,
  NormalizedFile,
  NormalizedCommit,
  NormalizedMove,
  NormalizedReviewComment,
  NormalizedPR,
} from "./github";

// --- Union-type coverage: every member of each string-literal union ---

const ciStatuses: CommitCiStatus[] = [
  "success",
  "failure",
  "pending",
  "unknown",
];

const outcomeSignals: PrOutcomeSignal[] = [
  "passing",
  "failing",
  "unresolved",
];

const splitReasons: MoveSplitReason[] = [
  "one-commit",
  "grouped-commits",
  "split-by-file",
  "split-by-hunk",
];

const fileStatuses: FileChangeStatus[] = [
  "added",
  "modified",
  "removed",
  "renamed",
];

// --- Leaf objects ---

const renamedFile: NormalizedFile = {
  path: "src/lib/scoring/eval-calculator.ts",
  previousPath: "src/lib/scoring/calculator.ts",
  status: "renamed",
  additions: 12,
  deletions: 4,
  patch: "@@ -1,4 +1,12 @@\n+export const clamp = (n: number) => n;",
  omitted: false,
  omittedReason: null,
};

const omittedFile: NormalizedFile = {
  path: "pnpm-lock.yaml",
  previousPath: null,
  status: "modified",
  additions: 0,
  deletions: 0,
  patch: "",
  omitted: true,
  omittedReason: "denylist",
};

// --- Commits ---

const firstCommit: NormalizedCommit = {
  sha: "a1b2c3d4e5f60718293a4b5c6d7e8f9001122334",
  message: "feat: add eval calculator",
  authorLogin: "octocat",
  authoredAt: "2024-01-15T09:30:00Z",
  ciStatus: "success",
  files: [renamedFile, omittedFile],
  additions: 12,
  deletions: 4,
  wasRevertedLater: false,
  fixedByLaterCommit: "ff00aa11bb22cc33dd44ee55ff6677889900aabb",
};

const secondCommit: NormalizedCommit = {
  sha: "ff00aa11bb22cc33dd44ee55ff6677889900aabb",
  message: "fix: correct clamp boundary",
  authorLogin: null,
  authoredAt: "2024-01-15T11:45:00Z",
  ciStatus: "failure",
  files: [],
  additions: 3,
  deletions: 1,
  wasRevertedLater: true,
  fixedByLaterCommit: null,
};

// --- Moves ---

const firstMove: NormalizedMove = {
  index: 0,
  splitReason: "one-commit",
  commits: [firstCommit],
  combinedDiff: "@@ -1,4 +1,12 @@\n+export const clamp = (n: number) => n;",
  anyCommitFailedCi: false,
  anyCommitRevertedLater: false,
  filesOmitted: 1,
  linesTruncated: 0,
};

const secondMove: NormalizedMove = {
  index: 1,
  splitReason: "grouped-commits",
  commits: [secondCommit],
  combinedDiff: "",
  anyCommitFailedCi: true,
  anyCommitRevertedLater: true,
  filesOmitted: 0,
  linesTruncated: 42,
};

// --- Review comments ---

const reviewComments: NormalizedReviewComment[] = [
  {
    author: "reviewer-1",
    body: "This clamp needs a lower bound.",
    path: "src/lib/scoring/eval-calculator.ts",
    createdAt: "2024-01-15T12:00:00Z",
  },
  {
    author: null,
    body: "LGTM",
    path: null,
    createdAt: "2024-01-15T12:05:00Z",
  },
];

// --- The full contract object ---

const sampleNormalizedPR: NormalizedPR = {
  owner: "vercel",
  repo: "next.js",
  prNumber: 12345,
  title: "Add eval calculator with clamp fix",
  headSha: "ff00aa11bb22cc33dd44ee55ff6677889900aabb",
  prState: "merged",
  outcomeSignal: "failing",
  moves: [firstMove, secondMove],
  reviewComments,
  totalCommits: 2,
  rawCommitCount: 5,
  totalFilesChanged: 2,
  totalAdditions: 15,
  totalDeletions: 5,
};

// Reference everything so the compiler treats each binding as used.
export const __typeCheckFixtures = {
  ciStatuses,
  outcomeSignals,
  splitReasons,
  fileStatuses,
  renamedFile,
  omittedFile,
  firstCommit,
  secondCommit,
  firstMove,
  secondMove,
  reviewComments,
  sampleNormalizedPR,
};
