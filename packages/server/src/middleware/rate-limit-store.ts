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

/** The subset of PrismaClient the shared limiter needs. */
export interface SqlExecutor {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<unknown>;
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
}

type FallbackEntry = { totalHits: number; resetTime: number };

const FALLBACK_MAX_ENTRIES = 10_000;
let warnedAboutFallback = false;
let warnedAboutPostgresFallback = false;

const QUERY_TIMEOUT_MS = 1500;
const TABLE_RETRY_MS = 60_000;
const CLEANUP_INTERVAL_MS = 5 * 60_000;
const COUNTER_TTL_MS = 60 * 60_000;

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS "rate_limit_counters" (
  "key" TEXT NOT NULL,
  "total_hits" INTEGER NOT NULL,
  "reset_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "rate_limit_counters_pkey" PRIMARY KEY ("key")
)`;

function withTimeout<T>(promise: Promise<T>, ms = QUERY_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('rate-limit store timed out')), ms);
    timer.unref?.();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function localIncrement(
  fallback: Map<string, FallbackEntry>,
  key: string,
  resetTime: Date,
): IncrementResponse {
  const now = Date.now();
  const existing = fallback.get(key);

  if (!existing || existing.resetTime <= now) {
    if (fallback.size >= FALLBACK_MAX_ENTRIES) {
      for (const [entryKey, entry] of fallback) {
        if (entry.resetTime <= now) fallback.delete(entryKey);
      }
    }
    fallback.set(key, { totalHits: 1, resetTime: resetTime.getTime() });
    return { totalHits: 1, resetTime };
  }

  existing.totalHits += 1;
  return { totalHits: existing.totalHits, resetTime: new Date(existing.resetTime) };
}

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
    return localIncrement(this.fallback, key, resetTime);
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

/**
 * Database-backed counters for deployments without a Redis endpoint.
 *
 * The table is created lazily with `IF NOT EXISTS`, so enabling this store
 * needs no migration step and cannot delete data. If the database is
 * unreachable the limiter degrades to per-instance counters rather than
 * failing requests. Rows are keyed by time bucket and pruned after an hour.
 */
export class PostgresRateLimitStore implements Store {
  localKeys = false;
  readonly prefix: string;

  private readonly db: SqlExecutor;
  private readonly fallback = new Map<string, FallbackEntry>();
  private windowMs = 60_000;
  private tableReady = false;
  private tableCheck: Promise<boolean> | undefined;
  private retryAfter = 0;
  private lastCleanup = 0;

  constructor(db: SqlExecutor, prefix = 'nslv:rl') {
    this.db = db;
    this.prefix = prefix;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private bucketKey(key: string, now = Date.now()) {
    return `${this.prefix}:${Math.floor(now / this.windowMs)}:${key}`;
  }

  private async ensureTable(): Promise<boolean> {
    if (this.tableReady) return true;
    if (Date.now() < this.retryAfter) return false;

    if (!this.tableCheck) {
      this.tableCheck = withTimeout(this.db.$executeRawUnsafe(CREATE_TABLE_SQL))
        .then(() => {
          this.tableReady = true;
          return true;
        })
        .catch((error) => {
          this.retryAfter = Date.now() + TABLE_RETRY_MS;
          if (!warnedAboutPostgresFallback) {
            warnedAboutPostgresFallback = true;
            console.error(
              '[rate-limit] postgres store unavailable; falling back to per-instance counters:',
              error,
            );
          }
          return false;
        })
        .finally(() => {
          this.tableCheck = undefined;
        });
    }

    return this.tableCheck;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const now = Date.now();
    const resetTime = new Date((Math.floor(now / this.windowMs) + 1) * this.windowMs);
    const bucketKey = this.bucketKey(key, now);

    if (!(await this.ensureTable())) {
      return localIncrement(this.fallback, key, resetTime);
    }

    try {
      const rows = await withTimeout(
        this.db.$queryRawUnsafe<Array<{ total_hits: number | bigint }>>(
          `INSERT INTO "rate_limit_counters" ("key", "total_hits", "reset_at")
           VALUES ($1, 1, $2)
           ON CONFLICT ("key") DO UPDATE
             SET "total_hits" = "rate_limit_counters"."total_hits" + 1
           RETURNING "total_hits"`,
          bucketKey,
          resetTime,
        ),
      );

      const totalHits = Number(rows[0]?.total_hits ?? 1);
      this.cleanup(now);
      return { totalHits, resetTime };
    } catch (error) {
      if (!warnedAboutPostgresFallback) {
        warnedAboutPostgresFallback = true;
        console.error(
          '[rate-limit] postgres increment failed; falling back to per-instance counters:',
          error,
        );
      }
      return localIncrement(this.fallback, key, resetTime);
    }
  }

  async decrement(key: string): Promise<void> {
    if (await this.ensureTable()) {
      try {
        await withTimeout(
          this.db.$executeRawUnsafe(
            `UPDATE "rate_limit_counters"
             SET "total_hits" = GREATEST("total_hits" - 1, 0)
             WHERE "key" = $1`,
            this.bucketKey(key),
          ),
        );
      } catch {
        // The counter expires with its window; never block a request here.
      }
    }

    const entry = this.fallback.get(key);
    if (entry && entry.totalHits > 0) entry.totalHits -= 1;
  }

  async resetKey(key: string): Promise<void> {
    if (await this.ensureTable()) {
      try {
        await withTimeout(
          this.db.$executeRawUnsafe(
            `DELETE FROM "rate_limit_counters" WHERE "key" = $1`,
            this.bucketKey(key),
          ),
        );
      } catch {
        // Best effort.
      }
    }
    this.fallback.delete(key);
  }

  private cleanup(now: number): void {
    if (now - this.lastCleanup < CLEANUP_INTERVAL_MS) return;
    this.lastCleanup = now;
    void withTimeout(
      this.db.$executeRawUnsafe(
        `DELETE FROM "rate_limit_counters" WHERE "reset_at" < $1`,
        new Date(now - COUNTER_TTL_MS),
      ),
    ).catch(() => undefined);
  }
}
