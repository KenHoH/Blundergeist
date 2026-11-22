"use client";

import { useState, useEffect, useCallback } from "react";
import { ReviewMove } from "../types/review";
import { useChessSounds } from "./use-chess-sounds";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function useReviewPlayer(moves: ReviewMove[], autoPlayIntervalMs = 1600) {
  const [currentIndex, setCurrentIndex] = useState(0); // 0 = start of game
  const [isPlaying, setIsPlaying] = useState(false);
  const { playSound } = useChessSounds();

  const currentMove: ReviewMove | null =
    currentIndex > 0 && currentIndex <= moves.length ? moves[currentIndex - 1] : null;

  const currentFen = currentMove ? currentMove.fen : STARTING_FEN;
  const currentEval = currentMove ? currentMove.evalScore : 0;
  const lastBoardMove = currentMove
    ? { from: currentMove.fromSquare, to: currentMove.toSquare }
    : null;

  const goToMove = useCallback(
    (index: number) => {
      const target = Math.max(0, Math.min(moves.length, index));
      setCurrentIndex(target);

      if (target > 0) {
        const move = moves[target - 1];
        if (move?.soundType) {
          playSound(move.soundType);
        }
      } else {
        playSound("move");
      }
    },
    [moves, playSound]
  );

  const nextMove = useCallback(() => {
    if (currentIndex < moves.length) {
      goToMove(currentIndex + 1);
    } else {
      setIsPlaying(false);
    }
  }, [currentIndex, goToMove, moves.length]);

  const prevMove = useCallback(() => {
    if (currentIndex > 0) {
      goToMove(currentIndex - 1);
    }
  }, [currentIndex, goToMove]);

  const firstMove = useCallback(() => {
    goToMove(0);
  }, [goToMove]);

  const lastMove = useCallback(() => {
    goToMove(moves.length);
  }, [goToMove, moves.length]);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      if (!prev && currentIndex >= moves.length) {
        goToMove(0);
      }
      return !prev;
    });
  }, [currentIndex, goToMove, moves.length]);

  // Autoplay interval timer
  useEffect(() => {
    if (!isPlaying) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev < moves.length) {
          const nextIdx = prev + 1;
          const move = moves[nextIdx - 1];
          if (move?.soundType) {
            playSound(move.soundType);
          }
          return nextIdx;
        } else {
          setIsPlaying(false);
          return prev;
        }
      });
    }, autoPlayIntervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, autoPlayIntervalMs, moves, playSound]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        nextMove();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevMove();
      } else if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextMove, prevMove, togglePlay]);

  return {
    currentIndex,
    totalMoves: moves.length,
    currentMove,
    currentFen,
    currentEval,
    lastBoardMove,
    isPlaying,
    goToMove,
    nextMove,
    prevMove,
    firstMove,
    lastMove,
    togglePlay,
  };
}
