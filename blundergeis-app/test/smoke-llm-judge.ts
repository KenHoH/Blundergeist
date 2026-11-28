/**
 * Smoke test for llm-judge.ts
 * Run: npx tsx --env-file=.env test/smoke-llm-judge.ts
 *
 * Covers:
 *  1. Gemini client connects and returns a response
 *  2. scoreCommit() produces correct labels for known inputs
 *  3. judgeCommit() returns a valid LLMJudgeResult for all 6 label tiers
 *  4. bestMove is present for negative labels (Inaccuracy / Mistake / Blunder)
 *  5. evalScore is clamped within [-10, 10]
 * Smoke test for llm-judge.ts + heuristics.ts
 * Run: npx tsx --env-file=.env test/smoke-llm-judge.ts
 */

import { judgeCommit, type HeuristicContext } from "../src/lib/scoring/llm-judge";
import { scoreCommit } from "../src/lib/scoring/heuristics";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// 1. Heuristic unit tests (no network)
// ---------------------------------------------------------------------------

console.log("\n── Heuristic scoreCommit() ──");

const cleanInput = {
  commitSha: "aaa00001",
  commitMessage: "feat: add caching layer",
  diff: "+const cache = new Map();",
  ciPassed: true,
  wasReverted: false,
  diffLineCount: 30,
  scopeCreep: false,
};
const r1 = scoreCommit(cleanInput);
// CI pass (+2), no revert, small diff, no scope creep → score 2 → Good
assert(r1.heuristicLabel === "Good", `small clean commit → Good (got ${r1.heuristicLabel})`);
assert(r1.heuristicScore === 2, `score should be 2 (got ${r1.heuristicScore})`);

const worstInput = {
  ...cleanInput,
  commitSha: "bbb00002",
  ciPassed: false,
  wasReverted: true,
  diffLineCount: 600,
  scopeCreep: true,
};
const r2 = scoreCommit(worstInput);
// CI fail (-5), reverted (-4), large diff (-3), scope creep (-2) → -14 clamped to -10 → Blunder
assert(r2.heuristicLabel === "Blunder", `all-bad commit → Blunder (got ${r2.heuristicLabel})`);
assert(r2.heuristicScore === -10, `score should be -10 (got ${r2.heuristicScore})`);

const mistakeInput = {
  ...cleanInput,
  commitSha: "ccc00003",
  ciPassed: false,
  diffLineCount: 250,
};
const r3 = scoreCommit(mistakeInput);
// CI fail (-5), medium diff (-1) → -6 → Mistake
assert(r3.heuristicLabel === "Mistake", `CI fail + medium diff → Mistake (got ${r3.heuristicLabel})`);
assert(r3.heuristicScore === -6, `score should be -6 (got ${r3.heuristicScore})`);

// ---------------------------------------------------------------------------
// 2. Live Gemini calls — one per label tier
// ---------------------------------------------------------------------------

const baseCtx: Omit<HeuristicContext, "heuristicScore" | "heuristicLabel"> = {
  commitSha: "deadbeef1234",
  commitMessage: "fix: handle null pointer in auth middleware",
  diff: `--- a/src/middleware/auth.ts
+++ b/src/middleware/auth.ts
@@ -12,6 +12,9 @@ export function authMiddleware(req, res, next) {
-  const user = getUser(req.token);
-  next();
+  const user = getUser(req.token);
+  if (!user) {
+    return res.status(401).json({ error: 'Unauthorized' });
+  }
+  next();
 }`,
  ciPassed: true,
  wasReverted: false,
  diffLineCount: 6,
  scopeCreep: false,
};

const tiers: Array<{ label: HeuristicContext["heuristicLabel"]; score: number }> = [
  { label: "Brilliant",  score: 8  },
  { label: "Best",       score: 4  },
  { label: "Good",       score: 1  },
  { label: "Inaccuracy", score: -3 },
  { label: "Mistake",    score: -6 },
  { label: "Blunder",    score: -9 },
];

const VALID_LABELS = ["Brilliant", "Best", "Good", "Inaccuracy", "Mistake", "Blunder"];
const NEEDS_BEST_MOVE = ["Inaccuracy", "Mistake", "Blunder"];

async function runLiveCalls() {
  console.log("\n── Live judgeCommit() calls ──");

  for (const tier of tiers) {
    console.log(`  Testing tier: ${tier.label} ...`);
    const ctx: HeuristicContext = {
      ...baseCtx,
      heuristicScore: tier.score,
      heuristicLabel: tier.label,
    };

    try {
      const result = await judgeCommit(ctx);

      assert(VALID_LABELS.includes(result.label),
        `${tier.label} → valid label returned (got "${result.label}")`);

      assert(result.evalScore >= -10 && result.evalScore <= 10,
        `${tier.label} → evalScore in [-10,10] (got ${result.evalScore})`);

      assert(typeof result.reason === "string" && result.reason.length > 0,
        `${tier.label} → reason is non-empty`);

      if (NEEDS_BEST_MOVE.includes(result.label)) {
        assert(typeof result.bestMove === "string" && result.bestMove.length > 0,
          `${tier.label} → bestMove present for negative label "${result.label}"`);
      }

      console.log(`    label=${result.label} score=${result.evalScore} reason="${result.reason.slice(0, 80)}..."`);
    } catch (err) {
      console.error(`  ❌ THREW for tier ${tier.label}:`, (err as Error).message);
      failed++;
    }
  }
}

async function main() {
  await runLiveCalls();
  console.log(`\n── Results: ${passed} passed, ${failed} failed ──\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
