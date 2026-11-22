import { octokit } from "./client";
import { groupCommits } from "./group-commits";
import { cached } from "@/lib/cache";
import type {
  NormalizedPR,
  NormalizedCommit,
  NormalizedFile,
  NormalizedReviewComment,
  CommitCiStatus,
  PrOutcomeSignal,
  FileChangeStatus,
} from "@/types/github";

// ---------------------------------------------------------------------------
// Diff budget: cap per-file patch to avoid blowing the LLM context window.
// Files on the denylist are dropped entirely (lock files, minified bundles).
// ---------------------------------------------------------------------------

const DIFF_BUDGET_CHARS = 6000;

// Per-commit data is immutable once a commit is merged.
// Cache it for 24 hours to protect the GitHub rate limit (5000 req/hour).
const TTL_COMMIT_DATA  = 24 * 60 * 60; // 24 hours
const TTL_CI_STATUS    = 5 * 60;        // 5 min — CI can still change on open PRs

const DENYLIST_PATTERNS = [
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /\.min\.(js|css)$/,
  /dist\//,
  /build\//,
  /\.next\//,
  /node_modules\//,
];

function isDenylisted(path: string): boolean {
  return DENYLIST_PATTERNS.some((re) => re.test(path));
}

// ---------------------------------------------------------------------------
// CI status helpers
// ---------------------------------------------------------------------------

function mapCiStatus(state: string | undefined): CommitCiStatus {
  switch (state) {
    case "success": return "success";
    case "failure":
    case "error":   return "failure";
    case "pending": return "pending";
    default:        return "unknown";
  }
}

function mapOutcomeSignal(state: string | undefined): PrOutcomeSignal {
  if (state === "success") return "passing";
  if (state === "failure" || state === "error") return "failing";
  return "unresolved";
}

// ---------------------------------------------------------------------------
// Hindsight helpers
// Scan commit messages for revert/fix patterns and cross-reference files.
// ---------------------------------------------------------------------------

