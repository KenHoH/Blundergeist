"use client";

import React from "react";
import { GameReviewPayload, MoveLabel } from "../types/review";
import { getLabelBadgeStyle } from "./best-move-card";

export interface SummaryModalProps {
  payload: GameReviewPayload;
  isOpen: boolean;
  onClose: () => void;
  onReplay: () => void;
}

export function SummaryModal({
  payload,
  isOpen,
  onClose,
  onReplay,
}: SummaryModalProps) {
  if (!isOpen) return null;

  // Count occurrences of each label
  const labelCounts: Record<MoveLabel, number> = {
    Brilliant: 0,
    Best: 0,
    Good: 0,
    Inaccuracy: 0,
    Mistake: 0,
    Blunder: 0,
  };

  payload.moves.forEach((m) => {
    labelCounts[m.label] = (labelCounts[m.label] || 0) + 1;
  });

  const getOutcomeBanner = () => {
    switch (payload.outcome) {
      case "white_win":
        return {
          title: "PR Approved & Passing",
          subtitle: "All tests pass. Clean implementation ready to merge.",
          badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
        };
      case "recovery_win":
        return {
          title: "Critical Issues Mitigated",
          subtitle: "Blunders were caught and successfully remediated before landing.",
          badge: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40",
        };
      case "black_mate":
        return {
          title: "Merge Blocked (Fatal Issues)",
          subtitle: "Unresolved blunders broke production CI checks.",
          badge: "bg-rose-500/20 text-rose-400 border-rose-500/40",
        };
      case "draw":
        return {
          title: "PR Stalled / Requires Changes",
          subtitle: "Reviewers requested architectural revisions.",
          badge: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
        };
    }
  };

  const outcome = getOutcomeBanner();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl flex flex-col gap-5">
        {/* Outcome Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
              {outcome.title}
            </h2>
            <p className="text-xs text-zinc-500">{payload.repo} #{payload.prNumber}</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg"
          >
            ✕
          </button>
        </div>

        {/* Accuracy Score Card */}
        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-4 border border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
          <div>
            <span className="text-xs uppercase font-semibold text-zinc-500">
              PR Code Quality Score
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 font-mono">
                {payload.accuracyScore}%
              </span>
              <span className="text-xs text-zinc-400">accuracy</span>
            </div>
          </div>

          <div
            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${outcome.badge}`}
          >
            {payload.outcome.replace("_", " ").toUpperCase()}
          </div>
        </div>

        {/* Move Classification Breakdown */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Commit Classifications
          </span>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                "Brilliant",
                "Best",
                "Good",
                "Inaccuracy",
                "Mistake",
                "Blunder",
              ] as MoveLabel[]
            ).map((lbl) => {
              const b = getLabelBadgeStyle(lbl);
              return (
                <div
                  key={lbl}
                  className={`rounded-lg p-2 border flex items-center justify-between text-xs ${b.bg} ${b.border}`}
                >
                  <span className={`font-semibold ${b.text}`}>
                    {b.icon} {lbl}
                  </span>
                  <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                    {labelCounts[lbl]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => {
              onClose();
              onReplay();
            }}
            className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 text-xs transition shadow-sm"
          >
            Replay Review
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-semibold py-2.5 text-xs transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
