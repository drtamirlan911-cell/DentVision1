// ═══════════════════════════════════════════════════════════════
// Notification helper — used across modules to push into the
// unified Notification Center (shop / school / clinic / system)
// ═══════════════════════════════════════════════════════════════
import crypto from 'crypto';
import prisma from './prisma.js';

/**
 * Create a notification.
 * Scope rules:
 *  - clinicId: null + userId: null  → platform-wide (all users)
 *  - clinicId: set + userId: null    → clinic-wide (all users of that clinic)
 *  - userId: set                     → personal (specific user)
 */
export async function createNotification({
  type,
  category,
  clinicId = null,
  userId = null,
  title,
  message = null,
  actionUrl = null,
}) {
  try {
    if (!title) return null;
    const id = crypto.randomUUID();
    return await prisma.notification.create({
      data: {
        id,
        type,
        category,
        clinicId,
        userId,
        title,
        message,
        actionUrl,
        read: false,
      },
    });
  } catch (e) {
    console.error('createNotification failed:', e.message);
    return null;
  }
}
