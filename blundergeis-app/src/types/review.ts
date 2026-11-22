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
