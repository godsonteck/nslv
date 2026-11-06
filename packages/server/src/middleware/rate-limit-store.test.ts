import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Options } from 'express-rate-limit';
import { PostgresRateLimitStore, SharedRateLimitStore } from './rate-limit-store';

const options = { windowMs: 60_000 } as unknown as Options;

describe('SharedRateLimitStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:10.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('counts locally when no shared endpoint is configured', async () => {
    const store = new SharedRateLimitStore({ url: '', token: '' }, 'test');
    store.init(options);

    expect((await store.increment('1.2.3.4')).totalHits).toBe(1);
    expect((await store.increment('1.2.3.4')).totalHits).toBe(2);

    await store.resetKey('1.2.3.4');
    expect((await store.increment('1.2.3.4')).totalHits).toBe(1);
  });

  it('increments the shared key and sets its expiry on first hit', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: 1 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: 1 }) });
    vi.stubGlobal('fetch', fetchMock);

    const store = new SharedRateLimitStore(
      { url: 'https://redis.example', token: 'secret' },
      'nslv:rl:test',
    );
    store.init(options);

    const first = await store.increment('1.2.3.4');

    expect(first.totalHits).toBe(1);
    expect(first.resetTime?.toISOString()).toBe('2026-01-01T00:01:00.000Z');
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://redis.example',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer secret' }),
      }),
    );

    const incrementBody = JSON.parse(String((fetchMock.mock.calls[0]![1] as RequestInit).body));
    expect(incrementBody).toEqual(['INCR', expect.stringContaining('nslv:rl:test:')]);

    const expireBody = JSON.parse(String((fetchMock.mock.calls[1]![1] as RequestInit).body));
    expect(expireBody[0]).toBe('PEXPIRE');
  });

  it('falls back to local counting when the shared endpoint fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const store = new SharedRateLimitStore(
      { url: 'https://redis.example', token: 'secret' },
      'nslv:rl:test',
    );
    store.init(options);

    expect((await store.increment('1.2.3.4')).totalHits).toBe(1);
    expect((await store.increment('1.2.3.4')).totalHits).toBe(2);
  });

  it('exposes a distinct prefix so two limiters are not mistaken for a double count', () => {
    const globalStore = new SharedRateLimitStore({ url: '', token: '' }, 'nslv:rl:global');
    const loginStore = new SharedRateLimitStore({ url: '', token: '' }, 'nslv:rl:login');

    expect(globalStore.prefix).toBe('nslv:rl:global');
    expect(loginStore.prefix).toBe('nslv:rl:login');
    expect(globalStore.prefix).not.toBe(loginStore.prefix);
    expect(globalStore.localKeys).toBe(false);
  });
});

describe('PostgresRateLimitStore', () => {
  const createDb = () => ({
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
    $queryRawUnsafe: vi.fn(),
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:10.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('creates the table once and increments a windowed key in SQL', async () => {
    const db = createDb();
    db.$queryRawUnsafe
      .mockResolvedValueOnce([{ total_hits: 1 }])
      .mockResolvedValueOnce([{ total_hits: 2 }]);

    const store = new PostgresRateLimitStore(db, 'nslv:rl:test');
    store.init(options);

    const first = await store.increment('1.2.3.4');
    const second = await store.increment('1.2.3.4');

    expect(first.totalHits).toBe(1);
    expect(second.totalHits).toBe(2);
    expect(first.resetTime?.toISOString()).toBe('2026-01-01T00:01:00.000Z');

    const createCalls = db.$executeRawUnsafe.mock.calls.filter(([sql]) =>
      String(sql).startsWith('CREATE TABLE'),
    );
    expect(createCalls).toHaveLength(1);

    const [sql, key, resetAt] = db.$queryRawUnsafe.mock.calls[0]!;
    expect(String(sql)).toContain('INSERT INTO "rate_limit_counters"');
    expect(String(key)).toMatch(/^nslv:rl:test:\d+:1\.2\.3\.4$/);
    expect(resetAt).toBeInstanceOf(Date);
  });

  it('uses a new bucket key when the window rolls over', async () => {
    const db = createDb();
    db.$queryRawUnsafe.mockResolvedValue([{ total_hits: 1 }]);

    const store = new PostgresRateLimitStore(db, 'nslv:rl:test');
    store.init(options);

    await store.increment('1.2.3.4');
    vi.setSystemTime(new Date('2026-01-01T00:01:10.000Z'));
    await store.increment('1.2.3.4');

    const keys = db.$queryRawUnsafe.mock.calls.map(([, key]) => String(key));
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('falls back to local counters when the database is unavailable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const db = createDb();
    db.$executeRawUnsafe.mockRejectedValue(new Error('database down'));

    const store = new PostgresRateLimitStore(db, 'nslv:rl:test');
    store.init(options);

    expect((await store.increment('1.2.3.4')).totalHits).toBe(1);
    expect((await store.increment('1.2.3.4')).totalHits).toBe(2);
    expect(db.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('never blocks decrement or reset when the database fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const db = createDb();
    db.$executeRawUnsafe.mockRejectedValue(new Error('database down'));

    const store = new PostgresRateLimitStore(db, 'nslv:rl:test');
    store.init(options);

    await expect(store.decrement('1.2.3.4')).resolves.toBeUndefined();
    await expect(store.resetKey('1.2.3.4')).resolves.toBeUndefined();
    expect(store.localKeys).toBe(false);
    expect(store.prefix).toBe('nslv:rl:test');
  });
});
