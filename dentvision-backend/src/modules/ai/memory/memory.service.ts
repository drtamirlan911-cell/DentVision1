/**
 * AI Memory Service — Redis-backed memory for AI agents.
 *
 * Provides three scopes:
 *  - short: TTL-based (e.g., conversation context, 15 min)
 *  - session: per-session (e.g., current patient context)
 *  - long: persistent (e.g., learned preferences)
 */

import { Redis } from 'ioredis';
import prisma from '../../../lib/prisma.js';

// ─── Types ───

export type MemoryScope = 'short' | 'session' | 'long';

export interface MemoryEntry {
  key: string;
  value: unknown;
  scope: MemoryScope;
  ttlMs?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Config ───

const SHORT_TTL_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
// long: no TTL — persisted to DB

// ─── Memory Service ───

export class MemoryService {
  private redis: Redis | null = null;
  private memoryCache = new Map<string, MemoryEntry>();

  constructor(redis?: Redis) {
    this.redis = redis || null;
  }

  // ─── Remember ───

  async remember(
    userId: string,
    clinicId: string,
    key: string,
    value: unknown,
    scope: MemoryScope,
    ttlMs?: number
  ): Promise<void> {
    const entry: MemoryEntry = {
      key,
      value,
      scope,
      ttlMs: ttlMs || this.getDefaultTTL(scope),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Store in Redis
    if (this.redis) {
      const redisKey = this.getRedisKey(userId, clinicId, scope, key);
      const serialized = JSON.stringify(entry);
      const ttl = entry.ttlMs ? Math.ceil(entry.ttlMs / 1000) : undefined;

      if (ttl) {
        await this.redis.setex(redisKey, ttl, serialized);
      } else {
        await this.redis.set(redisKey, serialized);
      }
    }

    // Cache in memory
    this.memoryCache.set(this.getCacheKey(userId, clinicId, scope, key), entry);

    // Persist long-term memories to DB
    if (scope === 'long') {
      await this.persistToDB(userId, clinicId, key, value);
    }
  }

  // ─── Recall ───

  async recall(
    userId: string,
    clinicId: string,
    key: string,
    scope: MemoryScope
  ): Promise<MemoryEntry | null> {
    const cacheKey = this.getCacheKey(userId, clinicId, scope, key);

    // Check memory cache first
    const cached = this.memoryCache.get(cacheKey);
    if (cached && !this.isExpired(cached)) {
      return cached;
    }

    // Check Redis
    if (this.redis) {
      const redisKey = this.getRedisKey(userId, clinicId, scope, key);
      const data = await this.redis.get(redisKey);
      if (data) {
        const entry: MemoryEntry = JSON.parse(data);
        if (!this.isExpired(entry)) {
          this.memoryCache.set(cacheKey, entry);
          return entry;
        }
      }
    }

    // Check DB for long-term memories
    if (scope === 'long') {
      const dbEntry = await this.getFromDB(userId, clinicId, key);
      if (dbEntry) {
        this.memoryCache.set(cacheKey, dbEntry);
        return dbEntry;
      }
    }

    return null;
  }

  // ─── Recall All ───

  async recallAll(
    userId: string,
    clinicId: string,
    scope: MemoryScope
  ): Promise<MemoryEntry[]> {
    const entries: MemoryEntry[] = [];
    const prefix = `${userId}:${clinicId}:${scope}:`;

    // Check Redis
    if (this.redis) {
      const keys = await this.redis.keys(`dentvision:memory:${prefix}*`);
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const entry: MemoryEntry = JSON.parse(data);
          if (!this.isExpired(entry)) {
            entries.push(entry);
          }
        }
      }
    }

    // For long-term, also check DB
    if (scope === 'long') {
      const dbEntries = await this.getAllFromDB(userId, clinicId);
      for (const dbEntry of dbEntries) {
        if (!entries.some((e) => e.key === dbEntry.key)) {
          entries.push(dbEntry);
        }
      }
    }

    return entries;
  }

  // ─── Forget ───

  async forget(
    userId: string,
    clinicId: string,
    key: string,
    scope: MemoryScope
  ): Promise<void> {
    const cacheKey = this.getCacheKey(userId, clinicId, scope, key);
    this.memoryCache.delete(cacheKey);

    if (this.redis) {
      const redisKey = this.getRedisKey(userId, clinicId, scope, key);
      await this.redis.del(redisKey);
    }

    if (scope === 'long') {
      await this.deleteFromDB(userId, clinicId, key);
    }
  }

