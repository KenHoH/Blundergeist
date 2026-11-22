# Member 1 GitHub Ingestion Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Member 1's GitHub ingestion pipeline that turns a PR URL into a `NormalizedPR` object (identity, grouped moves with trimmed diffs, CI roll-up, hindsight, review comments) and exposes it through the `/api/review` route handler.

**Architecture:** Four layers, strictly one-directional. `client.ts` owns the authenticated Octokit instance. `fetch-pr.ts` pulls raw PR data and produces `NormalizedCommit[]` plus PR-level metadata, including hindsight detection (revert-message scan + same-file overlap). `group-commits.ts` is a pure function that applies noise filtering, the move-splitting rules, the 6,000-char diff budget, and the denylist to produce `NormalizedMove[]`. `route.ts` is a thin orchestrator: parse URL → fetch → group → assemble `NormalizedPR` → return JSON. Grouping and denylist logic are pure and get the heaviest test coverage (unit + fast-check property tests); the fetch layer is tested against recorded/stubbed Octokit responses.

**Tech Stack:** Next.js 16 (App Router route handlers), TypeScript (strict), `@octokit/rest` for GitHub REST, Vitest as the test runner, `fast-check` for property-based tests. Path alias `@/*` → `src/*`.

**Spec:** The three workspace steering docs (`.kiro/steering/product.md`, `structure.md`, `tech.md`) and the locked contract `src/types/github.ts`. The plan argues from those; executors read both the plan and the contract.

## Global Constraints

- **Contract is locked.** `src/types/github.ts` MUST NOT be modified. All output conforms to `NormalizedPR` exactly. Import types from `@/types/github`.
- **Import boundaries (from structure.md Step 4):** `src/lib/github/*` may import `src/types/*` and `src/lib/utils.ts` only. The route handler (`src/app/api/*`) is the only layer allowed to orchestrate across domains. Do not import `scoring` or `chess` from `github`.
- **File placement:** GitHub API / Octokit / diff parsing / commit grouping → `src/lib/github/`. Single-file generic helpers → `src/lib/utils.ts`. Tests co-locate as `<filename>.test.ts`.
- **Naming:** `kebab-case` for all files except Next.js reserved files (`route.ts`). Tests as `<filename>.test.ts`.
- **Auth:** GitHub client reads the token from `process.env.GITHUB_TOKEN`. Public PRs only; no user auth.
- **Thin route rule:** `route.ts` orchestrates only — no business logic, no large trees inline.
- **Next.js version warning:** This repo runs Next.js 16 with non-standard conventions. Before writing `route.ts`, read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` and `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`. Follow their signatures over prior training.
- **Move count:** `NormalizedPR.moves` must end with 3–10 entries after grouping (per contract comment and product.md). Diff budget per move: 6,000 chars for `combinedDiff`.
- **Scope:** This pipeline returns `NormalizedPR`. It does NOT compute scores, labels, eval, or chess moves (those are M2). The route returns `NormalizedPR` "for now".

## Review Focus

- **Malformed / non-PR URLs** (e.g. `https://github.com/owner/repo`, trailing slashes, `.git` suffix, enterprise hosts): the route must return HTTP 400 with a clear message, not throw a 500. Pinned in Task 6.
- **Missing or invalid `GITHUB_TOKEN`**: the client should fail with an actionable error at call time rather than silently making unauthenticated requests that hit the 60/hr limit. Pinned in Task 2.
- **PR with 0 real commits after noise filtering** (every commit is a merge/noise commit): grouping must still yield a valid structure or the route must return a clear error, never produce `moves: []` that violates the 3–10 invariant. Pinned in Task 5.
- **A single commit touching one file with one hunk** must still split into at least 3 moves (`split-by-hunk`), and if it has fewer than 3 hunks the splitter must degrade gracefully (fewer moves but a defined, non-crashing result). Pinned in Task 5.
- **Renamed and binary files**: `previousPath` populated for renames; binary files marked `omitted: true` / `omittedReason: "binary"` with `patch: ""`, never counted as truncated text lines. Pinned in Task 4 and Task 5.

