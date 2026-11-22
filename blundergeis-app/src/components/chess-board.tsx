"use client";

/* eslint-disable @next/next/no-img-element */
import React, { useState, useSyncExternalStore } from "react";
import { Chessboard } from "react-chessboard";

const emptySubscribe = () => () => {};

type CustomPieceProps = { squareWidth: number };

type PieceType =
  | "wP"
  | "wN"
  | "wB"
  | "wR"
  | "wQ"
  | "wK"
  | "bP"
  | "bN"
  | "bB"
  | "bR"
  | "bQ"
  | "bK";

const animePieces: Record<PieceType, (props: CustomPieceProps) => React.JSX.Element> = {
  wP: ({ squareWidth }: CustomPieceProps) => (
    <img src="/img/pieces/Anime/wP.png" style={{ width: squareWidth, height: squareWidth }} alt="White Pawn" />
  ),
  wN: ({ squareWidth }: CustomPieceProps) => (
    <img src="/img/pieces/Anime/wN.png" style={{ width: squareWidth, height: squareWidth }} alt="White Knight" />
  ),
  wB: ({ squareWidth }: CustomPieceProps) => (
    <img src="/img/pieces/Anime/wB.png" style={{ width: squareWidth, height: squareWidth }} alt="White Bishop" />
  ),
  wR: ({ squareWidth }: CustomPieceProps) => (
    <img src="/img/pieces/Anime/wR.png" style={{ width: squareWidth, height: squareWidth }} alt="White Rook" />
  ),
  wQ: ({ squareWidth }: CustomPieceProps) => (
    <img src="/img/pieces/Anime/wQ.png" style={{ width: squareWidth, height: squareWidth }} alt="White Queen" />
  ),
  wK: ({ squareWidth }: CustomPieceProps) => (
    <img src="/img/pieces/Anime/wK.png" style={{ width: squareWidth, height: squareWidth }} alt="White King" />
  ),
  bP: ({ squareWidth }: CustomPieceProps) => (
    <img src="/img/pieces/Anime/bP.png" style={{ width: squareWidth, height: squareWidth }} alt="Black Pawn" />
  ),
  bN: ({ squareWidth }: CustomPieceProps) => (
    <img src="/img/pieces/Anime/bN.png" style={{ width: squareWidth, height: squareWidth }} alt="Black Knight" />
  ),
  bB: ({ squareWidth }: CustomPieceProps) => (
    <img src="/img/pieces/Anime/bB.png" style={{ width: squareWidth, height: squareWidth }} alt="Black Bishop" />
  ),
  bR: ({ squareWidth }: CustomPieceProps) => (
    <img src="/img/pieces/Anime/bR.png" style={{ width: squareWidth, height: squareWidth }} alt="Black Rook" />
  ),
  bQ: ({ squareWidth }: CustomPieceProps) => (
    <img src="/img/pieces/Anime/bQ.png" style={{ width: squareWidth, height: squareWidth }} alt="Black Queen" />
  ),
  bK: ({ squareWidth }: CustomPieceProps) => (
    <img src="/img/pieces/Anime/bK.png" style={{ width: squareWidth, height: squareWidth }} alt="Black King" />
  ),
};

const standardPieces: Record<PieceType, (props: CustomPieceProps) => React.JSX.Element> = {
  wP: ({ squareWidth }: CustomPieceProps) => (
    <img src="/img/pieces/wP.png" style={{ width: squareWidth, height: squareWidth }} alt="White Pawn" />
  ),
  wN: ({ squareWidth }: CustomPieceProps) => (
    <img src="/img/pieces/wN.png" style={{ width: squareWidth, height: squareWidth }} alt="White Knight" />
  ),
  wB: ({ squareWidth }: CustomPieceProps) => (
    <img src="/img/pieces/wB.png" style={{ width: squareWidth, height: squareWidth }} alt="White Bishop" />
  ),
  wR: ({ squareWidth }: CustomPieceProps) => (
    <img src="/img/pieces/wR.png" style={{ width: squareWidth, height: squareWidth }} alt="White Rook" />
  ),
  wQ: ({ squareWidth }: CustomPieceProps) => (
    <img src="/img/pieces/wQ.png" style={{ width: squareWidth, height: squareWidth }} alt="White Queen" />
  ),
  wK: ({ squareWidth }: CustomPieceProps) => (
    <img src="/img/pieces/wK.png" style={{ width: squareWidth, height: squareWidth }} alt="White King" />
  ),
  bP: ({ squareWidth }: CustomPieceProps) => (
    <img src="/img/pieces/bP.png" style={{ width: squareWidth, height: squareWidth }} alt="Black Pawn" />
  ),
  bN: ({ squareWidth }: CustomPieceProps) => (
    <img src="/img/pieces/bN.png" style={{ width: squareWidth, height: squareWidth }} alt="Black Knight" />
  ),
  bB: ({ squareWidth }: CustomPieceProps) => (
    <img src="/img/pieces/bB.png" style={{ width: squareWidth, height: squareWidth }} alt="Black Bishop" />
  ),
  bR: ({ squareWidth }: CustomPieceProps) => (
    <img src="/img/pieces/bR.png" style={{ width: squareWidth, height: squareWidth }} alt="Black Rook" />
  ),
  bQ: ({ squareWidth }: CustomPieceProps) => (
    <img src="/img/pieces/bQ.png" style={{ width: squareWidth, height: squareWidth }} alt="Black Queen" />
  ),
  bK: ({ squareWidth }: CustomPieceProps) => (
    <img src="/img/pieces/bK.png" style={{ width: squareWidth, height: squareWidth }} alt="Black King" />
  ),
};

