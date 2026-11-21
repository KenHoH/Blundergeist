# Project Structure & Ownership

## 1. Directory Layout
pr-game-review/
├── public/
│   └── sounds/                       # [M3] move.mp3, capture.mp3, check.mp3, blunder.mp3, mate.mp3
├── src/
│   ├── types/                        # [SHARED - LOCKED] Contracts between layers
│   │   ├── github.ts                 # NormalizedPR (M1 -> M2)
│   │   └── review.ts                 # GameReviewPayload (M2 -> M3)
│   ├── mocks/                        # [SHARED] Mock payloads for UI development
│   │   └── sample-review.json
│   ├── app/
│   │   ├── layout.tsx                # [M1] Root layout, fonts, theme
│   │   ├── page.tsx                  # [M3] Landing page (PR URL input)
│   │   ├── review/[owner]/[repo]/[pr]/
│   │   │   └── page.tsx              # [M3] Main Game Review screen
│   │   └── api/review/
│   │       └── route.ts              # [M1] Orchestrator (Cache -> M1 -> M2 -> Stream)
│   ├── lib/
│   │   ├── github/                   # [M1] GitHub API ingestion
│   │   │   ├── client.ts             # Octokit REST + GraphQL client
│   │   │   ├── fetch-pr.ts           # Commits, diffs, CI status, comments
│   │   │   └── group-commits.ts      # Caps commits to 8-12 moves
│   │   ├── cache/                    # [M1] Rate-limit & token protection
│   │   │   └── redis.ts              # Keyed by owner/repo/pr/head_sha
│   │   ├── scoring/                  # [M2] Truth Layer
│   │   │   ├── heuristics.ts         # Diff size, CI fail, revert/hindsight detection
│   │   │   ├── llm-judge.ts          # Vercel AI SDK + Zod rubric
│   │   │   └── eval-calculator.ts    # Blends heuristics + LLM -> evalScore & label
│   │   └── chess/                    # [M2] Show Layer
│   │       ├── games.json            # Curated PGN library
│   │       ├── match-game.ts         # Matches PR profile to a PGN
│   │       └── pgn-to-moves.ts       # chess.js -> FENs, SANs, squares, soundType
│   ├── components/                   # [M3] UI/UX & Simulation
│   │   ├── ui/                       # shadcn/ui primitives
│   │   ├── pr-input-form.tsx
│   │   ├── chess-board-panel.tsx     # react-chessboard + highlights + badges
│   │   ├── eval-bar.tsx              # Framer Motion vertical eval bar
│   │   ├── move-list.tsx             # Scrubbable list + playback controls
│   │   ├── best-move-card.tsx        # LLM reason + Shiki diff snippet
│   │   └── summary-modal.tsx         # Accuracy score + outcome banner
│   └── hooks/                        # [M3] Client state
│       ├── use-review-player.ts      # Move index, keyboard arrows, auto-play
│       └── use-chess-sounds.ts       # Audio trigger on move change
└── docs/
    ├── product.md
    ├── structure.md
    └── tech.md

## 2. Agent Ownership & Modification Rules

To prevent merge conflicts across the 3-person team, agents MUST respect these directory boundaries:
Member 1 (Infra & GitHub): Owns src/lib/github/, src/lib/cache/, src/app/api/review/route.ts, src/app/layout.tsx.
Member 2 (Truth & Show Engine): Owns src/lib/scoring/, src/lib/chess/.
Member 3 (UI/UX & Simulation): Owns src/components/, src/hooks/, src/app/page.tsx, src/app/review/, public/sounds/.
Shared Contracts (src/types/): Do NOT modify src/types/github.ts or src/types/review.ts without explicitly coordinating across roles.

## 3. Core Data Contract (src/types/review.ts)

All UI components must consume GameReviewPayload exclusively.
export type MoveLabel =
  | "Brilliant"
  | "Best"
  | "Good"
  | "Inaccuracy"
  | "Mistake"
  | "Blunder";

export interface ReviewMove {
  index: number;
  commitSha: string;
  commitMessage: string;
  // Truth Layer
  label: MoveLabel;
  evalScore: number;      // Clamped -10.0 to +10.0
  reason: string;         // Concise explanation citing diff/CI
  bestMove?: string;      // Suggested fix (required for Inaccuracy/Mistake/Blunder)
  codeSnippet?: string;   // Relevant diff hunk for Shiki rendering
  // Show Layer
  fen: string;            // Board FEN after this move
  san: string;            // Standard Algebraic Notation (e.g., "Qh5#")
  fromSquare: string;     // e.g., "d1"
  toSquare: string;       // e.g., "h5"
  soundType: "move" | "capture" | "check" | "blunder" | "mate";
}

