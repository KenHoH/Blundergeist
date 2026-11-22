"use client";

import React, { useRef, useEffect } from "react";
import { ReviewMove } from "../types/review";
import { getLabelBadgeStyle } from "./best-move-card";

export interface MoveListProps {
  moves: ReviewMove[];
  currentIndex: number;
  isPlaying: boolean;
  onSelectMove: (index: number) => void;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  onTogglePlay: () => void;
  onOpenSummary?: () => void;
}

export function MoveList({
  moves,
  currentIndex,
  isPlaying,
  onSelectMove,
  onFirst,
  onPrev,
  onNext,
  onLast,
  onTogglePlay,
  onOpenSummary,
}: MoveListProps) {
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [currentIndex]);

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col h-[480px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 p-3.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Commits ({moves.length})
          </span>
          <span className="text-xs font-mono text-zinc-400">
            {currentIndex}/{moves.length}
          </span>
        </div>
        {onOpenSummary && (
          <button
            onClick={onOpenSummary}
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            <span>Report</span>
          </button>
        )}
      </div>

      {/* Scrubbable Moves List */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60 p-1.5">
        {/* Starting Position Row */}
        <button
          onClick={() => onSelectMove(0)}
          className={`w-full text-left p-2.5 rounded-lg flex items-center justify-between text-xs transition ${
            currentIndex === 0
              ? "bg-zinc-100 dark:bg-zinc-800 font-bold text-zinc-900 dark:text-zinc-100 ring-1 ring-zinc-300 dark:ring-zinc-700"
              : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-500"
          }`}
        >
          <span className="flex items-center gap-2">
            <span>Initial State</span>
          </span>
          <span className="font-mono text-[11px] text-zinc-400">start</span>
        </button>

        {/* Moves */}
        {moves.map((m) => {
          const isSelected = currentIndex === m.index;
          const badge = getLabelBadgeStyle(m.label);

          return (
            <button
              key={m.index}
              ref={isSelected ? activeItemRef : null}
              onClick={() => onSelectMove(m.index)}
              className={`w-full text-left p-2.5 rounded-lg flex items-center justify-between gap-2 text-xs transition ${
                isSelected
                  ? "bg-zinc-100 dark:bg-zinc-800 font-bold text-zinc-900 dark:text-zinc-100 ring-1 ring-emerald-500/50"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-zinc-400 w-4 shrink-0 text-right">
                  {m.index}.
                </span>
                <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100 shrink-0">
                  {m.san}
                </span>
                <span className="truncate text-zinc-500 dark:text-zinc-400 text-[11px]">
                  {m.commitMessage}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                >
                  <span>{badge.icon}</span>
                  <span>{m.label}</span>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Playback Controls Toolbar */}
      <div className="border-t border-zinc-100 dark:border-zinc-800 p-2.5 bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center gap-2 font-mono">
        <button
          onClick={onFirst}
          disabled={currentIndex === 0}
          className="px-2 py-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none transition text-zinc-700 dark:text-zinc-300 text-xs font-bold"
          title="First Move"
        >
          |&lt;
        </button>
        <button
          onClick={onPrev}
          disabled={currentIndex === 0}
          className="px-2 py-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none transition text-zinc-700 dark:text-zinc-300 text-xs font-bold"
          title="Previous Move (Left Arrow)"
        >
          &lt;
        </button>
        <button
          onClick={onTogglePlay}
          className="px-3.5 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white text-xs font-sans font-bold transition flex items-center gap-1"
          title="Auto-Play (Space)"
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button
          onClick={onNext}
          disabled={currentIndex >= moves.length}
          className="px-2 py-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none transition text-zinc-700 dark:text-zinc-300 text-xs font-bold"
          title="Next Move (Right Arrow)"
        >
          &gt;
        </button>
        <button
          onClick={onLast}
          disabled={currentIndex >= moves.length}
          className="px-2 py-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:pointer-events-none transition text-zinc-700 dark:text-zinc-300 text-xs font-bold"
          title="Final Move"
        >
          &gt;|
        </button>
      </div>
    </div>
  );
}
