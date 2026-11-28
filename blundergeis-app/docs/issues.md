# Blundergeist — Known Issues

> Last audited: 2026-11-22  
> Audit method: static analysis (TypeScript, source inspection) + live browser testing with Chrome DevTools against `https://github.com/moeru-ai/airi/pull/3523`  
> Test suite: 57 tests, 5 files — all passing

---

## Quick Summary

| # | Severity | File | One-liner |
|---|----------|------|-----------|
| 1 | 🔴 Critical | `llm-judge.ts` | Wrong Gemini model name — LLM never runs |
| 2 | 🔴 Critical | `fetch-pr.ts` | CI undetectable on GitHub Actions repos |
| 3 | 🔴 Critical | `route.ts` | Merged PRs always show "Draw" outcome |
| 4 | 🟠 High | `.env` | `GITHUB_TOKEN` is empty — 60 req/hour limit |
| 5 | 🟠 High | `review-client-view.tsx` | Any API error silently loads mock data |
| 6 | 🟠 High | `llm-judge.ts` | Missing `GEMINI_API_KEY` crashes entire route |
| 7 | 🟡 Medium | `layout.tsx` | Wrong SEO metadata description |
| 8 | 🟡 Medium | `src/app/chessboard.tsx` | Orphaned dead file |
| 9 | 🟡 Medium | `use-chess-game.ts` | Stockfish Worker file missing from `public/` |
| 10 | 🟡 Medium | `eval-calculator.ts` | `whitePov`/`blackPov` computed but never used |
| 11 | 🟡 Medium | `pr-input-form.tsx` | Submit button stuck after back-navigation |
| 12 | ⚪ Low | `src/app/favicon.ico` | favicon 404 on every request |
| 13 | ⚪ Low | `llm-judge.ts` | Gemini 429 (quota) not retried |
| 14 | ⚪ Low | `fetch-pr.ts` | Triple-redundant null check |

---

## 🔴 Critical

### Issue #1 — Wrong Gemini model name

**File:** `src/lib/scoring/llm-judge.ts`  
**Confirmed by:** Live test — every commit shows "LLM unavailable — heuristic score used"

**What happens:**  
The model constant is set to `"gemini-3.8-flash"` which does not exist in the Gemini API. Every call to `judgeCommit()` throws, the per-move fallback fires, and all scoring falls back to heuristics alone. No AI analysis runs at all — the entire LLM layer is silently dead.

**Current code:**
```ts
const MODEL = "gemini-3.8-flash";
```

**Fix:**
```ts
const MODEL = "gemini-3.6-flash";
```

The current stable model is `gemini-3.6-flash`. Note: `gemini-3.5-flash` also works (it auto-routes to `gemini-3.6-flash`) but `gemini-3.6-flash` is the explicit current name.

---

### Issue #2 — CI always reads as "unknown" for GitHub Actions repos

**File:** `src/lib/github/fetch-pr.ts`  
**Confirmed by:** Live test — `airi#3523` (uses GitHub Actions, CI passing) reported `outcomeSignal: "unresolved"` → outcome `"draw"`

**What happens:**  
`getCombinedStatusForRef` reads the **legacy GitHub Statuses API**. The vast majority of modern repos use **GitHub Actions**, which reports CI via the **Checks API** (`listCheckRunsForRef`). When a repo only uses GitHub Actions, the Statuses API returns `state: ""` — mapped to `"unresolved"` — so `outcomeSignal` is always `"unresolved"` regardless of whether CI actually passed or failed.

**Current code:**
```ts
// Only reads legacy Statuses API — empty for GitHub Actions repos
const { data: headStatus } = await octokit.repos.getCombinedStatusForRef({
  owner, repo, ref: pr.head.sha,
});
outcomeSignal: mapOutcomeSignal(headStatus.state),
```

