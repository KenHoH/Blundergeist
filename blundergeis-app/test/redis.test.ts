/**
 * Live connectivity test for the Upstash Redis client.
 *
 * Runs against the real Upstash instance using the credentials in .env.
 * Execute with:  npx tsx test/redis.test.ts
 */

import { Redis } from "@upstash/redis";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load .env from project root (parent of this test folder)
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const TEST_KEY = "__redis_test__";
const TEST_VALUE = "blundergeist-ok";

async function run() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      "Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN in .env"
    );
  }

  console.log(`Connecting to: ${url}`);

  const redis = new Redis({ url, token });

  // 1. PING
  const pong = await redis.ping();
  assert(pong === "PONG", `PING failed — got: ${pong}`);
  console.log("✓ PING → PONG");

  // 2. SET
  await redis.set(TEST_KEY, TEST_VALUE, { ex: 60 });
  console.log(`✓ SET ${TEST_KEY} = "${TEST_VALUE}"`);

  // 3. GET
  const got = await redis.get<string>(TEST_KEY);
  assert(got === TEST_VALUE, `GET mismatch — expected "${TEST_VALUE}", got "${got}"`);
  console.log(`✓ GET ${TEST_KEY} = "${got}"`);

  // 4. DEL (clean up)
  await redis.del(TEST_KEY);
  const after = await redis.get(TEST_KEY);
  assert(after === null, `DEL failed — key still exists with value: ${after}`);
  console.log(`✓ DEL ${TEST_KEY} → null`);

  // 5. cached() helper
  const { cached } = await import("../src/lib/cache/index");
  let computeCount = 0;
  const CACHE_KEY = "__cached_test__";

  // Prime the cache
  const first = await cached(CACHE_KEY, async () => {
    computeCount++;
    return "computed-value";
  }, 60);
  assert(first === "computed-value", `cached() first call wrong: ${first}`);
  assert(computeCount === 1, `fn called ${computeCount} times on first call (expected 1)`);
  console.log(`✓ cached() miss — fn called once, stored "${first}"`);

  // Hit the cache (fn should NOT be called again)
  const second = await cached(CACHE_KEY, async () => {
    computeCount++;
    return "should-not-appear";
  }, 60);
  assert(second === "computed-value", `cached() hit returned wrong value: ${second}`);
  assert(computeCount === 1, `fn called again on cache hit (computeCount=${computeCount})`);
  console.log(`✓ cached() hit — returned "${second}" without calling fn`);

  // Clean up
  await redis.del(CACHE_KEY);
  console.log(`✓ Cleaned up ${CACHE_KEY}`);

  console.log("\n✅ All Redis tests passed.");
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

run().catch((err) => {
  console.error("\n❌ Test failed:", err.message);
  process.exit(1);
});
