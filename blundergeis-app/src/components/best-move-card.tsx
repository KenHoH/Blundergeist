"use client";

import React from "react";
import { ReviewMove, MoveLabel } from "../types/review";

export interface BestMoveCardProps {
  move: ReviewMove | null;
  prTitle?: string;
}

export function getLabelBadgeStyle(label: MoveLabel): {
  bg: string;
  text: string;
  border: string;
  icon: string;
} {
  switch (label) {
    case "Brilliant":
      return {
        bg: "bg-cyan-500/15 dark:bg-cyan-950/40",
        text: "text-cyan-700 dark:text-cyan-300",
        border: "border-cyan-500/40",
        icon: "!!",
      };
    case "Best":
      return {
        bg: "bg-emerald-500/15 dark:bg-emerald-950/40",
        text: "text-emerald-700 dark:text-emerald-300",
        border: "border-emerald-500/40",
        icon: "*",
      };
    case "Good":
      return {
        bg: "bg-blue-500/15 dark:bg-blue-950/40",
        text: "text-blue-700 dark:text-blue-300",
        border: "border-blue-500/40",
        icon: "+",
      };
    case "Inaccuracy":
      return {
        bg: "bg-yellow-500/15 dark:bg-yellow-950/40",
        text: "text-yellow-700 dark:text-yellow-300",
        border: "border-yellow-500/40",
        icon: "?!",
      };
    case "Mistake":
      return {
        bg: "bg-orange-500/15 dark:bg-orange-950/40",
        text: "text-orange-700 dark:text-orange-300",
        border: "border-orange-500/40",
        icon: "?",
      };
    case "Blunder":
      return {
        bg: "bg-rose-500/15 dark:bg-rose-950/40",
        text: "text-rose-700 dark:text-rose-300",
        border: "border-rose-500/40",
        icon: "??",
      };
  }
}

export function BestMoveCard({ move, prTitle }: BestMoveCardProps) {
  if (!move) {
    return (
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm flex flex-col items-center justify-center text-center text-zinc-500 min-h-[180px]">
        <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          Starting Position
        </h4>
        <p className="text-xs text-zinc-400 mt-1 max-w-xs">
          {prTitle ? `Reviewing: ${prTitle}` : "Use keyboard arrows (← / →) or press Play to start review."}
        </p>
      </div>
    );
  }

  const badge = getLabelBadgeStyle(move.label);
  const isProblematic =
    move.label === "Inaccuracy" || move.label === "Mistake" || move.label === "Blunder";

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm flex flex-col gap-3.5 transition-all">
      {/* Header with Classification Badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
          >
            <span>{badge.icon}</span>
            <span>{move.label}</span>
          </span>
          <span className="font-mono text-xs font-bold text-zinc-800 dark:text-zinc-200">
            {move.san}
          </span>
        </div>
        <span className="font-mono text-[11px] text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
          {move.commitSha}
        </span>
      </div>

      {/* Commit Message */}
      <div>
        <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2">
          {move.commitMessage}
        </p>
      </div>

      {/* LLM / Evaluator Reason */}
      <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/60 p-3 border border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
        <span className="font-semibold text-zinc-800 dark:text-zinc-200 block mb-0.5">
          Analysis
        </span>
        {move.reason}
      </div>

      {/* Suggested Fix (For Inaccuracy / Mistake / Blunder) */}
      {isProblematic && move.bestMove && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-semibold">
            <span>Recommended Best Move</span>
          </div>
          <p className="text-zinc-700 dark:text-zinc-200">{move.bestMove}</p>

          {/* Diff Snippet */}
          {move.codeSnippet && (
            <div className="mt-1 rounded bg-zinc-950 p-2.5 font-mono text-[11px] overflow-x-auto text-zinc-100 leading-normal">
              {move.codeSnippet.split("\n").map((line, i) => {
                const isAdd = line.startsWith("+");
                const isDel = line.startsWith("-");
                return (
                  <div
                    key={i}
                    className={
                      isAdd
                        ? "text-emerald-400 bg-emerald-950/40 -mx-2.5 px-2.5"
                        : isDel
                          ? "text-rose-400 bg-rose-950/40 -mx-2.5 px-2.5"
                          : "text-zinc-400"
                    }
                  >
                    {line}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
