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
