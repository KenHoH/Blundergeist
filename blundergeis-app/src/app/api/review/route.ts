import { NextRequest, NextResponse } from "next/server";
import { cached, redis } from "@/lib/cache";
import { fetchPR } from "@/lib/github/fetch-pr";
import { octokit } from "@/lib/github/client";
import { scoreCommit } from "@/lib/scoring/heuristics";
import { judgeCommit } from "@/lib/scoring/llm-judge";
import { calculateEval } from "@/lib/scoring/eval-calculator";
import { matchGame } from "@/lib/chess/match-game";
import { pgnToMoves } from "@/lib/chess/pgn-to-moves";
import type { LLMJudgeResult } from "@/lib/scoring/llm-judge";
import type { GameReviewPayload, ReviewMove, MoveLabel } from "@/types/review";
import type { NormalizedMove, PrOutcomeSignal } from "@/types/github";

// ---------------------------------------------------------------------------
// POST /api/review
// Body: { url: "https://github.com/owner/repo/pull/42" }
//
// Pipeline (Gap fixes applied):
//   #3 — headSha resolved from a short-TTL cache (1 GitHub call, not per request)
//   #2 — LLM failure falls back to heuristic score, never kills the review
//   #5 — LLM calls run in parallel via Promise.all
//   Full payload cached for 1 hour keyed by owner/repo/pr/headSha
// ---------------------------------------------------------------------------

const PR_URL_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/;

const TTL_HEAD_SHA  = 5 * 60;        // 5 min  — short so open PRs pick up new commits
const TTL_PAYLOAD   = 60 * 60;       // 1 hour — same headSha → same result

// ---------------------------------------------------------------------------
// Adapter: NormalizedMove → CommitInput
// ---------------------------------------------------------------------------

function moveToCommitInput(move: NormalizedMove) {
  const scopeCreep =
    move.commits.length > 1
      ? move.filesOmitted > 0
      : move.commits[0].files.length > 10;

  const totalAdditions = move.commits.reduce((s, c) => s + c.additions, 0);
  const totalDeletions = move.commits.reduce((s, c) => s + c.deletions, 0);

  return {
    commitSha:     move.commits[0].sha,
    commitMessage: move.commits.map((c) => c.message).join("; "),
    diff:          move.combinedDiff,
    ciPassed:      !move.anyCommitFailedCi,
    wasReverted:   move.anyCommitRevertedLater,
    diffLineCount: totalAdditions + totalDeletions,
    scopeCreep,
  };
}

// ---------------------------------------------------------------------------
// Outcome helpers
// ---------------------------------------------------------------------------

function outcomeSignalToPayload(
  signal: PrOutcomeSignal,
  hasRecovery: boolean
): GameReviewPayload["outcome"] {
  if (signal === "passing") return hasRecovery ? "recovery_win" : "white_win";
  if (signal === "failing") return "black_mate";
  return "draw";
}

