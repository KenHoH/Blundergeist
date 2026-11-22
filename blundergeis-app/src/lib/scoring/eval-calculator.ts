import type { MoveLabel } from "@/types/review";
import type { LLMJudgeResult } from "./llm-judge";

// ---------------------------------------------------------------------------
// Eval Calculator
// Consumes per-commit LLM judge results and produces:
//   1. Per-move eval bar values  (whitePov 0–1, blackPov 0–1)
//   2. A single accuracy score   (0–100) summarising the whole PR
// ---------------------------------------------------------------------------

/**
 * The eval bar value for one commit move.
 *
 * whitePov: fraction of the bar filled for White (the PR author / good side).
 *   0.5  → equal position
 *   >0.5 → White advantage  (good commits dominating)
 *   <0.5 → Black advantage  (bad commits / CI failures dominating)
 *
 * blackPov is always 1 - whitePov. Both are included so the UI component
 * can render either side without arithmetic.
 */
export interface MoveEval {
  /** Commit index (0-based, matches ReviewMove.index) */
  index: number;
  commitSha: string;
  label: MoveLabel;
  /** Raw score from the LLM judge, clamped to [-10, +10] */
  evalScore: number;
  /** White's share of the eval bar: 0.0 – 1.0 */
  whitePov: number;
  /** Black's share of the eval bar: 0.0 – 1.0  (always 1 - whitePov) */
  blackPov: number;
}

/**
 * Full output of the calculator for one PR.
 *
 * moves    – per-commit eval bar values in commit order.
 * accuracy – 0–100 summary score (100 = every commit was Brilliant/Best,
 *            0 = every commit was a Blunder).
 */
export interface EvalResult {
  moves: MoveEval[];
  accuracyScore: number;
}

// ---------------------------------------------------------------------------
// Label → accuracy contribution
// Maps each label to a 0–100 point value used to compute the accuracy score.
// Weights mirror Lichess accuracy tables: bad moves carry a steep penalty,
// good moves cluster near the top.
// ---------------------------------------------------------------------------

const LABEL_ACCURACY: Record<MoveLabel, number> = {
  Brilliant: 100,
  Best:       85,
  Good:       70,
  Inaccuracy: 45,
  Mistake:    20,
  Blunder:     0,
};

// ---------------------------------------------------------------------------
// Core conversion: evalScore → whitePov
//
// Chess engines use a logistic curve so that the bar doesn't pin to 100 %
// on tiny material advantages. We apply the same idea:
//
//   whitePov = 1 / (1 + e^(-k * evalScore))
//
// where k controls how steeply the bar moves. With k = 0.3 the bar reaches
// ~73 % at evalScore = +3 (Best) and ~96 % at +10 (Brilliant), leaving
// visible room at both extremes.
// ---------------------------------------------------------------------------

const K = 0.3;

function evalToWhitePov(evalScore: number): number {
  return 1 / (1 + Math.exp(-K * evalScore));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Converts an ordered array of LLM judge results (one per commit) into
 * per-move eval bar values and an overall accuracy score.
 *
 * @param results - Judge results in commit order. Must be non-empty.
 * @returns EvalResult with one MoveEval per commit plus the accuracy score.
 */
export function calculateEval(
  results: Array<LLMJudgeResult & { commitSha: string; index: number }>
): EvalResult {
  if (results.length === 0) {
    return { moves: [], accuracyScore: 0 };
  }

  const moves: MoveEval[] = results.map((r) => {
    const whitePov = evalToWhitePov(r.evalScore);
    return {
      index:     r.index,
      commitSha: r.commitSha,
      label:     r.label,
      evalScore: r.evalScore,
      whitePov:  Math.round(whitePov * 1000) / 1000,   // 3 decimal places
      blackPov:  Math.round((1 - whitePov) * 1000) / 1000,
    };
  });

  const accuracyScore = computeAccuracy(results.map((r) => r.label));

  return { moves, accuracyScore };
}

// ---------------------------------------------------------------------------
// Accuracy score
//
// Simple mean of per-label accuracy points. Rounds to the nearest integer.
// A PR where every commit is Brilliant scores 100; all Blunders scores 0.
// ---------------------------------------------------------------------------

function computeAccuracy(labels: MoveLabel[]): number {
  if (labels.length === 0) return 0;
  const total = labels.reduce((sum, l) => sum + LABEL_ACCURACY[l], 0);
  return Math.round(total / labels.length);
}
