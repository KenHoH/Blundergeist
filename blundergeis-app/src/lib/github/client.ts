import { Octokit } from "@octokit/rest";

// ---------------------------------------------------------------------------
// GitHub REST client
// A single authenticated Octokit instance shared across all GitHub calls.
// GITHUB_TOKEN is optional — unauthenticated requests are limited to
// 60 req/hour. With a token the limit is 5,000 req/hour.
// ---------------------------------------------------------------------------

if (!process.env.GITHUB_TOKEN) {
  console.warn(
    "[github/client] GITHUB_TOKEN is not set. " +
    "Requests will be unauthenticated (60 req/hour limit). " +
    "Set GITHUB_TOKEN in .env to raise the limit to 5,000 req/hour."
  );
}

export const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
  // Retry on 429 (rate limit) and 5xx automatically
  request: { retries: 3, retryAfter: 5 },
});