function detectRecovery(labels: MoveLabel[]): boolean {
  let hadBad = false;
  for (const label of labels) {
    if (label === "Blunder" || label === "Mistake") hadBad = true;
    if (hadBad && (label === "Best" || label === "Brilliant")) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Parse + validate request ─────────────────────────────────────────────
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url } = body;
  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Missing field: url" }, { status: 400 });
  }

  const match = PR_URL_RE.exec(url);
  if (!match) {
    return NextResponse.json(
      { error: "Invalid GitHub PR URL. Expected: https://github.com/owner/repo/pull/N" },
      { status: 400 }
    );
  }

  const [, owner, repo, prStr] = match;
  const prNumber = parseInt(prStr, 10);

  try {
    // ── Gap #3: resolve headSha from short-TTL cache ──────────────────────
    // Costs 1 GitHub call on first hit, then zero until TTL expires.
    // This means a cache hit on the full payload below costs zero GitHub calls.
    const headSha = await cached<string>(
      `head:${owner}:${repo}:${prNumber}`,
      async () => {
        const { data: prMeta } = await octokit.pulls.get({
          owner, repo, pull_number: prNumber,
        });
        return prMeta.head.sha;
      },
      TTL_HEAD_SHA
    );

    const payloadKey = `review:${owner}:${repo}:${prNumber}:${headSha}`;

    // ── Full payload cache check — zero GitHub/LLM calls on hit ──────────
    const hit = await redis.get<GameReviewPayload>(payloadKey);
    if (hit) {
      return NextResponse.json(hit);
    }

    // ── Cache miss: run the full pipeline ────────────────────────────────
    const pr = await fetchPR(owner, repo, prNumber);

    // ── Gap #5: parallel LLM calls + Gap #2: heuristic fallback ─────────
    const judgeResults: Array<LLMJudgeResult & { commitSha: string; index: number }> =
      await Promise.all(
        pr.moves.map(async (move) => {
          const commitInput  = moveToCommitInput(move);
          const heuristicCtx = scoreCommit(commitInput);

          let judgeResult: LLMJudgeResult;
          try {
            judgeResult = await judgeCommit(heuristicCtx);
          } catch (err) {
            // Gap #2: LLM exhausted retries or errored — fall back to heuristics.
            // The review still completes; the reason field tells the user why.
            console.warn(
              `[api/review] LLM unavailable for ${move.commits[0].sha.slice(0, 8)}, ` +
              `falling back to heuristic. Error: ${err instanceof Error ? err.message : String(err)}`
            );
            const needsBestMove = ["Inaccuracy", "Mistake", "Blunder"].includes(
              heuristicCtx.heuristicLabel
            );
            judgeResult = {
              label:     heuristicCtx.heuristicLabel,
              evalScore: heuristicCtx.heuristicScore,
              reason:    "LLM unavailable — heuristic score used (CI result, diff size, hindsight).",
              bestMove:  needsBestMove
                ? "Review this commit manually — automated suggestion unavailable."
                : undefined,
              codeSnippet: undefined,
            };
          }

          return { ...judgeResult, commitSha: move.commits[0].sha, index: move.index };
        })
      );

    // ── Eval calculator ───────────────────────────────────────────────────
    const evalResult = calculateEval(judgeResults);

    // ── Outcome ───────────────────────────────────────────────────────────
    const labels  = judgeResults.map((r) => r.label);
    const outcome = outcomeSignalToPayload(pr.outcomeSignal, detectRecovery(labels));

    // ── Chess show layer ──────────────────────────────────────────────────
    const pgn        = matchGame(pr.moves.length, outcome, prNumber);
    const chessMoves = pgnToMoves(pgn, labels);

    // ── Merge → ReviewMove[] ──────────────────────────────────────────────
    const reviewMoves: ReviewMove[] = pr.moves.map((move, i) => {
      const judge = judgeResults[i];
      const chess = chessMoves[i];

      return {
        index:         move.index,
        commitSha:     move.commits[0].sha,
        commitMessage: move.commits.map((c) => c.message).join("; "),
        // Truth Layer
        label:       judge.label,
        evalScore:   judge.evalScore,
        reason:      judge.reason,
        bestMove:    judge.bestMove,
        codeSnippet: judge.codeSnippet,
        // Show Layer
        fen:        chess.fen,
        san:        chess.san,
        fromSquare: chess.fromSquare,
        toSquare:   chess.toSquare,
        soundType:  chess.soundType,
      };
    });

    // ── Assemble + cache payload ──────────────────────────────────────────
    const payload: GameReviewPayload = {
      prTitle:       pr.title,
      repo:          `${owner}/${repo}`,
      prNumber,
      headSha:       pr.headSha,
      outcome,
      accuracyScore: evalResult.accuracyScore,
      moves:         reviewMoves,
    };

    await redis.set(payloadKey, payload, { ex: TTL_PAYLOAD });

    return NextResponse.json(payload);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/review] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
