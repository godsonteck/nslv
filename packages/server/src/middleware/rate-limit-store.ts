// ============================================
// NS LUXURY VILLA — Shared Rate Limit Store
// ============================================
//
// express-rate-limit's default store is per-process. On Vercel every warm
// lambda has its own counter, so a client can multiply the configured limit by
// the number of instances. When a Redis REST endpoint (Upstash-compatible) is
// configured, counters are shared across instances. Without one the limiter
// still works, but only per instance — and it says so once in the log.

import type { IncrementResponse, Options, Store } from 'express-rate-limit';

export interface RedisRestConfig {
  url: string;
  token: string;
}

type FallbackEntry = { totalHits: number; resetTime: number };

const FALLBACK_MAX_ENTRIES = 10_000;
let warnedAboutFallback = false;

async function redisCommand(config: RedisRestConfig, command: (string | number)[]): Promise<unknown> {
  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(1500),
  });

  if (!response.ok) {
    throw new Error(`Redis REST responded ${response.status}`);
  }

  const payload = (await response.json()) as { result?: unknown; error?: string };
  if (payload.error) throw new Error(payload.error);
  return payload.result;
}

export class SharedRateLimitStore implements Store {
  /**
   * Keys are not instance-local, so express-rate-limit must not namespace them.
   * `prefix` is public because the library's double-count check identifies a
   * shared store by class name plus this prefix; two limiters using this class
   * would otherwise collide on the same client key and report a false positive.
   */
  localKeys = false;
  readonly prefix: string;

  private readonly config: RedisRestConfig;
  private readonly fallback = new Map<string, FallbackEntry>();
  private windowMs = 60_000;

  constructor(config: RedisRestConfig, prefix = 'nslv:rl') {
    this.config = config;
    this.prefix = prefix;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private bucketKey(key: string, now = Date.now()) {
    return `${this.prefix}:${Math.floor(now / this.windowMs)}:${key}`;
  }

  private fallbackIncrement(key: string, resetTime: Date): IncrementResponse {
    const now = Date.now();
    const existing = this.fallback.get(key);

    if (!existing || existing.resetTime <= now) {
      if (this.fallback.size >= FALLBACK_MAX_ENTRIES) {
        for (const [entryKey, entry] of this.fallback) {
          if (entry.resetTime <= now) this.fallback.delete(entryKey);
        }
      }
      this.fallback.set(key, { totalHits: 1, resetTime: resetTime.getTime() });
      return { totalHits: 1, resetTime };
    }

    existing.totalHits += 1;
    return { totalHits: existing.totalHits, resetTime: new Date(existing.resetTime) };
  }

  async increment(key: string): Promise<IncrementResponse> {
    const now = Date.now();
    const resetTime = new Date((Math.floor(now / this.windowMs) + 1) * this.windowMs);

    if (!this.config.url || !this.config.token) {
      return this.fallbackIncrement(key, resetTime);
    }

    try {
      const redisKey = this.bucketKey(key, now);
      const totalHits = Number(await redisCommand(this.config, ['INCR', redisKey]));
      if (totalHits === 1) {
        await redisCommand(this.config, ['PEXPIRE', redisKey, this.windowMs + 1000]);
      }
      return { totalHits, resetTime };
    } catch (error) {
      if (!warnedAboutFallback) {
        warnedAboutFallback = true;
        console.error(
          '[rate-limit] shared store unavailable; falling back to per-instance counters:',
          error,
        );
      }
      return this.fallbackIncrement(key, resetTime);
    }
  }

  async decrement(key: string): Promise<void> {
    if (this.config.url && this.config.token) {
      try {
        await redisCommand(this.config, ['DECR', this.bucketKey(key)]);
      } catch {
        // The counter will expire with its window; never block a request here.
      }
    }

    const entry = this.fallback.get(key);
    if (entry && entry.totalHits > 0) entry.totalHits -= 1;
  }

  async resetKey(key: string): Promise<void> {
    if (this.config.url && this.config.token) {
      try {
        await redisCommand(this.config, ['DEL', this.bucketKey(key)]);
      } catch {
        // Best effort.
      }
    }
    this.fallback.delete(key);
  }
}
