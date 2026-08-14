import { describe, expect, it } from 'vitest';
import type { Response } from 'express';
import { errorHandler } from '../src/middleware/error';

describe('database schema deployment errors', () => {
  it('reports an unapplied Prisma migration as a service-availability issue, not an opaque dashboard 500', () => {
    const state: { status?: number; body?: any } = {};
    const response = { status: (code: number) => { state.status = code; return response; }, json: (body: unknown) => { state.body = body; return response; } } as unknown as Response;
    errorHandler(Object.assign(new Error('Column does not exist'), { name: 'PrismaClientKnownRequestError', code: 'P2022' }), {} as any, response, (() => undefined) as any);
    expect(state.status).toBe(503);
    expect(state.body.error.code).toBe('DATABASE_SCHEMA_OUTDATED');
  });
});
