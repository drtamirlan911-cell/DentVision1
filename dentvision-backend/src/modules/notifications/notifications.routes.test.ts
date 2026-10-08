import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('notification route ordering', () => {
  it('keeps static endpoints before the dynamic notification detail route', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'dentvision-backend/src/modules/notifications/notifications.routes.ts'),
      'utf8',
    );

    const detail = source.indexOf("notificationsRouter.get('/:id'");
    const unreadCount = source.indexOf("notificationsRouter.get('/unread-count'");
    const preferences = source.indexOf("notificationsRouter.get('/preferences'");
    const types = source.indexOf("notificationsRouter.get('/types'");

    expect(detail).toBeGreaterThanOrEqual(0);
    expect(unreadCount).toBeGreaterThanOrEqual(0);
    expect(preferences).toBeGreaterThanOrEqual(0);
    expect(types).toBeGreaterThanOrEqual(0);

    expect(unreadCount).toBeLessThan(detail);
    expect(preferences).toBeLessThan(detail);
    expect(types).toBeLessThan(detail);
  });
});


describe('notification ownership boundaries', () => {
  it('scopes read mutation to the authenticated user', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'dentvision-backend/src/modules/notifications/notifications.routes.ts'),
      'utf8',
    );
    const start = source.indexOf("notificationsRouter.post('/:id/read'");
    const end = source.indexOf("// ─── Preferences ───", start);
    const block = source.slice(start, end);
    expect(block).toContain('updateMany({');
    expect(block).toContain('id, userId: req.user!.id');
    expect(block).not.toContain('return res.status(403).json({ ok: false, error: \'Доступ запрещён\' });');
  });

  it('scopes notification detail lookup to the authenticated user', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'dentvision-backend/src/modules/notifications/notifications.routes.ts'),
      'utf8',
    );
    const start = source.indexOf("notificationsRouter.get('/:id'");
    const block = source.slice(start);
    expect(block).toContain('where: { id: req.params.id, userId: req.user!.id }');
  });
});
