import React, { Suspense } from "react";
import ReviewClientView from "./review-client-view";

interface ReviewPageProps {
  params: Promise<{
    owner: string;
    repo: string;
    pr: string;
  }>;
}

async function ReviewContent({
  params,
}: {
  params: Promise<{ owner: string; repo: string; pr: string }>;
}) {
  const resolved = await params;

  return (
    <ReviewClientView
      owner={resolved.owner}
      repo={resolved.repo}
      prNumber={parseInt(resolved.pr, 10) || 1}
    />
  );
}

export default function ReviewPage({ params }: ReviewPageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center font-mono text-sm">
          Loading review...
        </div>
      }
    >
      <ReviewContent params={params} />
    </Suspense>
  );
}