---

## File Structure

- `src/lib/github/client.ts` — exports `getOctokit()` returning a memoized authenticated Octokit REST instance; throws if `GITHUB_TOKEN` is absent.
- `src/lib/github/fetch-pr.ts` — exports `parsePrUrl(url)`, `fetchPr(ref)`, and the hindsight detector. Produces raw PR metadata + `NormalizedCommit[]` (ungrouped).
- `src/lib/github/group-commits.ts` — exports the pure grouping/trimming functions: noise filter, denylist check, diff-budget trimmer, and `groupCommits(commits)` → `NormalizedMove[]`.
- `src/app/api/review/route.ts` — Next.js route handler (`POST` + `GET`) that orchestrates the above into a `NormalizedPR` JSON response.
- `src/lib/github/group-commits.test.ts` — unit + fast-check property tests for grouping/trimming.
- `src/lib/github/fetch-pr.test.ts` — unit tests for URL parsing, normalization, and hindsight against stubbed Octokit.
- `src/lib/utils.ts` — (create if absent) generic `clamp` / string helpers if any are extracted.

Shared internal constants (denylist patterns, budget size, move caps) live as named exports at the top of `group-commits.ts`; tests import them so magic numbers are asserted once.

---

## Task 1: Test harness + dependencies

**Files:**
- Modify: `package.json` (add devDeps + `test` script)
- Create: `vitest.config.ts`

**Interfaces:**
- Produces: `npm test` runs Vitest over `src/**/*.test.ts`; `@/` alias resolves in tests.

- [ ] **Step 1: Install dependencies**

Run from `blundergeis-app/`:
```bash
npm install @octokit/rest
npm install -D vitest @vitest/coverage-v8 fast-check vite-tsconfig-paths
```

- [ ] **Step 2: Add the test script to `package.json`**

Add to `scripts`: `"test": "vitest run"` and `"test:watch": "vitest"`.

- [ ] **Step 3: Create `vitest.config.ts`**

Config uses `vite-tsconfig-paths` so `@/*` resolves, `test.environment: "node"`, `test.include: ["src/**/*.test.ts"]`.

- [ ] **Step 4: Add a throwaway smoke test and run it**

Create a temporary `src/lib/github/smoke.test.ts` with `expect(1).toBe(1)`.
Run: `npm test`
Expected: PASS, and the `@/types/github` import resolves (add `import type { NormalizedPR } from "@/types/github"` to the smoke test to prove alias resolution).

- [ ] **Step 5: Delete the smoke test and commit**

```bash
rm src/lib/github/smoke.test.ts
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest + fast-check test harness and octokit"
```

---

## Task 2: Octokit client

**Files:**
- Create: `src/lib/github/client.ts`
- Test: `src/lib/github/client.test.ts`

**Interfaces:**
- Produces: `getOctokit(): Octokit` — returns a memoized authenticated `@octokit/rest` `Octokit` instance; throws `Error("GITHUB_TOKEN is not set")` when `process.env.GITHUB_TOKEN` is missing or empty. `export function resetOctokitForTests(): void` clears the memo so tests can toggle the env var.

- [ ] **Step 1: Write the failing test**

In `client.test.ts`:
- `getOctokit()` throws when `GITHUB_TOKEN` is unset (assert the thrown message contains `GITHUB_TOKEN`).
- With `GITHUB_TOKEN` set, `getOctokit()` returns an object with a `.rest.pulls` property (proves it is a real Octokit) and returns the **same instance** on a second call (memoization).
- Use `vi.stubEnv("GITHUB_TOKEN", ...)` / `resetOctokitForTests()` between cases.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- client.test`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `getOctokit` and `resetOctokitForTests` in `client.ts`**

Read `GITHUB_TOKEN` at call time (not module load). Memoize in a module-level `let`. Construct `new Octokit({ auth: token })`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- client.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/github/client.ts src/lib/github/client.test.ts
git commit -m "feat(github): authenticated memoized octokit client"
```

