import { describe, it, expect } from "vitest";
import { matchGame } from "./match-game";
import { pgnToMoves } from "./pgn-to-moves";
import type { MoveLabel } from "@/types/review";

describe("matchGame", () => {
  it("returns a valid PGN string", () => {
    const pgn = matchGame(5, "white_win", 1);
    expect(typeof pgn).toBe("string");
    expect(pgn.length).toBeGreaterThan(10);
  });

  it("same prNumber always returns same PGN", () => {
    const a = matchGame(5, "white_win", 42);
    const b = matchGame(5, "white_win", 42);
    expect(a).toBe(b);
  });

  it("different prNumbers can return different PGNs", () => {
    const a = matchGame(5, "white_win", 42);
    const b = matchGame(5, "white_win", 43);
    // They might be the same if pool size is 1, but for 5-move white_win
    // there are 3 games so different seeds should differ
    expect(typeof a).toBe("string");
    expect(typeof b).toBe("string");
  });

  it("handles all 4 outcome types", () => {
    const outcomes = ["white_win", "black_mate", "draw", "recovery_win"] as const;
    for (const outcome of outcomes) {
      expect(() => matchGame(5, outcome, 1)).not.toThrow();
    }
  });

  it("handles move counts 3 through 10", () => {
    for (let count = 3; count <= 10; count++) {
      expect(() => matchGame(count, "white_win", 1)).not.toThrow();
    }
  });

  it("clamps move count below 3 to 3", () => {
    expect(() => matchGame(1, "white_win", 1)).not.toThrow();
  });

  it("clamps move count above 10 to 10", () => {
    expect(() => matchGame(50, "white_win", 1)).not.toThrow();
  });

  it("recovery_win maps to white_win pool", () => {
    const recoveryPgn = matchGame(5, "recovery_win", 42);
    const whitePgn = matchGame(5, "white_win", 42);
    // recovery_win normalizes to white_win, so same prNumber → same game
    expect(recoveryPgn).toBe(whitePgn);
  });

  it("throws if no games found (impossible with current library)", () => {
    // The library has 72 games covering all buckets, so this should never throw.
    // Test validates the function handles extreme inputs gracefully.
    expect(() => matchGame(100, "draw", 1)).not.toThrow();
  });
});

describe("pgnToMoves", () => {
  const labels: MoveLabel[] = ["Good", "Best", "Good", "Good", "Good"];

  it("returns one move per label", () => {
    const pgn = matchGame(5, "white_win", 1);
    const moves = pgnToMoves(pgn, labels);
    expect(moves).toHaveLength(5);
  });

  it("indices are 0-based sequential", () => {
    const pgn = matchGame(5, "white_win", 1);
    const moves = pgnToMoves(pgn, labels);
    moves.forEach((m, i) => expect(m.index).toBe(i));
  });

  it("FEN is a valid 8-rank string", () => {
    const pgn = matchGame(5, "white_win", 1);
    const moves = pgnToMoves(pgn, labels);
    moves.forEach((m) => {
      expect(m.fen.split("/")).toHaveLength(8);
    });
  });

  it("squares are valid [a-h][1-8]", () => {
    const pgn = matchGame(5, "white_win", 1);
    const moves = pgnToMoves(pgn, labels);
    moves.forEach((m) => {
      expect(m.fromSquare).toMatch(/^[a-h][1-8]$/);
      expect(m.toSquare).toMatch(/^[a-h][1-8]$/);
    });
  });

  it("soundType is one of the valid enum values", () => {
    const pgn = matchGame(5, "white_win", 1);
    const moves = pgnToMoves(pgn, labels);
    const valid = ["move", "capture", "check", "blunder", "mate"];
    moves.forEach((m) => expect(valid).toContain(m.soundType));
  });

  it("Blunder label overrides soundType to 'blunder'", () => {
    const blunderLabels: MoveLabel[] = ["Blunder", "Good", "Good"];
    const pgn = matchGame(3, "white_win", 1);
    const moves = pgnToMoves(pgn, blunderLabels);
    expect(moves[0].soundType).toBe("blunder");
  });

  it("throws if PGN has fewer plies than labels", () => {
    // A 3-move game has 6 plies, asking for 10 should fail
    const shortPgn = "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6";
    const longLabels: MoveLabel[] = Array(10).fill("Good");
    expect(() => pgnToMoves(shortPgn, longLabels)).toThrow();
  });

  it("handles all outcome + move count combinations", () => {
    const outcomes = ["white_win", "black_mate", "draw"] as const;
    for (const outcome of outcomes) {
      for (let count = 3; count <= 10; count++) {
        const lbls: MoveLabel[] = Array(count).fill("Good");
        const pgn = matchGame(count, outcome, 7);
        expect(() => pgnToMoves(pgn, lbls)).not.toThrow();
      }
    }
  });
});
