import { Chess } from "chess.js";
import type { GameReviewPayload } from "@/types/review";
import gamesData from "./games.json";

// ---------------------------------------------------------------------------
// Game Matcher
// Picks a PGN from the library that has enough plies for the PR's commit
// count and whose outcome matches the PR outcome.
//
// Terminology:
//   plyCount  — number of individual half-moves (one per commit in the PR)
//   moveCount — full chess move pairs stored in games.json (1 pair = 2 plies)
// ---------------------------------------------------------------------------

type Outcome = GameReviewPayload["outcome"];

interface GameEntry {
  id: string;
  moveCount: number; // full chess move pairs in this PGN
  outcome: string;
  description: string;
  pgn: string;
}

// PR commit counts are capped to this ply range after grouping
const MIN_PLIES = 3;
const MAX_PLIES = 10;

/**
 * Maps a GameReviewPayload outcome to the game library outcome string.
 * "recovery_win" maps to "white_win" since it ends in White winning.
 */
function normalizeOutcome(outcome: Outcome): string {
  if (outcome === "recovery_win") return "white_win";
  return outcome;
}

/** Returns the number of plies (half-moves) in a PGN string via chess.js. */
function countPlies(pgn: string): number {
  const chess = new Chess();
  chess.loadPgn(pgn);
  return chess.history().length;
}

/**
 * Picks a PGN game from games.json that has enough plies for the PR's
 * commit count and whose outcome matches.
 *
 * Selection strategy (Option B — pool per bucket):
 *   1. Filter to games with plyCount >= commitCount + matching outcome.
 *   2. If no match, relax outcome — any game with enough plies.
 *   3. If still no match, pick the game with the most plies available.
 *   4. Pick deterministically using prNumber % pool.length so the same PR
 *      always gets the same game, but different PRs vary.
 *
 * pgnToMoves will slice the PGN to exactly commitCount plies.
 *
 * @param commitCount - Number of PR moves/commits (capped 3–10 by route)
 * @param outcome     - PR outcome from the Truth Layer
 * @param prNumber    - Stable seed for pool selection
 * @returns The matched PGN string (may have more plies than needed)
 */
export function matchGame(
  commitCount: number,
  outcome: Outcome,
  prNumber: number
): string {
  const games = gamesData.games as GameEntry[];
  const targetOutcome = normalizeOutcome(outcome);
  const clampedCount = Math.max(MIN_PLIES, Math.min(MAX_PLIES, commitCount));

  // Pre-compute ply counts once
  const withPlies = games.map((g) => ({
    ...g,
    plies: countPlies(g.pgn),
  }));

  // Pass 1: enough plies + matching outcome
  let pool = withPlies.filter(
    (g) => g.plies >= clampedCount && g.outcome === targetOutcome
  );

  // Pass 2: relax outcome — any game with enough plies
  if (pool.length === 0) {
    pool = withPlies.filter((g) => g.plies >= clampedCount);
  }

  // Pass 3: pick the game(s) with the most plies as last resort
  if (pool.length === 0) {
    const maxPlies = Math.max(...withPlies.map((g) => g.plies));
    pool = withPlies.filter(
      (g) => g.plies === maxPlies && g.outcome === targetOutcome
    );
    if (pool.length === 0) {
      pool = withPlies.filter((g) => g.plies === maxPlies);
    }
  }

  if (pool.length === 0) {
    throw new Error(
      `[match-game] No games found in library for commitCount=${clampedCount}, ` +
      `outcome=${targetOutcome}`
    );
  }

  // Stable but varied: same PR always picks the same game
  const selected = pool[prNumber % pool.length];
  return selected.pgn;
}