---

## Task 3: PR URL parsing

**Files:**
- Modify: `src/lib/github/fetch-pr.ts` (create)
- Test: `src/lib/github/fetch-pr.test.ts` (create)

**Interfaces:**
- Produces: `interface PrRef { owner: string; repo: string; prNumber: number }` and `parsePrUrl(url: string): PrRef`. Throws `Error` with a message containing `Invalid PR URL` on anything that is not a `github.com/<owner>/<repo>/pull/<n>` URL.

- [ ] **Step 1: Write the failing test**

In `fetch-pr.test.ts`, `describe("parsePrUrl")`:
- `parsePrUrl("https://github.com/vercel/next.js/pull/123")` → `{ owner: "vercel", repo: "next.js", prNumber: 123 }`.
- Accepts a trailing slash and a trailing `/files` or `/commits` segment → same result.
- Accepts `http://` and `www.` prefixes.
- Throws `Invalid PR URL` for: `"https://github.com/vercel/next.js"` (no `/pull/`), `"not a url"`, `""`, `"https://gitlab.com/a/b/pull/1"` (non-github host), `"https://github.com/a/b/pull/abc"` (non-numeric).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- fetch-pr.test`
Expected: FAIL (`parsePrUrl` not exported).

- [ ] **Step 3: Implement `parsePrUrl` in `fetch-pr.ts`**

Use the `URL` constructor to validate host is `github.com` (allow `www.github.com`), then match the pathname against `/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/`. Strip a `.git` suffix from `repo` if present. Throw on any mismatch.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- fetch-pr.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/github/fetch-pr.ts src/lib/github/fetch-pr.test.ts
git commit -m "feat(github): parse and validate PR URLs"
```

---

## Task 4: Fetch + normalize PR data (commits, files, CI, comments) and hindsight

**Files:**
- Modify: `src/lib/github/fetch-pr.ts`
- Test: `src/lib/github/fetch-pr.test.ts`

**Interfaces:**
- Consumes: `getOctokit()` from Task 2 (`@/lib/github/client`); `parsePrUrl`/`PrRef` from Task 3.
- Produces:
  - `interface RawPr { owner; repo; prNumber; title; headSha; prState: "open"|"closed"|"merged"; outcomeSignal: PrOutcomeSignal; commits: NormalizedCommit[]; reviewComments: NormalizedReviewComment[]; totalFilesChanged: number; totalAdditions: number; totalDeletions: number; rawCommitCount: number }`
  - `fetchPr(ref: PrRef, deps?: { octokit?: Octokit }): Promise<RawPr>` — the optional `deps.octokit` lets tests inject a stub without env/network.
  - `detectHindsight(commits: NormalizedCommit[]): NormalizedCommit[]` — pure; returns commits with `wasRevertedLater` / `fixedByLaterCommit` filled in.
  - `mapCiStatus(checkConclusions: string[]): CommitCiStatus` — pure roll-up helper.

- [ ] **Step 1: Write the failing tests (pure helpers first)**

`describe("mapCiStatus")`:
- `[]` → `"unknown"`.
- any `"failure"`/`"timed_out"`/`"cancelled"` present → `"failure"`.
- any `"pending"`/`null` (in-progress) and no failure → `"pending"`.
- all `"success"`/`"neutral"`/`"skipped"` → `"success"`.