export interface GameReviewPayload {
  prTitle: string;
  repo: string;           // "owner/repo"
  prNumber: number;
  headSha: string;
  outcome: "white_win" | "black_mate" | "recovery_win" | "draw";
  accuracyScore: number;  // 0-100
  moves: ReviewMove[];
}

## 4. Deterministic File Placement Mental Model

When creating a new file or folder, agents MUST evaluate the following rules **in order**. Stop at the first match.

### Step 1: Classify the File
1. **Static Asset** (`.mp3`, `.png`, `.svg`, fonts)
   → Place in `public/<asset-type>/` (e.g., `public/sounds/`, `public/images/`).
2. **Next.js Route, Page, Layout, or API Endpoint**
   → Place in `src/app/` following Next.js App Router conventions (`page.tsx`, `layout.tsx`, `route.ts`, `loading.tsx`, `error.tsx`).
   → *Rule:* Keep `page.tsx` and `route.ts` thin. They only orchestrate; never put business logic or large UI trees directly inside them.
3. **Cross-Layer TypeScript Contract** (interfaces/types shared between M1, M2, or M3)
   → Place in `src/types/<domain>.ts`.
   → *Rule:* If a type is only used inside one file or one `lib/<domain>/` folder, keep it local to that file/folder instead of polluting `src/types/`.
4. **Mock / Fixture Data** (sample JSON for offline UI dev or tests)
   → Place in `src/mocks/`.
5. **React UI Component** (contains JSX)
   → If it is a generic, domain-agnostic primitive (Button, Dialog, Slider): place in `src/components/ui/`.
   → If it is a feature component: place in `src/components/`.
   → *Subfolder Rule:* Only create a subfolder (e.g., `src/components/board/`) if a single feature grows beyond **3 tightly coupled sub-components**.
6. **React Client Hook** (uses `useState`, `useEffect`, etc.)
   → Place in `src/hooks/use-<name>.ts`.
7. **Pure Logic, External API, or Data Pipeline** (no React, no JSX)
   → Place in `src/lib/<domain>/` using the Domain Routing Table below.

---

### Step 2: Domain Routing Table (`src/lib/`)

| If the code handles... | Place it in... |
| :--- | :--- |
| GitHub API calls, Octokit, diff parsing, commit grouping | `src/lib/github/` |
| Redis, database, rate-limiting, or persistence | `src/lib/cache/` |
| Heuristics, LLM prompts, Zod schemas, eval math, move labels | `src/lib/scoring/` |
| PGN library, game matching, `chess.js`, FEN/SAN generation | `src/lib/chess/` |
| Generic stateless helpers (e.g., `cn()`, URL parsing, clamping) | `src/lib/utils.ts` |

**When to create a new folder under `src/lib/`:**
Only create `src/lib/<new-domain>/` if the code introduces a **new external service or distinct subsystem** that requires **2 or more files**. Single-file helpers belong in `src/lib/utils.ts`.

---

### Step 3: Naming Conventions
* **All files and folders:** `kebab-case` (e.g., `eval-calculator.ts`, `best-move-card.tsx`).
* **Exceptions:** Next.js reserved files (`page.tsx`, `route.ts`, `layout.tsx`).
* **React Hooks:** Must start with `use-` (e.g., `use-review-player.ts`).
* **Tests (if added):** Co-locate next to the file being tested as `<filename>.test.ts` (e.g., `eval-calculator.test.ts`).

---

### Step 4: Strict Import & Dependency Boundaries
Agents MUST NOT violate these dependency directions:

* `src/types/*` → **Imports nothing** (except other files in `src/types/`).
* `src/lib/github/*` → May import `src/types/*` and `src/lib/utils.ts` only.
* `src/lib/scoring/*` → May import `src/types/*` and `src/lib/utils.ts` only. **NEVER** import `src/lib/chess/`.
* `src/lib/chess/*` → May import `src/types/*` and `src/lib/utils.ts` only. **NEVER** import `src/lib/scoring/` or `src/lib/github/`.
* `src/components/*` & `src/hooks/*` → May import `src/types/*`, `src/mocks/*`, `src/components/*`, `src/hooks/*`, and `src/lib/utils.ts`. **NEVER** import server-only modules (`src/lib/github/`, `src/lib/cache/`, `src/lib/scoring/`).
* `src/app/api/*` → The **only** layer allowed to import and orchestrate across `github`, `cache`, `scoring`, and `chess`.