import { Chess } from "chess.js";
import type { GameReviewPayload } from "@/types/review";
import gamesData from "./games.json";

// ---------------------------------------------------------------------------
// Game Matcher
// Picks a complete PGN game (verified to end in checkmate or draw) whose
// outcome matches the PR outcome and whose length is the closest fit for
// the PR's commit count.
//
// Every game in the library genuinely ends in a terminal position:
//   white_win  → White delivers checkmate
//   black_mate → Black delivers checkmate
//   draw       → stalemate or threefold repetition
//
// pgnToMoves samples evenly-spaced plies from the game and ALWAYS maps the
// final commit onto the game's last ply (the checkmate/draw move), so the
// board always reaches a real end result.
// ---------------------------------------------------------------------------

type Outcome = GameReviewPayload["outcome"];

interface GameEntry {
  id: string;
  plies: number; // total half-moves in this complete game
  outcome: string;
  description: string;
  pgn: string;
}

// PR commit counts are capped to this range after grouping
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
 * Picks a complete PGN game from games.json that matches the PR outcome and
 * has enough plies for the commit count, preferring the closest length.
 *
 * Selection strategy:
 *   1. Filter to games with the matching outcome and plies >= commitCount.
 *   2. Among those, keep the ones with the smallest surplus (closest fit),
 *      so the sampled board moves are as evenly spread as possible.
 *   3. If no outcome match, relax the outcome filter (any game with
 *      enough plies) — the outcome banner is still shown by the UI.
 *   4. Pick deterministically using prNumber % pool.length so the same PR
 *      always gets the same game, but different PRs vary.
 *
 * @param commitCount - Number of PR moves/commits (capped 3–10 by grouping)
 * @param outcome     - PR outcome from the Truth Layer
 * @param prNumber    - Stable seed for pool selection
 * @returns The matched complete PGN string (plies >= commitCount)
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

  const pickFromPool = (pool: typeof withPlies): string | null => {
    if (pool.length === 0) return null;
    // Closest fit: smallest surplus over commitCount
    const minSurplus = Math.min(...pool.map((g) => g.plies - clampedCount));
    const closest = pool.filter((g) => g.plies - clampedCount === minSurplus);
    return closest[prNumber % closest.length].pgn;
  };

  // Pass 1: matching outcome with enough plies, closest length
  let pool = withPlies.filter(
    (g) => g.outcome === targetOutcome && g.plies >= clampedCount
  );
  const pass1 = pickFromPool(pool);
  if (pass1) return pass1;

  // Pass 2: relax outcome — any game with enough plies
  pool = withPlies.filter((g) => g.plies >= clampedCount);
  const pass2 = pickFromPool(pool);
  if (pass2) return pass2;

  // Pass 3: last resort — the longest game available regardless of outcome
  const maxPlies = Math.max(...withPlies.map((g) => g.plies));
  pool = withPlies.filter((g) => g.plies === maxPlies);
  const pass3 = pickFromPool(pool);
  if (pass3) return pass3;

  throw new Error(
    `[match-game] No games found in library for commitCount=${clampedCount}, ` +
    `outcome=${targetOutcome}`
  );
}
