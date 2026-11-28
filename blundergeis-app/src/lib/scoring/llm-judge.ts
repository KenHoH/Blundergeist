import type { MoveLabel } from "@/types/review";

// ---------------------------------------------------------------------------
// Provider: Groq (OpenAI-compatible REST, no SDK dependency)
// ---------------------------------------------------------------------------

const GROQ_MODEL = "qwen/qwen3.8-27b";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

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
// ---------------------------------------------------------------------------

function buildBadMovePrompt(ctx: HeuristicContext): string {
  return (
    buildUserPrompt(ctx) +
    `\n\nThis commit was flagged as ${ctx.heuristicLabel}. ` +
    `Focus on identifying the root cause in the diff and provide a concrete "bestMove" fix suggestion. ` +
    `If CI failed, explain which change likely caused it.`
  );
}

function buildInaccuracyPrompt(ctx: HeuristicContext): string {
  return (
    buildUserPrompt(ctx) +
    `\n\nThis commit is an Inaccuracy — not broken, but could be cleaner. ` +
    `Identify the specific area of concern and suggest a "bestMove" that improves it ` +
    `(e.g. better abstraction, missing error handling, naming, or test coverage).`
  );
}

function buildGoodMovePrompt(ctx: HeuristicContext): string {
  return (
    buildUserPrompt(ctx) +
    `\n\nThis commit looks solid. Confirm the assessment and briefly note ` +
    `what specifically makes it good (clear intent, tight scope, CI passing, etc.). ` +
    `Only downgrade if you find clear evidence of a hidden issue.`
  );
}

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
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function stripMarkdownFences(text: string): string {
  let trimmed = text.trim();
  trimmed = trimmed.replace(/^```(?:json)?\s*\n?/, "");
  trimmed = trimmed.replace(/\n?```\s*$/, "");
  return trimmed.trim();
}

function validateAndNormalise(parsed: LLMJudgeResult, commitSha: string): LLMJudgeResult {
  const validLabels: MoveLabel[] = [
    "Brilliant", "Best", "Good", "Inaccuracy", "Mistake", "Blunder",
  ];
  if (!validLabels.includes(parsed.label)) {
    throw new Error(
      `LLM returned unknown label "${parsed.label}" for commit ${commitSha}`
    );
  }

  parsed.evalScore = clamp(parsed.evalScore, -10, 10);

  const needsBestMove: MoveLabel[] = ["Inaccuracy", "Mistake", "Blunder"];
  if (needsBestMove.includes(parsed.label) && !parsed.bestMove) {
    throw new Error(
      `LLM omitted required "bestMove" for ${parsed.label} commit ${commitSha}`
    );
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Main judge function
// ---------------------------------------------------------------------------

/**
 * Calls Groq (qwen/qwen3.8-27b) with JSON mode to refine the heuristic
 * judgment for a single commit.
 * Throws on API error or invalid response — route.ts catches this and falls
 * back to pure heuristics, keeping the review alive.
 */
export async function judgeCommit(ctx: HeuristicContext): Promise<LLMJudgeResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing env var: GROQ_API_KEY");

  const userPrompt = selectPrompt(ctx);

  const response = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `[llm-judge] Groq API error ${response.status} for commit ${ctx.commitSha.slice(0, 8)}: ${body}`
    );
  }

  const json = await response.json();
  const text: string = json.choices?.[0]?.message?.content ?? "";
  if (!text) {
    throw new Error(
      `[llm-judge] Groq returned empty response for commit ${ctx.commitSha}`
    );
  }

  let parsed: LLMJudgeResult;
  try {
    parsed = JSON.parse(stripMarkdownFences(text));
  } catch {
    throw new Error(
      `[llm-judge] Groq returned invalid JSON for commit ${ctx.commitSha}:\n${text}`
    );
  }

  return validateAndNormalise(parsed, ctx.commitSha);
}
