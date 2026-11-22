"use client";

import React from "react";
import { ChessBoard, PieceTheme } from "./chess-board";
import { EvalBar } from "./eval-bar";
import { useBoardTheme } from "@/hooks/use-board-theme";

export interface ChessBoardPanelProps {
  fen: string;
  evalScore: number;
  lastMove?: { from: string; to: string } | null;
  onPieceDrop?: (sourceSquare: string, targetSquare: string) => boolean;
  getPossibleMoves?: (square: string) => string[];
  boardWidth?: number;
  theme?: PieceTheme;
}

export function ChessBoardPanel({
  fen,
  evalScore,
  lastMove,
  onPieceDrop,
  getPossibleMoves,
  boardWidth = 480,
  theme = "anime",
}: ChessBoardPanelProps) {
  const { colors, activePreset, presets, selectPreset } = useBoardTheme();

  return (
    <div className="flex flex-col gap-2">
      {/* Chess board color */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        <span className="text-xs text-zinc-400 font-semibold tracking-wide">
          Chess board color
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {Object.entries(presets).map(([key, p]) => (
            <button
              key={key}
              onClick={() => selectPreset(key)}
              title={p.name}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition ${
                activePreset === key
                  ? "bg-zinc-800 text-zinc-100 border-emerald-500 ring-1 ring-emerald-500"
                  : "bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700"
              }`}
            >
              <span className="h-3 w-3 rounded-full overflow-hidden flex border border-black/20 shrink-0">
                <span className="w-1/2 h-full" style={{ backgroundColor: p.light }} />
                <span className="w-1/2 h-full" style={{ backgroundColor: p.dark }} />
              </span>
              <span>{p.name.startsWith("Tournament") ? "Tourn..." : p.name.split(" ")[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Board with Vertical Eval Bar */}
      <div className="flex items-center gap-3">
        <EvalBar score={evalScore} height={boardWidth} />

        <ChessBoard
          position={fen}
          onPieceDrop={onPieceDrop ?? (() => false)}
          boardWidth={boardWidth}
          theme={theme}
          animationDuration={350}
          lastMove={lastMove}
          getPossibleMoves={getPossibleMoves}
          darkSquareColor={colors.dark}
          lightSquareColor={colors.light}
        />
      </div>
    </div>
  );
}
