import { GoogleGenAI } from "@google/genai";
import type { MoveLabel } from "@/src/types/review";

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

if (!process.env.GEMINI_API_KEY) {
  throw new Error("Missing env var: GEMINI_API_KEY");
}

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL = "gemini-2.5-flash";

// ---------------------------------------------------------------------------
// Input / Output types
// ---------------------------------------------------------------------------

/**
 * Everything the heuristics layer has already computed, passed into the LLM
 * so it can refine and explain the score.
 */
export interface HeuristicContext {
  commitSha: string;
  commitMessage: string;
  diff: string;            // Raw unified diff for this commit
  ciPassed: boolean;
  wasReverted: boolean;    // Hindsight: commit was reverted or fixed later
  diffLineCount: number;   // Total lines changed
  scopeCreep: boolean;     // Touches files outside the stated PR scope
  heuristicScore: number;  // Pre-computed score from heuristics (-10 to +10)
  heuristicLabel: MoveLabel;
}

/**
 * What the LLM returns. The heuristic label is the floor; the LLM may
 * upgrade or downgrade by one step based on evidence in the diff.
 */
export interface LLMJudgeResult {
  label: MoveLabel;
  evalScore: number;    // Refined score, clamped -10.0 to +10.0
  reason: string;       // 1-2 sentences citing specific diff evidence
  bestMove?: string;    // Required when label is Inaccuracy, Mistake, or Blunder
  codeSnippet?: string; // The most relevant diff hunk (≤20 lines)
}

// ---------------------------------------------------------------------------
// Prompt templates
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `\
You are a senior code reviewer analyzing a single Git commit as part of a PR review.
You will be given heuristic pre-scores and the raw diff.
Your job is to refine the label and score, then explain your reasoning concisely.

Rules:
- You may upgrade or downgrade the heuristic label by at most ONE step.
- Always cite specific evidence from the diff (file name, line, or pattern).
- Keep "reason" to 1-2 sentences maximum.
- For Inaccuracy, Mistake, or Blunder, you MUST provide a "bestMove" suggestion.
- Extract the single most relevant diff hunk (≤20 lines) as "codeSnippet" when useful.
- Respond ONLY with valid JSON matching the schema. No markdown fences, no extra keys.

Label scale (worst → best):
  Blunder (-8 to -10) | Mistake (-5 to -7) | Inaccuracy (-2 to -4)
  Good (0 to +2)      | Best (+3 to +6)    | Brilliant (+7 to +10)

JSON schema:
{
  "label": "<MoveLabel>",
  "evalScore": <number -10.0 to +10.0>,
  "reason": "<string>",
  "bestMove": "<string | undefined>",
  "codeSnippet": "<string | undefined>"
}`;

function buildUserPrompt(ctx: HeuristicContext): string {
  const flags = [
    ctx.ciPassed ? "CI: PASSED" : "CI: FAILED",
    ctx.wasReverted ? "REVERTED/FIXED LATER: yes" : "REVERTED/FIXED LATER: no",
    `Diff lines changed: ${ctx.diffLineCount}`,
    ctx.scopeCreep ? "Scope creep: yes (touches out-of-scope files)" : "Scope creep: no",
    `Heuristic pre-score: ${ctx.heuristicScore}`,
    `Heuristic pre-label: ${ctx.heuristicLabel}`,
  ].join("\n");

  return `\
Commit: ${ctx.commitSha.slice(0, 8)}
Message: ${ctx.commitMessage}

Heuristic signals:
${flags}

Diff:
\`\`\`diff
${ctx.diff}
\`\`\`

Return your refined judgment as JSON.`;
}

// ---------------------------------------------------------------------------
// Specialised prompt builders per label tier
// (These narrow the LLM's focus so prompts stay concise and targeted.)
// ---------------------------------------------------------------------------

/**
 * For commits already flagged as Blunder or Mistake by heuristics.
 * Asks the LLM to find the root cause and suggest a concrete fix.
 */
