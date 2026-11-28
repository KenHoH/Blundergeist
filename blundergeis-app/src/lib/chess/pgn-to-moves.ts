import { Chess } from "chess.js";
import type { MoveLabel } from "@/types/review";

// ---------------------------------------------------------------------------
// PGN → Move Data
// Converts a complete (terminal) PGN game into per-commit show-layer data.
//
// Key guarantee: the last commit ALWAYS maps to the game's final ply, so
// the board always reaches checkmate or draw — never stops mid-game.
//
// When the game has more plies than commits, N evenly-spaced plies are
// sampled: indices 0, step, 2*step, … and the last ply is always forced
// as the final sample.  When the game has fewer plies than commits, the
// last game ply is repeated for the remaining commits.
// ---------------------------------------------------------------------------

/** Sound type mapped from the move label (Truth Layer → Show Layer). */
export type SoundType = "move" | "capture" | "check" | "blunder" | "mate";

/** Show-layer data for one board move. */
export interface ChessMove {
  /** 0-based index matching ReviewMove.index */
  index: number;
  /** FEN string of the board after this move */
  fen: string;
  /** Standard Algebraic Notation, e.g. "Nf3" */
  san: string;
  /** Source square, e.g. "g1" */
  fromSquare: string;
  /** Target square, e.g. "f3" */
  toSquare: string;
  /** Sound to play when this move is revealed */
  soundType: SoundType;
}

// ---------------------------------------------------------------------------
// Label → SoundType mapping
// ---------------------------------------------------------------------------

function labelToSoundOverride(label: MoveLabel): SoundType | null {
  switch (label) {
    case "Blunder":
      return "blunder";
    case "Brilliant":
    case "Best":
    case "Good":
    case "Inaccuracy":
    case "Mistake":
      return null; // let chess.js flags decide
  }
}

function flagsToSoundType(flags: string, isCheckmate: boolean): SoundType {
  if (isCheckmate) return "mate";
  if (flags.includes("ch") || flags.includes("+")) return "check";
  if (flags.includes("c") || flags.includes("e")) return "capture";
  return "move";
}

// ---------------------------------------------------------------------------
// Sampling helpers
// ---------------------------------------------------------------------------

/**
 * Returns `n` indices into an array of length `total`, always including 0
 * and total-1 (the last element), evenly distributed in between.
 *
 * Example: total=14, n=4 → [0, 4, 9, 13]
 */
function sampleIndices(total: number, n: number): number[] {
  if (n >= total) {
    // More commits than plies: return 0..total-1 (clamped)
    return Array.from({ length: n }, (_, i) => Math.min(i, total - 1));
  }
  if (n === 1) return [total - 1];

  const indices: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i === n - 1) {
      indices.push(total - 1); // always land on the last ply
    } else {
      indices.push(Math.round((i / (n - 1)) * (total - 1)));
    }
  }
  return indices;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parses a complete PGN game and maps each commit to a show-layer move.
 *
 * @param pgn    - Complete PGN string from games.json (must end in a terminal
 *                 position: checkmate or draw).
 * @param labels - Truth Layer labels in commit order. Length = number of PR
 *                 commits/moves. Used to override SoundType.
 * @returns Array of ChessMove in commit order (0-based index), where the
 *          last entry always corresponds to the game's terminal position.
 * @throws If the PGN is invalid or empty.
 */
export function pgnToMoves(pgn: string, labels: MoveLabel[]): ChessMove[] {
  const chess = new Chess();

  try {
    chess.loadPgn(pgn);
  } catch (err) {
    throw new Error(
      `[pgn-to-moves] Failed to parse PGN: ${String(err)}\n${pgn}`
    );
  }

  const history = chess.history({ verbose: true });

  if (history.length === 0) {
    throw new Error(`[pgn-to-moves] PGN has no moves:\n${pgn}`);
  }

  const n = labels.length;
  const indices = sampleIndices(history.length, n);

interface PlyData {
  san: string;
  from: string;
  to: string;
  flags: string;
  fenAfter: string;
  isCheckmate: boolean;
}

  // Replay from scratch to capture FEN after each ply
  const replay = new Chess();
  const replayedMoves: PlyData[] = [];

  for (let i = 0; i < history.length; i++) {
    replay.move(history[i].san);
    replayedMoves.push({
      san: history[i].san,
      from: history[i].from,
      to: history[i].to,
      flags: history[i].flags,
      fenAfter: replay.fen(),
      isCheckmate: replay.isCheckmate(),
    });
  }

  return indices.map((plyIndex, i) => {
    const ply = replayedMoves[plyIndex];
    const label = labels[i];
    const override = labelToSoundOverride(label);
    const soundType = override ?? flagsToSoundType(ply.flags, ply.isCheckmate);

    return {
      index:      i,
      fen:        ply.fenAfter,
      san:        ply.san,
      fromSquare: ply.from,
      toSquare:   ply.to,
      soundType,
    };
  });
}
