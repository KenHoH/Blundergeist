"use client";

import React from "react";

export interface EvalBarProps {
  score: number; // Clamped -10.0 to +10.0
  height?: number | string;
}

export function EvalBar({ score, height = 480 }: EvalBarProps) {
  // Clamp score between -10 and +10
  const clamped = Math.max(-10, Math.min(10, score));

  // Calculate percentage of white (bottom) vs black (top)
  // At score 0 -> 50%
  // At score +10 -> 95%
  // At score -10 -> 5%
  const whitePercent = Math.min(95, Math.max(5, 50 + (clamped / 10) * 45));
  const blackPercent = 100 - whitePercent;

  const displayScore =
    clamped > 0 ? `+${clamped.toFixed(1)}` : clamped.toFixed(1);

  return (
    <div
      style={{ height }}
      className="relative w-8 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-700 shadow-inner flex flex-col justify-between select-none"
      title={`Evaluation: ${displayScore}`}
    >
      {/* Black's section (Top) */}
      <div
        className="w-full bg-zinc-800 transition-all duration-300 ease-out flex items-start justify-center pt-1.5"
        style={{ height: `${blackPercent}%` }}
      >
        {clamped < 0 && (
          <span className="font-mono text-[10px] font-bold text-zinc-300 drop-shadow">
            {displayScore}
          </span>
        )}
      </div>

      {/* White's section (Bottom) */}
      <div
        className="w-full bg-zinc-100 transition-all duration-300 ease-out flex items-end justify-center pb-1.5"
        style={{ height: `${whitePercent}%` }}
      >
        {clamped >= 0 && (
          <span className="font-mono text-[10px] font-bold text-zinc-800 drop-shadow">
            {displayScore}
          </span>
        )}
      </div>

      {/* Center 0.0 marker line */}
      <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-red-500/40 pointer-events-none" />
    </div>
  );
}