const REVERT_RE = /\brevert\b/i;
const FIX_RE = /\bfix(es|ed)?\s+(#\d+|commit|sha|[0-9a-f]{7,40})\b/i;

function detectHindsight(commits: Array<{ sha: string; message: string; files: string[] }>): Map<string, string | null> {
  // Returns a map of sha → fixing commit sha (or null if not fixed)
  const result = new Map<string, string | null>();
  for (const c of commits) result.set(c.sha, null);

  for (const later of commits) {
    if (REVERT_RE.test(later.message)) {
      // Mark the previous commit (adjacent revert heuristic)
      const idx = commits.indexOf(later);
      if (idx > 0) {
        const prev = commits[idx - 1];
        result.set(prev.sha, later.sha);
      }
    }
    if (FIX_RE.test(later.message)) {
      // Mark any earlier commit that touched the same files
      for (const earlier of commits) {
        if (earlier.sha === later.sha) continue;
        const sharedFile = earlier.files.some((f) => later.files.includes(f));
        if (sharedFile && !result.get(earlier.sha)) {
          result.set(earlier.sha, later.sha);
        }
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Main fetch function
// ---------------------------------------------------------------------------

/**
 * Fetches a GitHub PR and normalises it into the locked M1→M2 contract.
 *
 * @param owner    - GitHub org or user, e.g. "vercel"
 * @param repo     - Repository name, e.g. "next.js"
 * @param prNumber - Pull request number
 * @returns NormalizedPR ready for the scoring pipeline
 */
export async function fetchPR(
  owner: string,
  repo: string,
  prNumber: number
): Promise<NormalizedPR> {
  // ── 1. PR metadata ────────────────────────────────────────────────────────
  const { data: pr } = await octokit.pulls.get({ owner, repo, pull_number: prNumber });

  const prState: NormalizedPR["prState"] =
    pr.state === "open" ? "open" :
    pr.merged_at ? "merged" : "closed";

  // ── 2. Commits ────────────────────────────────────────────────────────────
  // GitHub paginates at 250 commits max per PR; we fetch all pages.
  const rawCommits = await octokit.paginate(
    octokit.pulls.listCommits,
    { owner, repo, pull_number: prNumber, per_page: 100 }
  );

  const rawCommitCount = rawCommits.length;

  // Filter noise: merge commits and empty commits
  const meaningfulCommits = rawCommits.filter(
    (c) => !c.commit.message.startsWith("Merge ") && (c.stats?.total ?? 1) > 0
  );

  // ── 3. Per-commit files + CI ──────────────────────────────────────────────
  const commitData: Array<{
    sha: string;
    message: string;
    authorLogin: string | null;
    authoredAt: string;
    ciStatus: CommitCiStatus;
    files: NormalizedFile[];
    additions: number;
    deletions: number;
    filePaths: string[];
  }> = [];

  for (const c of meaningfulCommits) {
    // Gap #1: cache commit file+diff data by SHA — immutable once committed
    const detail = await cached(
      `commit:${owner}:${repo}:${c.sha}`,
      async () => {
        const { data } = await octokit.repos.getCommit({
          owner, repo, ref: c.sha,
          headers: { Accept: "application/vnd.github.v3.diff" },
        });
        return data;
      },
      TTL_COMMIT_DATA
    );

    // Gap #1: cache CI status by SHA — short TTL since CI can still change
    const status = await cached(
      `ci:${owner}:${repo}:${c.sha}`,
      async () => {
        const { data } = await octokit.repos.getCombinedStatusForRef({
          owner, repo, ref: c.sha,
        });
        return data;
      },
      TTL_CI_STATUS
    );

    const rawFiles = detail.files ?? [];
    let budgetRemaining = DIFF_BUDGET_CHARS;

    const normalizedFiles: NormalizedFile[] = rawFiles.map((f) => {
      const path = f.filename;
      const fileStatus: FileChangeStatus =
        f.status === "added"    ? "added"    :
        f.status === "removed"  ? "removed"  :
        f.status === "renamed"  ? "renamed"  : "modified";

      if (isDenylisted(path)) {
        return {
          path,
          previousPath: f.previous_filename ?? null,
          status: fileStatus,
          additions: f.additions,
          deletions: f.deletions,
          patch: "",
          omitted: true,
          omittedReason: "denylist",
        };
      }

      const patch = f.patch ?? "";
      if (patch.length > budgetRemaining) {
        const trimmed = patch.slice(0, budgetRemaining);
        budgetRemaining = 0;
        return {
          path,
          previousPath: f.previous_filename ?? null,
          status: fileStatus,
          additions: f.additions,
          deletions: f.deletions,
          patch: trimmed,
          omitted: true,
          omittedReason: "budget",
        };
      }

      budgetRemaining -= patch.length;
      return {
        path,
        previousPath: f.previous_filename ?? null,
        status: fileStatus,
        additions: f.additions,
        deletions: f.deletions,
        patch,
        omitted: false,
        omittedReason: null,
      };
    });

    commitData.push({
      sha: c.sha,
      message: c.commit.message.split("\n")[0], // first line only
      authorLogin: c.author?.login ?? null,
      authoredAt: c.commit.author?.date ?? new Date().toISOString(),
      ciStatus: mapCiStatus(status.state),
      files: normalizedFiles,
      additions: detail.stats?.additions ?? 0,
      deletions: detail.stats?.deletions ?? 0,
      filePaths: rawFiles.map((f) => f.filename),
    });
  }

  // ── 4. Hindsight pass ─────────────────────────────────────────────────────
  const hindsightMap = detectHindsight(
    commitData.map((c) => ({ sha: c.sha, message: c.message, files: c.filePaths }))
  );

  // ── 5. Build NormalizedCommit[] ───────────────────────────────────────────
  const normalizedCommits: NormalizedCommit[] = commitData.map((c) => ({
    sha: c.sha,
    message: c.message,
    authorLogin: c.authorLogin,
    authoredAt: c.authoredAt,
    ciStatus: c.ciStatus,
    files: c.files,
    additions: c.additions,
    deletions: c.deletions,
    wasRevertedLater: hindsightMap.get(c.sha) !== null && hindsightMap.get(c.sha) !== undefined && hindsightMap.get(c.sha) !== null,
    fixedByLaterCommit: hindsightMap.get(c.sha) ?? null,
  }));

  // ── 6. Review comments ───────────────────────────────────────────────────
  const rawComments = await octokit.paginate(
    octokit.pulls.listReviewComments,
    { owner, repo, pull_number: prNumber, per_page: 100 }
  );

  const reviewComments: NormalizedReviewComment[] = rawComments.map((c) => ({
    author: c.user?.login ?? null,
    body: c.body,
    path: c.path ?? null,
    createdAt: c.created_at,
  }));

  // ── 7. Head CI (for outcome signal) ──────────────────────────────────────
  const { data: headStatus } = await octokit.repos.getCombinedStatusForRef({
    owner, repo, ref: pr.head.sha,
  });

  // ── 8. Group into moves ───────────────────────────────────────────────────
  const moves = groupCommits(normalizedCommits);

  // ── 9. Aggregate totals ───────────────────────────────────────────────────
  const totalFilesChanged = new Set(
    normalizedCommits.flatMap((c) => c.files.map((f) => f.path))
  ).size;

  return {
    owner,
    repo,
    prNumber,
    title: pr.title,
    headSha: pr.head.sha,
    prState,
    outcomeSignal: mapOutcomeSignal(headStatus.state),
    moves,
    reviewComments,
    totalCommits: meaningfulCommits.length,
    rawCommitCount,
    totalFilesChanged,
    totalAdditions: normalizedCommits.reduce((s, c) => s + c.additions, 0),
    totalDeletions: normalizedCommits.reduce((s, c) => s + c.deletions, 0),
  };
}
