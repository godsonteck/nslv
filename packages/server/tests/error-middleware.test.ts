import { describe, expect, it } from 'vitest';
import type { Response } from 'express';
import { errorHandler } from '../src/middleware/error';

describe('malformed request bodies', () => {
  const run = (err: Error) => {
    const state: { status?: number; body?: any } = {};
    const response = {
      status: (code: number) => { state.status = code; return response; },
      json: (body: unknown) => { state.body = body; return response; },
    } as unknown as Response;
    errorHandler(err, {} as any, response, (() => undefined) as any);
    return state;
  };

  it('rejects invalid JSON as a client error instead of a 500', () => {
    const err = Object.assign(new SyntaxError('Unexpected token'), {
      type: 'entity.parse.failed',
      statusCode: 400,
    });

    const state = run(err);

    expect(state.status).toBe(400);
    expect(state.body.error.code).toBe('INVALID_JSON');
  });

  it('reports an oversized body as 413', () => {
    const err = Object.assign(new Error('request entity too large'), {
      type: 'entity.too.large',
      statusCode: 413,
    });

    const state = run(err);

    expect(state.status).toBe(413);
    expect(state.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('database schema deployment errors', () => {
  it('reports an unapplied Prisma migration as a service-availability issue, not an opaque dashboard 500', () => {
    const state: { status?: number; body?: any } = {};
    const response = { status: (code: number) => { state.status = code; return response; }, json: (body: unknown) => { state.body = body; return response; } } as unknown as Response;
    errorHandler(Object.assign(new Error('Column does not exist'), { name: 'PrismaClientKnownRequestError', code: 'P2022' }), {} as any, response, (() => undefined) as any);
    expect(state.status).toBe(503);
    expect(state.body.error.code).toBe('DATABASE_SCHEMA_OUTDATED');
  });
});