**Fix — add Checks API fallback:**
```ts
// Try legacy Statuses API first
const { data: headStatus } = await octokit.repos.getCombinedStatusForRef({
  owner, repo, ref: pr.head.sha,
});

let outcomeSignal = mapOutcomeSignal(headStatus.state);

// If no legacy status, fall back to Checks API (GitHub Actions)
if (outcomeSignal === "unresolved") {
  const { data: checks } = await octokit.checks.listForRef({
    owner, repo, ref: pr.head.sha, per_page: 100,
  });
  const runs = checks.check_runs;
  if (runs.length > 0) {
    const allSuccess = runs.every(r => r.conclusion === "success" || r.conclusion === "skipped");
    const anyFailure = runs.some(r => r.conclusion === "failure" || r.conclusion === "timed_out");
    if (allSuccess) outcomeSignal = "passing";
    else if (anyFailure) outcomeSignal = "failing";
  }
}
```

---

### Issue #3 — `prState` fetched but never used in outcome logic

**File:** `src/app/api/review/route.ts` and `src/lib/github/fetch-pr.ts`  
**Confirmed by:** Live test — merged PR `airi#3523` shows "DRAW / PR Stalled / Requires Changes"

**What happens:**  
`pr.prState` ("open" / "merged" / "closed") is fetched and stored in `NormalizedPR` but is never passed to `outcomeSignalToPayload()` in `route.ts`. Combined with Issue #2 (CI always unknown for Actions repos), every merged PR ends up as `outcomeSignal: "unresolved"` → outcome `"draw"` — displayed to the user as "PR Stalled / Requires Changes" even for cleanly merged PRs.

**Current code in `route.ts`:**
```ts
// prState is available on pr.prState but never referenced
const outcome = outcomeSignalToPayload(pr.outcomeSignal, detectRecovery(labels));
```

**Fix — use `prState` as final fallback:**
```ts
function outcomeSignalToPayload(
  signal: PrOutcomeSignal,
  hasRecovery: boolean,
  prState: "open" | "merged" | "closed",   // ← add this
): GameReviewPayload["outcome"] {
  if (signal === "passing") return hasRecovery ? "recovery_win" : "white_win";
  if (signal === "failing") return "black_mate";
  // signal is "unresolved" — use prState as fallback
  if (prState === "merged") return "white_win";
  return "draw";
}

// In the route handler:
const outcome = outcomeSignalToPayload(pr.outcomeSignal, detectRecovery(labels), pr.prState);
```

---

## 🟠 High

### Issue #4 — `GITHUB_TOKEN` is empty

**File:** `.env`  
**Confirmed by:** User-reported rate limit error (HTTP 403, 60 req/hour exhausted)

**What happens:**  
The `GITHUB_TOKEN` environment variable is an empty string. Octokit makes all requests unauthenticated, capped at 60 requests/hour per IP address. A single PR with 10 commits costs approximately 23 GitHub API requests (1 PR metadata + 1 commit list + 10 getCommit + 10 getCombinedStatus + 1 review comments). Two back-to-back PRs can exhaust the hourly quota.

**Current `.env`:**
```
GITHUB_TOKEN=""
```

**Fix:**
1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Check **`public_repo`** scope only
4. Copy the generated token
5. Update `.env`:
```
GITHUB_TOKEN="ghp_yourActualTokenHere"
```
6. Restart the dev server

Authenticated requests get **5,000 requests/hour** — enough to review ~200 PRs per hour.

---

### Issue #5 — Any API error silently loads mock data

**File:** `src/app/review/[owner]/[repo]/[pr]/review-client-view.tsx`  
**Confirmed by:** Live browser test — 404 for nonexistent repo loaded mock PR titled "feat(auth): Add Multi-tenant OAuth2 & Session Revocation"

**What happens:**  
Every error from the `/api/review` route (404, 403 rate limit, 500, network failure) is caught by a single `catch` block that silently loads `sample-review.json` as a fallback. The UI renders the mock PR title and 8 mock commits as if they belong to the requested repo. The warning banner is small and easy to overlook. A user hitting a rate limit sees a full working review of a fake PR — with no indication the data is not theirs.

**Current behavior:**  
Any error → load mock with title "feat(auth): Add Multi-tenant OAuth2 & Session Revocation" for whatever PR URL was entered.

