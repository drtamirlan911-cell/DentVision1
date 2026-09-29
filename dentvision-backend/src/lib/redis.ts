/**
 * Compatibility shim for legacy callers.
 * Redis is intentionally not a runtime dependency; durable queues/events use PostgreSQL.
 */
export function getRedis(): null {
  return null
}
