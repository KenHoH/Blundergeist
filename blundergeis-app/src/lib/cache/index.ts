export { redis } from "./redis";

/**
 * Fetch a value from cache, or compute and store it if absent.
 *
 * @param key   Cache key
 * @param fn    Async function that produces the value on a cache miss
 * @param ttl   Time-to-live in seconds (default: 60)
 */
export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  ttl = 60
): Promise<T> {
  const { redis } = await import("./redis");

  const hit = await redis.get<T>(key);
  if (hit !== null) return hit;

  const value = await fn();
  await redis.set(key, value, { ex: ttl });
  return value;
}
