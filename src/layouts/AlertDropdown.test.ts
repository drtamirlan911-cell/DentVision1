import { describe, expect, it } from 'vitest'

import { badgeCountFor } from './AlertDropdown'

/**
 * The bell used to be lit permanently and no button could clear it.
 *
 * The badge was `Math.max(unread, proactiveAlerts.length, …)`. Proactive AI
 * hints have no read state and cannot acquire one — they are recomputed from
 * clinic data on every `/ai/proactive` call, the store stamps a fresh
 * `crypto.randomUUID()` on each one at load time, and nothing is persisted.
 * "Прочитать всё" calls `markAllAsRead`, which only touches notification
 * records, so by construction it could never bring the count to zero.
 *
 * These cases fix the rule that the badge counts only what a user can act on.
 */
describe('badgeCountFor', () => {
  it('counts unread notifications', () => {
    expect(badgeCountFor({ unreadNotifications: 3 })).toBe(3)
  })

  it('is zero once everything has been read', () => {
    // This is the case that was unreachable before: with any proactive hint
    // present, the old formula kept the badge lit after "прочитать всё".
    expect(badgeCountFor({ unreadNotifications: 0 })).toBe(0)
  })

  it('never goes negative when the server count and the local list disagree', () => {
    // `markAsRead` decrements optimistically; a stale server count could push
    // this below zero and render "-1" in the badge.
    expect(badgeCountFor({ unreadNotifications: -2 })).toBe(0)
  })
})
