import { Chess } from "chess.js";
import type { MoveLabel } from "@/types/review";

// ---------------------------------------------------------------------------
// PGN → Move Data
// Converts a PGN string into per-move show-layer data the UI needs.
// chess.js handles all move generation and validation.
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
// Blunder and Mate get special sounds; everything else falls back on
// whether the move was a capture or check per chess.js flags.
// ---------------------------------------------------------------------------

/**
 * Maps a Truth Layer label to a SoundType override.
 * Returns null when the label has no override — the chess move flags
 * (capture / check / checkmate) are used instead.
 */
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

/**
 * Derives a SoundType from chess.js move flags when no label override applies.
 * Priority: mate > check > capture > move
 */
function flagsToSoundType(flags: string, isCheckmate: boolean): SoundType {
  if (isCheckmate) return "mate";
  if (flags.includes("ch") || flags.includes("+")) return "check";
  // chess.js capture flags: 'c' (capture) or 'e' (en passant)
  if (flags.includes("c") || flags.includes("e")) return "capture";
  return "move";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parses a PGN string and extracts per-move show-layer data.
 *
 * @param pgn    - Full PGN string from games.json
 * @param labels - Truth Layer labels in move order. Length must match the
 *                 number of moves in the PGN. Used to override SoundType.
 * @returns Array of ChessMove in move order (0-based index).
 * @throws If the PGN is invalid or move count doesn't match labels length.
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

  // Replay the game from the start, collecting state after each move
  const history = chess.history({ verbose: true });

  if (history.length < labels.length) {
    throw new Error(
      `[pgn-to-moves] PGN has only ${history.length} plies but received ` +
      `${labels.length} labels — not enough moves in this game.`
    );
  }

  // Trim to exactly labels.length plies. The PGN library stores games in
  // full chess moves (pairs of plies), so a 5-move PGN has 10 plies.
  // We only need as many plies as the PR has commits.
  const trimmedHistory = history.slice(0, labels.length);

  // Replay from scratch so we can capture FEN after each move
  const replay = new Chess();
  const moves: ChessMove[] = [];

  for (let i = 0; i < trimmedHistory.length; i++) {
    const historyMove = trimmedHistory[i];
    replay.move(historyMove.san);

    const isCheckmate = replay.isCheckmate();
    const label = labels[i];
    const override = labelToSoundOverride(label);
    const soundType = override ?? flagsToSoundType(historyMove.flags, isCheckmate);

    moves.push({
      index:      i,
      fen:        replay.fen(),
      san:        historyMove.san,
      fromSquare: historyMove.from,
      toSquare:   historyMove.to,
      soundType,
    });
  }

  return moves;
}
