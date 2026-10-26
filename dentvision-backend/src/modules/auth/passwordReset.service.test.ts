import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => {
  const mock: any = {
    passwordReset: {
      deleteMany: vi.fn(async () => ({ count: 1 })),
      create: vi.fn(async (args: any) => ({ id: 'reset-1', ...args.data })),
      findFirst: vi.fn(async () => null),
    },
    user: { update: vi.fn(async (args: any) => ({ id: args.where.id, ...args.data })) },
    userSession: { updateMany: vi.fn(async () => ({ count: 0 })) },
  };
  mock.$transaction = vi.fn(async (fn: any) => fn(mock));
  return mock;
});
vi.mock('../../lib/prisma.js', () => ({ default: prismaMock }));
vi.mock('../compliance/audit.service.js', () => ({ writeAuditLog: vi.fn(async () => undefined) }));
import { hashResetToken, issuePasswordResetToken, resetPasswordWithToken, PASSWORD_RESET_TTL_MS } from './passwordReset.service.js';

const NOW = new Date('2026-10-26T10:00:00.000Z');
describe('issuePasswordResetToken', () => {
  beforeEach(() => vi.clearAllMocks());
  it('persists a digest rather than the raw token and expires it after one hour', async () => {
    const token = await issuePasswordResetToken('user-1', NOW);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const data = prismaMock.passwordReset.create.mock.calls[0][0].data;
    expect(data.userId).toBe('user-1');
    expect(data.token).toBe(hashResetToken(token));
    expect(data.token).not.toBe(token);
    expect(data.expiresAt.getTime()).toBe(NOW.getTime() + PASSWORD_RESET_TTL_MS);
  });
});
describe('resetPasswordWithToken', () => {
  beforeEach(() => vi.clearAllMocks());
  it('rejects an empty token or weak password before touching the database', async () => {
    expect(await resetPasswordWithToken('', 'StrongPass123', NOW)).toMatchObject({ok:false,status:400});
    expect(await resetPasswordWithToken('raw', 'short', NOW)).toMatchObject({ok:false,status:400});
    expect(prismaMock.passwordReset.findFirst).not.toHaveBeenCalled();
  });
  it('rejects an unknown token', async () => {
    prismaMock.passwordReset.findFirst.mockResolvedValueOnce(null);
    expect(await resetPasswordWithToken('unknown', 'StrongPass123', NOW)).toMatchObject({ok:false,status:400});
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
  it('hashes the new password, claims the token atomically and revokes live sessions', async () => {
    prismaMock.passwordReset.findFirst.mockResolvedValueOnce({id:'reset-1',userId:'user-1',expiresAt:new Date(NOW.getTime()+60000)});
    const result = await resetPasswordWithToken('token-value', 'StrongPass123', NOW);
    expect(result).toEqual({ok:true,userId:'user-1'});
    expect(prismaMock.user.update.mock.calls[0][0].data.password).toMatch(/^\$2[aby]\$/);
    expect(prismaMock.user.update.mock.calls[0][0].data.password).not.toContain('StrongPass123');
    expect(prismaMock.passwordReset.deleteMany).toHaveBeenCalledWith({where:{id:'reset-1',token:hashResetToken('token-value'),expiresAt:{gt:NOW}}});
    expect(prismaMock.userSession.updateMany).toHaveBeenCalledWith({where:{userId:'user-1',expiredAt:{gt:NOW}},data:{expiredAt:NOW}});
  });
  it('does not change the password if another request already consumed the token', async () => {
    prismaMock.passwordReset.findFirst.mockResolvedValueOnce({id:'reset-1',userId:'user-1',expiresAt:new Date(NOW.getTime()+60000)});
    prismaMock.passwordReset.deleteMany.mockResolvedValueOnce({count:0});
    expect(await resetPasswordWithToken('token-value','StrongPass123',NOW)).toMatchObject({ok:false,status:400});
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
