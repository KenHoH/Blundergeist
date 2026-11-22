"use client";

import React, { useState, useEffect } from "react";
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
  const [payload, setPayload] = useState<GameReviewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  // Fetch real review from API, fall back to mock on error
  useEffect(() => {
    let cancelled = false;

    async function loadReview() {
      try {
        const prUrl = `https://github.com/${owner}/${repo}/pull/${prNumber}`;
        const res = await fetch("/api/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: prUrl }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "Request failed" }));
          throw new Error(body.error || `HTTP ${res.status}`);
        }

        const data: GameReviewPayload = await res.json();
        if (!cancelled && data.moves?.length > 0) {
          setPayload(data);
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);

        // Rate limit: show specific guidance, no mock
        if (message.includes("rate limit") || message.includes("API rate limit")) {
          console.warn("[review] GitHub rate limit hit:", message);
          setError("RATE_LIMIT");
          setPayload(null);
          return;
        }

        // Not found: show specific message, no mock
        if (message.includes("Not Found") || message.includes("HTTP 404")) {
          console.warn("[review] PR not found:", message);
          setError("NOT_FOUND");
          setPayload(null);
          return;
        }

        // Other errors: fall back to mock with clear warning
        console.warn("[review] API failed, falling back to mock:", err);
        setError(message);
        setPayload({ ...(sampleReviewData as GameReviewPayload), repo: `${owner}/${repo}`, prNumber });
      }
    }

    loadReview();
    return () => { cancelled = true; };
  }, [owner, repo, prNumber]);

  // Rate limit error screen
  if (error === "RATE_LIMIT") {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md text-center flex flex-col items-center gap-4">
          <div className="text-5xl">🚦</div>
          <h2 className="text-xl font-bold text-rose-400">GitHub Rate Limit Reached</h2>
          <p className="text-sm text-zinc-400">
            The unauthenticated GitHub API limit (60 requests/hour) has been exhausted.
            Add a <code className="text-emerald-400 font-mono">GITHUB_TOKEN</code> to{" "}
            <code className="text-emerald-400 font-mono">.env</code> to raise this to 5,000
            requests/hour, then restart the dev server.
          </p>
          <Link
            href="/"
            className="mt-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-2.5 text-sm transition"
          >
            ← Back to Home
          </Link>
        </div>
      </main>
    );
  }

  // Not found error screen
  if (error === "NOT_FOUND") {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md text-center flex flex-col items-center gap-4">
          <div className="text-5xl">🔍</div>
          <h2 className="text-xl font-bold text-amber-400">PR Not Found</h2>
          <p className="text-sm text-zinc-400">
            Could not find{" "}
            <code className="text-emerald-400 font-mono">
              {owner}/{repo}#{prNumber}
            </code>
            . Make sure the URL is correct and the repository is public.
          </p>
          <Link
            href="/"
            className="mt-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-2.5 text-sm transition"
          >
            ← Back to Home
          </Link>
        </div>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-zinc-400 font-mono">
            Analyzing PR {owner}/{repo}#{prNumber}...
          </span>
        </div>
      </main>
    );
  }

  return <ReviewDashboard payload={payload} isSummaryOpen={isSummaryOpen} setIsSummaryOpen={setIsSummaryOpen} error={error} />;
}

// ---------------------------------------------------------------------------
// Dashboard — separated so the hook runs unconditionally (Rules of Hooks)
// ---------------------------------------------------------------------------

function ReviewDashboard({
  payload,
  isSummaryOpen,
  setIsSummaryOpen,
  error,
}: {
  payload: GameReviewPayload;
  isSummaryOpen: boolean;
  setIsSummaryOpen: (open: boolean) => void;
  error: string | null;
}) {
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

      {/* Fallback warning */}
      {error && (
        <div className="max-w-6xl w-full mx-auto mt-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-4 py-2 text-xs text-yellow-400">
          ⚠️ Live API unavailable ({error}). Showing demo data.
        </div>
      )}

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