export type PieceTheme = "anime" | "standard" | "classic";

export interface ChessBoardProps {
  position: string;
  onPieceDrop: (sourceSquare: string, targetSquare: string) => boolean;
  boardWidth?: number;
  theme?: PieceTheme;
  animationDuration?: number;
  lastMove?: { from: string; to: string } | null;
  getPossibleMoves?: (square: string) => string[];
  darkSquareColor?: string;
  lightSquareColor?: string;
}

export function ChessBoard({
  position,
  onPieceDrop,
  boardWidth = 500,
  theme = "anime",
  animationDuration = 350,
  lastMove,
  getPossibleMoves,
  darkSquareColor,
  lightSquareColor,
}: ChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<string[]>([]);

  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!isMounted) {
    return (
      <div
        style={{ width: boardWidth, height: boardWidth }}
        className="flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-lg animate-pulse"
      >
        <span className="text-sm text-zinc-400">Loading board...</span>
      </div>
    );
  }

  const resolvedPieces =
    theme === "anime"
      ? animePieces
      : theme === "standard"
        ? standardPieces
        : undefined;

  const handleSquareClick = (square: string) => {
    // If clicking a valid target square, make the move (triggers smooth sliding animation)
    if (selectedSquare) {
      if (possibleMoves.includes(square)) {
        onPieceDrop(selectedSquare, square);
        setSelectedSquare(null);
        setPossibleMoves([]);
        return;
      }
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setPossibleMoves([]);
        return;
      }
    }

    // Select a square if it has legal moves
    if (getPossibleMoves) {
      const moves = getPossibleMoves(square);
      if (moves.length > 0) {
        setSelectedSquare(square);
        setPossibleMoves(moves);
        return;
      }
    }

    setSelectedSquare(null);
    setPossibleMoves([]);
  };

  // Build highlights for selected square, destination dots, and last move
  const customSquareStyles: Record<string, React.CSSProperties> = {};

  if (lastMove) {
    customSquareStyles[lastMove.from] = {
      backgroundColor: "rgba(234, 179, 8, 0.25)",
    };
    customSquareStyles[lastMove.to] = {
      backgroundColor: "rgba(234, 179, 8, 0.35)",
    };
  }

  if (selectedSquare) {
    customSquareStyles[selectedSquare] = {
      backgroundColor: "rgba(16, 185, 129, 0.45)",
    };
    for (const moveSq of possibleMoves) {
      customSquareStyles[moveSq] = {
        background: "radial-gradient(circle, rgba(16, 185, 129, 0.55) 24%, transparent 25%)",
        borderRadius: "50%",
      };
    }
  }

  return (
    <div className="overflow-hidden rounded-lg shadow-md border border-zinc-200 dark:border-zinc-800">
      <Chessboard
        position={position}
        onPieceDrop={(source, target) => {
          setSelectedSquare(null);
          setPossibleMoves([]);
          return onPieceDrop(source, target);
        }}
        onSquareClick={handleSquareClick}
        boardWidth={boardWidth}
        customPieces={resolvedPieces}
        animationDuration={animationDuration}
        customSquareStyles={customSquareStyles}
        customDarkSquareStyle={
          darkSquareColor ? { backgroundColor: darkSquareColor } : undefined
        }
        customLightSquareStyle={
          lightSquareColor ? { backgroundColor: lightSquareColor } : undefined
        }
      />
    </div>
  );
}
