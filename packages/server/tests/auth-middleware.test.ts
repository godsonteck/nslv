import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { authenticate, requirePermission } from '../src/middleware/auth';
import { PERMISSIONS } from '@nslv/shared';

function responseRecorder() {
  const state: { status?: number; body?: unknown } = {};
  const response = {
    status: (code: number) => {
      state.status = code;
      return response;
    },
    json: (body: unknown) => {
      state.body = body;
      return response;
    },
  } as unknown as Response;
  return { response, state };
}

const next: NextFunction = () => undefined;

describe('server-side authentication and authorization middleware', () => {
  it('rejects a request without a bearer token', () => {
    const { response, state } = responseRecorder();
    authenticate({ headers: {} } as Request, response, next);
    expect(state.status).toBe(401);
  });

  it('attaches a verified JWT identity and enforces permissions server-side', () => {
    const token = jwt.sign({
      userId: 'user-1', email: 'reception@example.test', username: 'reception',
      roles: ['Reception'], permissions: [PERMISSIONS.RESERVATIONS_VIEW],
    }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '5m' });
    const request = { headers: { authorization: `Bearer ${token}` } } as Request;
    const authenticated = { called: false };
    authenticate(request, responseRecorder().response, () => { authenticated.called = true; });
    expect(authenticated.called).toBe(true);

    const { response, state } = responseRecorder();
    requirePermission(PERMISSIONS.USERS_VIEW)(request, response, next);
    expect(state.status).toBe(403);
  });
});
