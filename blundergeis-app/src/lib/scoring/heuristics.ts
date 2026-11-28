import type { MoveLabel } from "@/types/review";
import type { HeuristicContext } from "./llm-judge";

// ---------------------------------------------------------------------------
// Heuristic scoring
// Runs before the LLM judge. Produces a pre-score and pre-label that the
// LLM may refine by at most one step.
// ---------------------------------------------------------------------------

export interface CommitInput {
  commitSha: string;
  commitMessage: string;
  diff: string;
  ciPassed: boolean;
  wasReverted: boolean;
  diffLineCount: number;
  scopeCreep: boolean;
}

/**
 * Assigns a raw score and label based on signal weights.
 * The LLM judge receives this output and may adjust by ±1 label step.
 */
export function scoreCommit(input: CommitInput): HeuristicContext {
  let score = 0;

  // CI result is the strongest signal
  if (!input.ciPassed) score -= 5;
  else score += 2;

  // Hindsight: reverted or patched later
  if (input.wasReverted) score -= 4;

  // Diff size penalty — large diffs are harder to review and riskier
  if (input.diffLineCount > 500) score -= 3;
  else if (input.diffLineCount > 200) score -= 1;

  // Scope creep
  if (input.scopeCreep) score -= 2;

  // Clamp to contract range
  score = Math.max(-10, Math.min(10, score));

  const label = scoreToLabel(score);

  return { ...input, heuristicScore: score, heuristicLabel: label };
}

function scoreToLabel(score: number): MoveLabel {
  if (score >= 7)  return "Brilliant";
  if (score >= 3)  return "Best";
  if (score >= 0)  return "Good";
  if (score >= -4) return "Inaccuracy";
  if (score >= -7) return "Mistake";
  return "Blunder";
}