`describe("detectHindsight")`:
- A later commit whose message starts with `Revert "X"` referencing an earlier commit's message/sha sets the earlier commit's `wasRevertedLater = true`.
- A later commit that touches the **same file path** as an earlier commit AND whose message contains `fix`/`revert`/`undo` sets the earlier commit's `fixedByLaterCommit` to the later commit's SHA (first such later commit wins).
- A commit with no later overlap keeps `wasRevertedLater = false`, `fixedByLaterCommit = null`.
- Order matters: only **later** commits (higher index / later `authoredAt`) can fix earlier ones.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- fetch-pr.test`
Expected: FAIL (`mapCiStatus`/`detectHindsight` not exported).

- [ ] **Step 3: Implement `mapCiStatus` and `detectHindsight` in `fetch-pr.ts`**

`detectHindsight`: iterate commits in order; for each pair (earlier, later) where `later` index > `earlier` index, apply the revert-message rule and the same-file-overlap-with-fix-keyword rule described in the tests. Keyword match is case-insensitive on whole words.

- [ ] **Step 4: Run helper tests to verify they pass**

Run: `npm test -- fetch-pr.test`
Expected: PASS.

- [ ] **Step 5: Write the failing `fetchPr` test with a stubbed Octokit**

Build a fake `octokit` object exposing only the REST methods `fetchPr` calls (`pulls.get`, `pulls.listCommits`, `repos.getCommit`, `checks.listForRef` or `repos.getCombinedStatusForRef`, `pulls.listReviewComments`), each returning fixture data covering: a merged PR, one commit with a renamed file (assert `previousPath` set, `status: "renamed"`), one commit with a binary file (assert `omitted: true`, `omittedReason: "binary"`, `patch: ""`), CI success on head. Inject via `fetchPr(ref, { octokit: fakeOctokit })`.
Assert the returned `RawPr`: correct `prState`, `outcomeSignal` from head CI, `commits.length`, per-commit `ciStatus`, `totalAdditions/Deletions/FilesChanged`, `rawCommitCount`, and that hindsight fields are populated (calls `detectHindsight` internally).

- [ ] **Step 6: Run to verify it fails, then implement `fetchPr`**

Implement `fetchPr`: use injected octokit or `getOctokit()`. Fetch PR, commits, per-commit files/diffs, per-commit check-runs (roll up via `mapCiStatus`), head-commit CI → `outcomeSignal`, and PR review comments. Normalize each file to `NormalizedFile` (binary → omitted here; denylist/budget are applied later in grouping, so leave `patch` as the raw unified diff for text files). Map GitHub file `status` to `FileChangeStatus` and set `previousPath` for renames. Run `detectHindsight` on the commit list before returning.
Run: `npm test -- fetch-pr.test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/github/fetch-pr.ts src/lib/github/fetch-pr.test.ts
git commit -m "feat(github): fetch and normalize PR data with hindsight detection"
```

---

## Task 5: Group commits into moves (noise filter, split rules, denylist, diff budget)

**Files:**
- Create: `src/lib/github/group-commits.ts`
- Test: `src/lib/github/group-commits.test.ts`

**Interfaces:**
- Consumes: `NormalizedCommit`, `NormalizedFile`, `NormalizedMove`, `MoveSplitReason` from `@/types/github`.
- Produces (named exports):
  - `const DIFF_BUDGET = 6000` (chars per move `combinedDiff`).
  - `const MAX_MOVES = 10`, `const MIN_MOVES = 3`.
  - `const DENYLIST: RegExp[]` — matches lockfiles (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`), minified (`*.min.js`, `*.min.css`), and build/generated output (`dist/`, `build/`, `*.map`).
  - `isNoiseCommit(c: NormalizedCommit): boolean` — merge commits (message starts with `Merge `) and empty commits (0 files).
  - `isDenylisted(path: string): boolean`.
  - `trimDiff(diff: string, budget: number): { patch: string; linesTruncated: number }`.
  - `groupCommits(commits: NormalizedCommit[]): NormalizedMove[]`.

- [ ] **Step 1: Write failing unit tests**

`describe("isDenylisted")`: true for `package-lock.json`, `src/a.min.js`, `dist/bundle.js`, `foo.css.map`; false for `src/index.ts`.

`describe("trimDiff")`: diff under budget returns unchanged with `linesTruncated: 0`; diff over budget is cut to `<= budget` chars on a line boundary and reports the number of lines dropped.