function buildBadMovePrompt(ctx: HeuristicContext): string {
  return (
    buildUserPrompt(ctx) +
    `\n\nThis commit was flagged as ${ctx.heuristicLabel}. ` +
    `Focus on identifying the root cause in the diff and provide a concrete "bestMove" fix suggestion. ` +
    `If CI failed, explain which change likely caused it.`
  );
}

/**
 * For commits flagged Inaccuracy — sub-optimal but not broken.
 * Asks the LLM to explain what a cleaner approach would look like.
 */
function buildInaccuracyPrompt(ctx: HeuristicContext): string {
  return (
    buildUserPrompt(ctx) +
    `\n\nThis commit is an Inaccuracy — not broken, but could be cleaner. ` +
    `Identify the specific area of concern and suggest a "bestMove" that improves it ` +
    `(e.g. better abstraction, missing error handling, naming, or test coverage).`
  );
}

/**
 * For commits flagged Good or Best.
 * Asks the LLM to confirm quality and optionally highlight what was done well.
 */
function buildGoodMovePrompt(ctx: HeuristicContext): string {
  return (
    buildUserPrompt(ctx) +
    `\n\nThis commit looks solid. Confirm the assessment and briefly note ` +
    `what specifically makes it good (clear intent, tight scope, CI passing, etc.). ` +
    `Only downgrade if you find clear evidence of a hidden issue.`
  );
}

/**
 * For commits flagged Brilliant.
 * Asks the LLM to confirm and explain what makes it exceptional.
 */
function buildBrilliantMovePrompt(ctx: HeuristicContext): string {
  return (
    buildUserPrompt(ctx) +
    `\n\nThis commit was flagged as Brilliant. Confirm or downgrade based on the diff. ` +
    `If confirmed, explain what makes it exceptional — e.g. elegant fix, meaningful perf gain, ` +
    `or a well-scoped refactor that reduces future risk.`
  );
}

// ---------------------------------------------------------------------------
// Prompt router
// ---------------------------------------------------------------------------

function selectPrompt(ctx: HeuristicContext): string {
  switch (ctx.heuristicLabel) {
    case "Blunder":
    case "Mistake":
      return buildBadMovePrompt(ctx);
    case "Inaccuracy":
      return buildInaccuracyPrompt(ctx);
    case "Good":
    case "Best":
      return buildGoodMovePrompt(ctx);
    case "Brilliant":
      return buildBrilliantMovePrompt(ctx);
    default:
      return buildUserPrompt(ctx);
  }
}

// ---------------------------------------------------------------------------
// Score clamp helper
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Main judge function
// ---------------------------------------------------------------------------

/**
 * Calls Gemini 2.0 Flash with heuristic context and returns a refined judgment.
 * Throws if the model returns malformed JSON or an unexpected label.
 */
export async function judgeCommit(ctx: HeuristicContext): Promise<LLMJudgeResult> {
  const userPrompt = selectPrompt(ctx);

  const response = await genai.models.generateContent({
    model: MODEL,
    contents: userPrompt,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.2,   // Low temperature for consistent, evidence-based judgments
      maxOutputTokens: 512,
    },
  });

  const raw = response.text?.trim();
  if (!raw) {
    throw new Error(`LLM returned empty response for commit ${ctx.commitSha}`);
  }

  let parsed: LLMJudgeResult;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `LLM returned invalid JSON for commit ${ctx.commitSha}:\n${raw}`
    );
  }

  // Validate label
  const validLabels: MoveLabel[] = [
    "Brilliant", "Best", "Good", "Inaccuracy", "Mistake", "Blunder",
  ];
  if (!validLabels.includes(parsed.label)) {
    throw new Error(
      `LLM returned unknown label "${parsed.label}" for commit ${ctx.commitSha}`
    );
  }

  // Clamp score to contract bounds
  parsed.evalScore = clamp(parsed.evalScore, -10, 10);

  // Enforce bestMove requirement for negative labels
  const needsBestMove: MoveLabel[] = ["Inaccuracy", "Mistake", "Blunder"];
  if (needsBestMove.includes(parsed.label) && !parsed.bestMove) {
    throw new Error(
      `LLM omitted required "bestMove" for ${parsed.label} commit ${ctx.commitSha}`
    );
  }

  return parsed;
}