**Fix — distinguish error types and show a clear error state:**
```tsx
} catch (err) {
  if (cancelled) return;
  const message = err instanceof Error ? err.message : String(err);

  // Rate limit: show specific guidance, no mock
  if (message.includes("rate limit") || message.includes("API rate limit")) {
    setError("RATE_LIMIT");
    setPayload(null);
    return;
  }

  // Not found: show specific message, no mock
  if (message.includes("Not Found")) {
    setError("NOT_FOUND");
    setPayload(null);
    return;
  }

  // Other errors: fall back to mock with clear warning
  setError(message);
  setPayload({ ...(sampleReviewData as GameReviewPayload), repo: `${owner}/${repo}`, prNumber });
}
```

Then render specific error screens for `RATE_LIMIT` and `NOT_FOUND` instead of silently showing mock data.

---

### Issue #6 — Missing `GEMINI_API_KEY` crashes the entire API route

**File:** `src/lib/scoring/llm-judge.ts`

**What happens:**  
There is a top-level `throw` at module load time if `GEMINI_API_KEY` is not set:
```ts
if (!process.env.GEMINI_API_KEY) {
  throw new Error("Missing env var: GEMINI_API_KEY");
}
```
This executes when the module is imported — before any request is handled. If the key is missing, the entire `/api/review` route fails to initialize and returns HTTP 500 for every request. The heuristic scoring (which does not need Gemini) cannot run either, even though the fallback in `route.ts` could handle LLM failures gracefully.

**Fix — move the check inside `judgeCommit()`:**
```ts
// Remove the top-level throw. Instead:
export async function judgeCommit(ctx: HeuristicContext): Promise<LLMJudgeResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing env var: GEMINI_API_KEY");
  }
  // ... rest of function
}
```
This way, the route's per-move `try/catch` catches the missing-key error and falls back to heuristics — the review still completes with heuristic scores rather than returning 500.

---

## 🟡 Medium

### Issue #7 — Wrong SEO metadata description

**File:** `src/app/layout.tsx`

**What happens:**  
The page metadata left over from initial scaffolding reads:
```ts
description: "Chess game with Stockfish"
```
This appears in search engine results, browser tabs, and link previews — none of which are accurate.

**Fix:**
```ts
export const metadata: Metadata = {
  title: "BlunderGeist",
  description: "Turn your GitHub PRs into chess game reviews. Score commits with Brilliant, Best, and Blunder badges.",
};
```

---

### Issue #8 — `chessboard.tsx` is orphaned dead code

**File:** `src/app/chessboard.tsx`

**What happens:**  
This file is not a valid Next.js route (not named `page.tsx`), is not imported anywhere, and exports a component that uses `useChessGame` (which loads a missing Stockfish worker). It contributes to bundle analysis noise and would crash if ever rendered.

**Fix:** Delete `src/app/chessboard.tsx`.

---

### Issue #9 — Stockfish Worker file missing from `public/`

**File:** `src/hooks/use-chess-game.ts`

**What happens:**  
```ts
const stockfishWorker = new Worker("/js/stockfish-16.1-lite-single.js");
```
The file `public/js/stockfish-16.1-lite-single.js` does not exist. This hook is currently dead (only referenced by the orphaned `chessboard.tsx`) but would throw a silent Worker load failure if ever wired to a live component.

