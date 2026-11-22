"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export function PrInputForm() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const parsePrUrl = (input: string): { owner: string; repo: string; pr: string } | null => {
    const trimmed = input.trim();

    // Match github.com/owner/repo/pull/123
    const matchFull = trimmed.match(
      /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/pull\/([0-9]+)/
    );
    if (matchFull) {
      return { owner: matchFull[1], repo: matchFull[2], pr: matchFull[3] };
    }

    // Match owner/repo#123
    const matchShort = trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)#([0-9]+)$/);
    if (matchShort) {
      return { owner: matchShort[1], repo: matchShort[2], pr: matchShort[3] };
    }

    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const parsed = parsePrUrl(url);
    if (!parsed) {
      setError("Please enter a valid GitHub PR URL (e.g., https://github.com/owner/repo/pull/142)");
      return;
    }

    setLoading(true);
    router.push(`/review/${parsed.owner}/${parsed.repo}/${parsed.pr}`);
  };

  const handleLaunchDemo = () => {
    router.push("/review/acme-corp/quantum-api/142");
  };

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-center gap-3.5">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5 w-full">
        <div className="relative flex-1">
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError("");
            }}
            placeholder="Paste GitHub PR URL (e.g. github.com/owner/repo/pull/142)"
            className="w-full rounded-xl border border-zinc-700/80 bg-zinc-900/90 hover:border-zinc-600 focus:border-emerald-500/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition shadow-inner"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold px-5 py-3 text-sm transition shrink-0 shadow-lg shadow-emerald-950/40 hover:shadow-emerald-900/50 flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
        >
          {loading ? "Analyzing..." : "Review PR"}
        </button>
      </form>

      {error && <p className="text-xs text-rose-400 font-medium text-center">{error}</p>}

      <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-zinc-400 pt-1">
        <span>Want to try it without a PR?</span>
        <button
          type="button"
          onClick={handleLaunchDemo}
          className="font-semibold text-emerald-400 hover:text-emerald-300 hover:underline transition"
        >
          Launch Demo Game Review (acme-corp #142)
        </button>
      </div>

      {/* Quick Test Pill Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-0.5 text-xs text-zinc-500">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-zinc-600">Quick Test:</span>
        <button
          type="button"
          onClick={() => {
            setUrl("https://github.com/acme-corp/quantum-api/pull/142");
            setError("");
          }}
          className="rounded-md bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 hover:text-zinc-200 px-2 py-0.5 text-[11px] font-mono text-zinc-400 transition"
        >
          acme-corp#142
        </button>
        <button
          type="button"
          onClick={() => {
            setUrl("https://github.com/facebook/react/pull/28100");
            setError("");
          }}
          className="rounded-md bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 hover:text-zinc-200 px-2 py-0.5 text-[11px] font-mono text-zinc-400 transition"
        >
          react#28100
        </button>
        <button
          type="button"
          onClick={() => {
            setUrl("https://github.com/vercel/next.js/pull/62000");
            setError("");
          }}
          className="rounded-md bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 hover:text-zinc-200 px-2 py-0.5 text-[11px] font-mono text-zinc-400 transition"
        >
          next.js#62000
        </button>
      </div>
    </div>
  );
}