  async forgetAll(
    userId: string,
    clinicId: string,
    scope?: MemoryScope
  ): Promise<void> {
    const scopes: MemoryScope[] = scope ? [scope] : ['short', 'session', 'long'];

    for (const s of scopes) {
      const prefix = `${userId}:${clinicId}:${s}:`;

      // Clear memory cache
      for (const [key] of this.memoryCache) {
        if (key.startsWith(prefix)) {
          this.memoryCache.delete(key);
        }
      }

      // Clear Redis
      if (this.redis) {
        const keys = await this.redis.keys(`dentvision:memory:${prefix}*`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }

      // Clear DB
      if (s === 'long') {
        await this.deleteAllFromDB(userId, clinicId);
      }
    }
  }

  // ─── Helpers ───

  private getRedisKey(
    userId: string,
    clinicId: string,
    scope: MemoryScope,
    key: string
  ): string {
    return `dentvision:memory:${userId}:${clinicId}:${scope}:${key}`;
  }

  private getCacheKey(
    userId: string,
    clinicId: string,
    scope: MemoryScope,
    key: string
  ): string {
    return `${userId}:${clinicId}:${scope}:${key}`;
  }

  private getDefaultTTL(scope: MemoryScope): number | undefined {
    switch (scope) {
      case 'short':
        return SHORT_TTL_MS;
      case 'session':
        return SESSION_TTL_MS;
      case 'long':
        return undefined;
    }
  }

  private isExpired(entry: MemoryEntry): boolean {
    if (!entry.ttlMs) return false;
    const age = Date.now() - entry.createdAt.getTime();
    return age > entry.ttlMs;
  }

  // ─── DB Persistence ───

  private async persistToDB(
    userId: string,
    clinicId: string,
    key: string,
    value: unknown
  ): Promise<void> {
    try {
      // Use prisma.raw or a dedicated model
      // For now, store as JSON in a simple table
      await prisma.$executeRaw`
        INSERT INTO ai_memory (user_id, clinic_id, key, value, created_at, updated_at)
        VALUES (${userId}, ${clinicId}, ${key}, ${JSON.stringify(value)}, NOW(), NOW())
        ON CONFLICT (user_id, clinic_id, key)
        DO UPDATE SET value = ${JSON.stringify(value)}, updated_at = NOW()
      `;
    } catch (err) {
      console.warn('[MemoryService] DB persist failed:', err);
    }
  }

  private async getFromDB(
    userId: string,
    clinicId: string,
    key: string
  ): Promise<MemoryEntry | null> {
    try {
      const result = await prisma.$queryRaw<
        Array<{ value: string; created_at: Date; updated_at: Date }>
      >`
        SELECT value, created_at, updated_at
        FROM ai_memory
        WHERE user_id = ${userId} AND clinic_id = ${clinicId} AND key = ${key}
        LIMIT 1
      `;

      if (result.length === 0) return null;

      return {
        key,
        value: JSON.parse(result[0].value),
        scope: 'long',
        createdAt: result[0].created_at,
        updatedAt: result[0].updated_at,
      };
    } catch (err) {
      console.warn('[MemoryService] DB get failed:', err);
      return null;
    }
  }

  private async getAllFromDB(
    userId: string,
    clinicId: string
  ): Promise<MemoryEntry[]> {
    try {
      const results = await prisma.$queryRaw<
        Array<{ key: string; value: string; created_at: Date; updated_at: Date }>
      >`
        SELECT key, value, created_at, updated_at
        FROM ai_memory
        WHERE user_id = ${userId} AND clinic_id = ${clinicId}
      `;

      return results.map((r: { key: string; value: string; created_at: Date; updated_at: Date }) => ({
        key: r.key,
        value: JSON.parse(r.value),
        scope: 'long' as MemoryScope,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    } catch (err) {
      console.warn('[MemoryService] DB getAll failed:', err);
      return [];
    }
  }

  private async deleteFromDB(
    userId: string,
    clinicId: string,
    key: string
  ): Promise<void> {
    try {
      await prisma.$executeRaw`
        DELETE FROM ai_memory
        WHERE user_id = ${userId} AND clinic_id = ${clinicId} AND key = ${key}
      `;
    } catch (err) {
      console.warn('[MemoryService] DB delete failed:', err);
    }
  }

  private async deleteAllFromDB(
    userId: string,
    clinicId: string
  ): Promise<void> {
    try {
      await prisma.$executeRaw`
        DELETE FROM ai_memory
        WHERE user_id = ${userId} AND clinic_id = ${clinicId}
      `;
    } catch (err) {
      console.warn('[MemoryService] DB deleteAll failed:', err);
    }
  }
}

// ─── Singleton ───

let instance: MemoryService | null = null;

export function getMemoryService(redis?: Redis): MemoryService {
  if (!instance && redis) {
    instance = new MemoryService(redis);
  }
  if (!instance) {
    instance = new MemoryService();
  }
  return instance;
}

export function resetMemoryService(): void {
  instance = null;
}
