"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Chess, Square } from "chess.js";

export interface EvaluationResult {
  bestMove: string;
  evaluation: string | number;
}

export const getEvaluation = (message: string, turn: string): EvaluationResult => {
  const result: EvaluationResult = { bestMove: "", evaluation: "" };

  if (message.startsWith("bestmove")) {
    result.bestMove = message.split(" ")[1] ?? "";
  }

  if (message.includes("info") && message.includes("score")) {
    const scoreParts = message.split(" ");
    const scoreIndex = scoreParts.indexOf("score") + 2;

    if (scoreParts[scoreIndex - 1] === "cp") {
      let score = parseInt(scoreParts[scoreIndex], 10);
      if (turn !== "b") {
        score = -score;
      }
      result.evaluation = score / 100;
    } else if (scoreParts[scoreIndex - 1] === "mate") {
      const mateIn = parseInt(scoreParts[scoreIndex], 10);
      result.evaluation = `Mate in ${Math.abs(mateIn)}`;
    }
  }

  return result;
};

export function useChessGame(initialFen?: string) {
  const [game, setGame] = useState(() => new Chess(initialFen));
  const stockfishRef = useRef<Worker | null>(null);
  const [bestMove, setBestMove] = useState("");
  const [evaluation, setEvaluation] = useState<string | number>("");
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stockfishWorker = new Worker("/js/stockfish-16.1-lite-single.js");
    stockfishRef.current = stockfishWorker;

    return () => {
      stockfishWorker.terminate();
      stockfishRef.current = null;
    };
  }, []);

  const makeMove = useCallback(
    (sourceSquare: string, targetSquare: string, promotion: string = "q"): boolean => {
      const gameCopy = new Chess(game.fen());

      try {
        const move = gameCopy.move({
          from: sourceSquare,
          to: targetSquare,
          promotion,
        });

        if (!move) return false;

        setGame(gameCopy);
        setLastMove({ from: move.from, to: move.to });

        const worker = stockfishRef.current;
        if (worker) {
          worker.postMessage(`position fen ${gameCopy.fen()}`);
          worker.postMessage("go depth 15");

          worker.onmessage = (event: MessageEvent<string>) => {
            const evalData = getEvaluation(event.data, gameCopy.turn());
            if (evalData.bestMove) setBestMove(evalData.bestMove);
            if (evalData.evaluation !== "") setEvaluation(evalData.evaluation);
          };
        }

        return true;
      } catch (error) {
        if (error instanceof Error) {
          console.error(error.message);
        } else {
          console.error(error);
        }
        return false;
      }
    },
    [game]
  );

  const getPossibleMoves = useCallback(
    (square: string): string[] => {
      try {
        const moves = game.moves({ square: square as Square, verbose: true });
        return moves.map((m) => m.to);
      } catch {
        return [];
      }
    },
    [game]
  );

  const playBestMove = useCallback((): boolean => {
    if (!bestMove || bestMove.length < 4) return false;
    const source = bestMove.slice(0, 2);
    const target = bestMove.slice(2, 4);
    const promotion = bestMove.length > 4 ? bestMove[4] : "q";
    return makeMove(source, target, promotion);
  }, [bestMove, makeMove]);

  const resetGame = useCallback(() => {
    setGame(new Chess());
    setBestMove("");
    setEvaluation("");
    setLastMove(null);
  }, []);

  return {
    game,
    fen: game.fen(),
    turn: game.turn(),
    isGameOver: game.isGameOver(),
    bestMove,
    evaluation,
    lastMove,
    makeMove,
    getPossibleMoves,
    playBestMove,
    resetGame,
  };
}
