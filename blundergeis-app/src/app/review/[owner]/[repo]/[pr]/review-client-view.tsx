"use client";

import React, { useState } from "react";
import Link from "next/link";
import { GameReviewPayload } from "@/types/review";
import sampleReviewData from "@/mocks/sample-review.json";
import { useReviewPlayer } from "@/hooks/use-review-player";
import { ChessBoardPanel } from "@/components/chess-board-panel";
import { BestMoveCard } from "@/components/best-move-card";
import { MoveList } from "@/components/move-list";
import { SummaryModal } from "@/components/summary-modal";

interface ReviewClientViewProps {
  owner: string;
  repo: string;
  prNumber: number;
}

export default function ReviewClientView({
  owner,
  repo,
  prNumber,
}: ReviewClientViewProps) {
  // Use sample review data populated with route parameters
  const payload: GameReviewPayload = {
    ...(sampleReviewData as GameReviewPayload),
    repo: `${owner}/${repo}`,
    prNumber,
  };

  const {
    currentIndex,
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
  } = useReviewPlayer(payload.moves);

  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col p-4 sm:p-6 lg:p-8">
      {/* Top Navbar */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between pb-6 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs font-semibold text-zinc-400 hover:text-zinc-100 transition flex items-center gap-1 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg"
          >
            ← Home
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-emerald-400 font-bold">
                {payload.repo}#{payload.prNumber}
              </span>
              <span className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full font-medium">
                {payload.headSha}
              </span>
            </div>
            <h1 className="text-sm sm:text-base font-bold text-zinc-100 truncate max-w-lg mt-0.5">
              {payload.prTitle}
            </h1>
          </div>
        </div>

        {/* Accuracy & Report Action */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] uppercase font-bold text-zinc-500">
              PR Accuracy
            </span>
            <span className="font-mono text-sm font-extrabold text-emerald-400">
              {payload.accuracyScore}%
            </span>
          </div>
          <button
            onClick={() => setIsSummaryOpen(true)}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3.5 py-2 transition shadow-sm flex items-center gap-1.5"
          >
            <span>Game Report</span>
          </button>
        </div>
      </header>

      {/* Main Review Dashboard (Grid: Board on Left, Review on Right) */}
      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6 flex-1 items-start">
        {/* Left: Board & Eval Bar (7 Cols) */}
        <div className="lg:col-span-7 flex justify-center">
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl">
            <ChessBoardPanel
              fen={currentFen}
              evalScore={currentEval}
              lastMove={lastBoardMove}
              boardWidth={460}
              theme="anime"
            />
          </div>
        </div>

        {/* Right: Commit Review Analysis & Move List (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Active Commit Explanation Card */}
          <BestMoveCard move={currentMove} prTitle={payload.prTitle} />

          {/* Scrubbable Commit List & Controls */}
          <MoveList
            moves={payload.moves}
            currentIndex={currentIndex}
            isPlaying={isPlaying}
            onSelectMove={goToMove}
            onFirst={firstMove}
            onPrev={prevMove}
            onNext={nextMove}
            onLast={lastMove}
            onTogglePlay={togglePlay}
            onOpenSummary={() => setIsSummaryOpen(true)}
          />
        </div>
      </div>

      {/* Summary Recap Modal */}
      <SummaryModal
        payload={payload}
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
        onReplay={() => {
          firstMove();
        }}
      />
    </main>
  );
}
