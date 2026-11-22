import { describe, it, expect } from "vitest";
import { createRequire } from "module";
import { Chess } from "chess.js";

const require = createRequire(import.meta.url);
const gamesData = require("./games.json");

describe("games.json integrity", () => {
  const games = gamesData.games;

  it("has exactly 72 games", () => {
    expect(games).toHaveLength(72);
  });

  it("every game has required fields", () => {
    games.forEach((g: any) => {
      expect(g.id).toBeTruthy();
      expect(g.outcome).toBeTruthy();
      expect(g.pgn).toBeTruthy();
      expect(g.description).toBeTruthy();
      expect(typeof g.moveCount).toBe("number");
    });
  });

  it("every outcome is valid", () => {
    const validOutcomes = ["white_win", "black_mate", "draw"];
    games.forEach((g: any) => {
      expect(validOutcomes).toContain(g.outcome);
    });
  });

  it("every PGN parses in chess.js", () => {
    games.forEach((g: any) => {
      const chess = new Chess();
      expect(() => chess.loadPgn(g.pgn)).not.toThrow();
    });
  });

  it("has exactly 3 games per moveCount+outcome bucket", () => {
    const buckets: Record<string, number> = {};
    games.forEach((g: any) => {
      const key = `${g.moveCount}-${g.outcome}`;
      buckets[key] = (buckets[key] ?? 0) + 1;
    });
    Object.entries(buckets).forEach(([, count]) => {
      expect(count).toBe(3);
    });
  });

  it("covers moveCount range 3-10", () => {
    const counts = [...new Set(games.map((g: any) => g.moveCount))].sort((a, b) => (a as number) - (b as number));
    expect(counts).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("covers all 3 outcomes per moveCount", () => {
    const moveCounts = [3, 4, 5, 6, 7, 8, 9, 10];
    const outcomes = ["white_win", "black_mate", "draw"];
    moveCounts.forEach((mc) => {
      outcomes.forEach((outcome) => {
        const count = games.filter(
          (g: any) => g.moveCount === mc && g.outcome === outcome,
        ).length;
        expect(count).toBe(3);
      });
    });
  });
});
