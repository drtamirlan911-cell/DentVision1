interface AttemptEntry {
  count: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

const store = new Map<string, AttemptEntry>();

const FIFTEEN_MIN_MS = 15 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const SOFT_LOCK_ATTEMPTS = 5;
const HARD_LOCK_ATTEMPTS = 10;

function key(email: string, ip: string): string {
  return `${email.toLowerCase()}:${ip}`;
}

function cleanup(): void {
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.lockedUntil && now > v.lockedUntil) {
      const elapsed = now - v.firstAttempt;
      if (elapsed > FIFTEEN_MIN_MS) {
        store.delete(k);
      }
    }
  }
}

export async function checkLoginAttempts(
  email: string,
  ip: string,
): Promise<{ allowed: boolean; remainingAttempts: number; lockoutMinutes: number | null }> {
  cleanup();
  const k = key(email, ip);
  const entry = store.get(k);
  if (!entry) {
    return { allowed: true, remainingAttempts: SOFT_LOCK_ATTEMPTS, lockoutMinutes: null };
  }

  if (entry.lockedUntil) {
    const remaining = entry.lockedUntil - Date.now();
    if (remaining > 0) {
      return { allowed: false, remainingAttempts: 0, lockoutMinutes: Math.ceil(remaining / 60000) };
    }
    store.delete(k);
    return { allowed: true, remainingAttempts: SOFT_LOCK_ATTEMPTS, lockoutMinutes: null };
  }

  const remaining = SOFT_LOCK_ATTEMPTS - entry.count;
  return { allowed: true, remainingAttempts: Math.max(0, remaining), lockoutMinutes: null };
}

export async function recordFailedAttempt(email: string, ip: string): Promise<void> {
  cleanup();
  const k = key(email, ip);
  const now = Date.now();
  const existing = store.get(k);

  if (existing) {
    const elapsed = now - existing.firstAttempt;
    if (elapsed > FIFTEEN_MIN_MS) {
      store.set(k, { count: 1, firstAttempt: now, lockedUntil: null });
      return;
    }
    existing.count += 1;

    if (existing.count >= HARD_LOCK_ATTEMPTS) {
      existing.lockedUntil = now + ONE_HOUR_MS;
    } else if (existing.count >= SOFT_LOCK_ATTEMPTS) {
      existing.lockedUntil = now + FIFTEEN_MIN_MS;
    }
  } else {
    store.set(k, { count: 1, firstAttempt: now, lockedUntil: null });
  }
}

export async function resetAttempts(email: string, ip: string): Promise<void> {
  store.delete(key(email, ip));
}
