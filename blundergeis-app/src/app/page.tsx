"use client";

import Link from "next/link";
import { PrInputForm } from "../components/pr-input-form";

export default function Home() {
  return (
    <main className="relative min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between p-6 sm:p-12 overflow-hidden selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Background Ambient Glow */}
      <div
        className="absolute inset-0 -z-10 pointer-events-none bg-[radial-gradient(ellipse_75%_50%_at_50%_-15%,rgba(16,185,129,0.18),rgba(9,9,11,0))]"
        aria-hidden="true"
      />

      {/* Top Navbar */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between pb-8">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <svg
              className="w-5 h-5 fill-current"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2a3 3 0 0 0-3 3c0 .85.35 1.62.92 2.16C8.8 8.35 8 10.05 8 12c0 1.25.58 2.37 1.48 3.1-.3.26-.48.63-.48 1.05v.85h6v-.85c0-.42-.18-.79-.48-1.05.9-.73 1.48-1.85 1.48-3.1 0-1.95-.8-3.65-1.92-4.84.57-.54.92-1.31.92-2.16a3 3 0 0 0-3-3zm-6 16v3h12v-3H6z" />
            </svg>
          </div>
          <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            BlunderGeist
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/review/acme-corp/quantum-api/142"
            className="rounded-xl bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white transition shadow-sm"
          >
            Sample Review
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-3xl w-full mx-auto flex flex-col items-center text-center gap-6 my-auto py-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold tracking-wide">
          <span>Chess.com Game Review for GitHub PRs</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.12] text-zinc-50 max-w-2xl">
          Turn Code Reviews into{" "}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            Grandmaster Games
          </span>
        </h1>

        <p className="text-base sm:text-lg text-zinc-400 max-w-xl leading-relaxed">
          Transform commits into chess moves. Score pull requests with Brilliant, Best, and Blunder badges based on real CI status, diff complexity, and code impact.
        </p>

        {/* PR URL Input Form (Strictly Centered) */}
        <div className="w-full flex justify-center pt-2">
          <PrInputForm />
        </div>
      </div>

      {/* Feature Pillars */}
      <footer className="max-w-5xl w-full mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 pt-12 border-t border-zinc-900/80">
        <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800/70 hover:border-zinc-700/80 p-5 flex flex-col gap-2.5 transition">
          <div className="h-7 w-7 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-mono font-bold">
            01
          </div>
          <h3 className="text-sm font-bold text-zinc-200">Truth Layer Evaluation</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Dynamic vertical eval bar tracking codebase health from -10.0 to +10.0 based on CI results and diff risk.
          </p>
        </div>

        <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800/70 hover:border-zinc-700/80 p-5 flex flex-col gap-2.5 transition">
          <div className="h-7 w-7 rounded-md bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-xs font-mono font-bold">
            02
          </div>
          <h3 className="text-sm font-bold text-zinc-200">Move Classifications</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Spot Brilliant optimizations and catastrophic Blunders with automated explanations and suggested fixes.
          </p>
        </div>

        <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800/70 hover:border-zinc-700/80 p-5 flex flex-col gap-2.5 transition">
          <div className="h-7 w-7 rounded-md bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 text-xs font-mono font-bold">
            03
          </div>
          <h3 className="text-sm font-bold text-zinc-200">Show Layer Simulation</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Sliding animated board moves, custom Anime piece sets, and persistent browser color themes.
          </p>
        </div>
      </footer>
    </main>
  );
}