**Fix:** Either delete this hook along with `chessboard.tsx` (recommended), or download the [Stockfish WASM build](https://github.com/nmrugg/stockfish.js) and place it at `public/js/stockfish-16.1-lite-single.js`.

---

### Issue #10 — `whitePov` / `blackPov` computed but never used

**File:** `src/lib/scoring/eval-calculator.ts`, `src/app/api/review/route.ts`, `src/components/eval-bar.tsx`

**What happens:**  
`calculateEval()` computes `whitePov` and `blackPov` per move using a logistic curve (`1 / (1 + e^(-0.3 * score))`). Neither field is in the `ReviewMove` type, neither is passed through `route.ts`, and `eval-bar.tsx` reimplements its own linear formula:
```ts
// eval-bar.tsx — independent linear mapping
const whitePercent = Math.min(95, Math.max(5, 50 + (clamped / 10) * 45));
```
The logistic curve is more accurate (matches how chess engine eval bars behave — sensitive in the middle range), but the computation is wasted.

**Fix option A — use the logistic values (better eval bar):**
1. Add `whitePov: number` to `ReviewMove` in `src/types/review.ts`
2. Set it in `route.ts` from `evalResult.moves[i].whitePov`
3. Have `eval-bar.tsx` accept `whitePov` as a prop instead of computing from `evalScore`

**Fix option B — remove the dead computation (simpler):**  
Remove `whitePov` and `blackPov` from `EvalResult` / `MoveEval` in `eval-calculator.ts` since they are not consumed.

---

### Issue #11 — Submit button stuck after back-navigation

**File:** `src/components/pr-input-form.tsx`  
**Confirmed by:** Live browser test — button showed "Analyzing..." and was disabled after navigating back from a review page

**What happens:**  
```ts
const handleSubmit = (e: React.FormEvent) => {
  setLoading(true);
  router.push(`/review/${parsed.owner}/${parsed.repo}/${parsed.pr}`);
  // setLoading(false) is never called
};
```
`router.push()` is non-blocking and does not await navigation. When the user clicks Back, the form remounts in the loading state with the button disabled. The user cannot submit another URL without a full page refresh.

**Fix:**
```ts
// Add cleanup effect to reset loading on unmount
useEffect(() => {
  return () => setLoading(false);
}, []);
```
Or reset loading when the component receives focus again via `router.events` (Next.js App Router does not expose router events, so the cleanup effect is the simpler fix).

---

## ⚪ Low

### Issue #12 — `favicon.ico` 404

**File:** `src/app/favicon.ico`

Every page request logs a 404 for `/favicon.ico` in the network panel. The file exists in `src/app/` but may be empty or corrupt.

**Fix:** Verify the file is a valid ICO (non-zero bytes). If needed, convert any PNG to ICO at [favicon.io](https://favicon.io) and replace the file.

---

### Issue #13 — Gemini 429 (quota exceeded) not retried

**File:** `src/lib/scoring/llm-judge.ts`

```ts
function isRetryable(err: unknown): boolean {
  // Only retries on 503 (service unavailable)
  return body?.error?.code === 503;
}
```
Gemini also returns HTTP 429 when the per-minute quota is exceeded. These errors are not retried — they throw immediately and trigger the heuristic fallback for that commit.

**Fix:**
```ts
return body?.error?.code === 503 || body?.error?.code === 429;
```

---

### Issue #14 — Triple-redundant null check in `fetch-pr.ts`

**File:** `src/lib/github/fetch-pr.ts`

```ts
wasRevertedLater: hindsightMap.get(c.sha) !== null &&
                  hindsightMap.get(c.sha) !== undefined &&
                  hindsightMap.get(c.sha) !== null,  // ← checked twice
```
The map is initialized with `null` for every SHA, so `!== undefined` and the duplicate `!== null` are both redundant.

**Fix:**
```ts
wasRevertedLater: hindsightMap.get(c.sha) !== null,
```

---

## Fix Priority Order

If fixing in one session, tackle in this order to unblock the most functionality:

1. **#4** — Add `GITHUB_TOKEN` to `.env` (1 minute, unblocks all real PR testing)
2. **#1** — Fix model name to `gemini-3.6-flash` (1 line, unblocks LLM scoring)
3. **#6** — Move `GEMINI_API_KEY` check inside `judgeCommit()` (5 lines, makes missing key graceful)
4. **#2** — Add Checks API fallback for GitHub Actions CI detection (20 lines)
5. **#3** — Pass `prState` to `outcomeSignalToPayload()` (5 lines, fixes merged PR outcome)
6. **#11** — Add cleanup effect to reset loading state in `pr-input-form.tsx` (3 lines)
7. **#5** — Improve error handling in `review-client-view.tsx` (20 lines)
8. **#8 + #9** — Delete `chessboard.tsx` and `use-chess-game.ts` (deletion)
9. **#7** — Fix layout metadata description (1 line)
10. **#10** — Decide: wire `whitePov` through or remove dead computation
11. **#13** — Add 429 to `isRetryable()` (1 line)
12. **#14** — Simplify redundant null check (1 line)
13. **#12** — Replace favicon.ico with valid file
