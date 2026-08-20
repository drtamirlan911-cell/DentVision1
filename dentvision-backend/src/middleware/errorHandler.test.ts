import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { errorHandler } from './errorHandler.js';

function mockRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

function mockReq(): Request {
  return { path: '/api/test', headers: {} } as unknown as Request;
}

describe('errorHandler', () => {
  it('answers with the error\'s own 4xx status, not a flat 500', () => {
    // This is exactly what body-parser throws for a malformed JSON body —
    // before the fix this got silently downgraded to 500, misreporting a
    // client mistake as a server failure.
    const err = Object.assign(new SyntaxError('Unexpected token'), { status: 400 });
    const res = mockRes();
    errorHandler(err, mockReq(), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('reads statusCode when status is absent', () => {
    const err = Object.assign(new Error('too large'), { statusCode: 413 });
    const res = mockRes();
    errorHandler(err, mockReq(), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(413);
  });

  it('falls back to 500 when no status is declared', () => {
    const res = mockRes();
    errorHandler(new Error('boom'), mockReq(), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ ok: false, error: 'Внутренняя ошибка сервера' });
  });

  it('ignores an out-of-range declared status (e.g. a 3xx) and stays 500', () => {
    const err = Object.assign(new Error('redirect?'), { status: 302 });
    const res = mockRes();
    errorHandler(err, mockReq(), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