`describe("groupCommits — move counts")`:
- **3–12 real commits** → 1 move per commit, each `splitReason: "one-commit"`, `moves.length === commits.length`.
- **Single commit, 1 file, ≥3 hunks** → `moves.length >= 3`, every move `splitReason: "split-by-hunk"`, same `commitSha` across moves.
- **Single commit, 1 file, 1 hunk** (degrade case from Review Focus) → does not throw; produces `>= 1` move, `splitReason: "split-by-hunk"`.
- **2 commits touching 4 files total** → split by file, `splitReason: "split-by-file"`, `moves.length >= 3`.
- **>12 commits** → grouped into exactly `MAX_MOVES` (10) moves, adjacent commits bundled, each `splitReason: "grouped-commits"`, union of commits preserved and ordered.
- **All commits are noise** (Review Focus) → `groupCommits` returns `[]`; the route (Task 6) turns this into a 422. Assert `[]` here.

`describe("groupCommits — move fields")`:
- `combinedDiff` never exceeds `DIFF_BUDGET` chars.
- `anyCommitFailedCi` true iff a bundled commit has `ciStatus === "failure"`.
- `anyCommitRevertedLater` true iff a bundled commit has `wasRevertedLater || fixedByLaterCommit`.
- Denylisted/binary files set `omitted: true` with the right `omittedReason` and contribute to `filesOmitted`, and their chars are not counted toward the budget.
- `index` is 0-based and sequential.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- group-commits.test`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `group-commits.ts`**

Order of operations inside `groupCommits`:
1. Filter out `isNoiseCommit`. If none remain, return `[]`.
2. Apply denylist: for each file, if `isDenylisted(path)` set `omitted: true`, `omittedReason: "denylist"`, `patch: ""`. Binary files keep their `"binary"` reason from Task 4.
3. Decide split strategy by remaining commit count:
   - `1` commit: split by hunk if it has one file; else split by file. Hunks are parsed by splitting the file `patch` on `@@` hunk headers.
   - `2` commits: split by file across both commits.
   - `3..12` commits: one move per commit.
   - `>12`: bundle adjacent commits into `MAX_MOVES` buckets (even distribution, remainder to earliest buckets).
4. For each move, concatenate the non-omitted file patches, run `trimDiff` with `DIFF_BUDGET`, set `linesTruncated` and `filesOmitted`, compute `anyCommitFailedCi` / `anyCommitRevertedLater`, assign sequential `index`.
   For split-by-file/hunk cases the move's `commits` array still references the parent `NormalizedCommit` (contract requires `>= 1` commit per move).

- [ ] **Step 4: Run unit tests to verify they pass**

Run: `npm test -- group-commits.test`
Expected: PASS.

- [ ] **Step 5: Add fast-check property tests**

In the same test file, add `describe("groupCommits — properties")` using `fast-check`. Write an arbitrary that generates a `NormalizedCommit[]` with 1–40 commits, varied file counts, patch sizes (some over budget), random denylisted paths, and random CI/hindsight flags. Assert these invariants hold for every generated input (`fc.assert(fc.property(...))`):
- When ≥1 non-noise commit exists, `3 <= moves.length <= 10` is NOT guaranteed by grouping alone for the split-by-file/hunk degrade cases, so assert the weaker, always-true invariant: `moves.length <= 10` AND `moves.length >= 1`. (The 3–10 floor is enforced/validated at the route in Task 6; note this explicitly.)
- Every move's `combinedDiff.length <= DIFF_BUDGET`.
- Every move has `commits.length >= 1`.
- `index` values are exactly `0..moves.length-1` in order.
- The multiset union of `commits` across moves, for the `one-commit`/`grouped-commits` strategies, equals the filtered input commit set (no commit dropped or duplicated).

- [ ] **Step 6: Run property tests to verify they pass**

Run: `npm test -- group-commits.test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/github/group-commits.ts src/lib/github/group-commits.test.ts
git commit -m "feat(github): group commits into moves with denylist and diff budget"
```

---

## Task 6: `/api/review` route handler

**Files:**
- Create: `src/app/api/review/route.ts`

**Interfaces:**
- Consumes: `parsePrUrl`, `fetchPr`, `RawPr` from `@/lib/github/fetch-pr`; `groupCommits`, `MIN_MOVES`, `MAX_MOVES` from `@/lib/github/group-commits`; `NormalizedPR` from `@/types/github`.
- Produces: `POST(req)` and `GET(req)` handlers returning `Response`/`NextResponse` JSON of a `NormalizedPR`.

- [ ] **Step 1: Read the Next.js 16 route-handler docs**

Read `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` and `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`. Use the handler signature and response helpers they document.

- [ ] **Step 2: Implement `route.ts` (thin orchestrator)**

- `POST`: read `{ url }` from the JSON body.
- `GET`: read `url` from `?url=` query param (so the route is linkable).
- Shared handler:
  1. `parsePrUrl(url)` — on throw, return `400` `{ error: "<message>" }`.
  2. `const raw = await fetchPr(ref)`.
  3. `const moves = groupCommits(raw.commits)` — if `moves.length === 0`, return `422` `{ error: "No reviewable commits in this PR" }`.
  4. Assemble `NormalizedPR`: identity from `raw`, `moves`, `reviewComments`, `totalCommits = raw.commits.length`, `rawCommitCount = raw.rawCommitCount`, `totalFilesChanged/Additions/Deletions` from `raw`, `outcomeSignal`, `prState`.
  5. Clamp/guard: if `moves.length > MAX_MOVES` treat as a grouping bug — this should not happen, but return `500` with a diagnostic rather than emitting an invalid payload.
  6. Return `200` JSON.
- Wrap the whole body in try/catch: Octokit 404 → `404 { error: "PR not found" }`; missing `GITHUB_TOKEN` error → `500 { error: "Server not configured" }`; anything else → `500`.
- Set `export const runtime = "nodejs"` (Octokit needs Node, not Edge).

- [ ] **Step 3: Manual verification against a real public PR**

Ensure `GITHUB_TOKEN` is in `.env.local`. Run `npm run dev`, then:
```bash
curl -s "http://localhost:3000/api/review?url=https://github.com/vercel/next.js/pull/1" | head -c 400
```
Expected: JSON `NormalizedPR` with `moves.length` between 1 and 10, valid `outcomeSignal`, and no server error.

- [ ] **Step 4: Verify bad-input handling**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/review?url=https://github.com/vercel/next.js"
```
Expected: `400`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/review/route.ts
git commit -m "feat(api): /api/review route returns NormalizedPR"
```

---

## Task 7: Full suite + typecheck gate

**Files:** none (verification only).

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all unit + property tests PASS.

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no type errors; lint clean (fix any import-boundary violations the linter or a manual grep surfaces — confirm `src/lib/github/*` imports only `@/types/*` and `@/lib/utils`).

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "chore(github): green typecheck, lint, and full test suite"
```

---

## Self-Review Notes

- **Spec coverage:** client/env (T2), fetch+normalize+CI+comments+hindsight (T4), URL parse (T3), noise filter + split rules + denylist + 6000-char budget (T5), route returning `NormalizedPR` (T6), co-located unit + fast-check tests (T4, T5). All `NormalizedPR`/`NormalizedMove`/`NormalizedFile`/`NormalizedCommit` fields are produced by T4/T5/T6.
- **3–10 moves invariant:** grouping guarantees `<= 10` and `>= 1`; the hard 3-move floor is only reachable for normal PRs (split rules target ≥3). The degrade case (single commit/file/hunk) can yield <3; the route does not reject it. If the product requires a strict 3-move floor even in that degenerate case, that is a spec clarification for Member 2 — flagged here rather than silently padded.
- **Boundaries:** no `github` file imports `scoring`/`chess`; only `route.ts` orchestrates. Verified in T7.
