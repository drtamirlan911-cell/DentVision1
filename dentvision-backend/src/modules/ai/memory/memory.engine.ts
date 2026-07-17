import { prisma } from '../../../lib/prisma.js';
import { MemoryEntry } from '../types/ai.types.js';

export class MemoryEngine {
  async getShortTerm(key: string, userId: string, clinicId: string): Promise<unknown> {
    const entry = await prisma.aIMemory.findFirst({
      where: { key, userId, clinicId, scope: 'short' },
    });
    return entry?.value ?? null;
  }

  async setShortTerm(key: string, value: unknown, userId: string, clinicId: string): Promise<void> {
    await prisma.aIMemory.upsert({
      where: { key_userId_clinicId_scope: { key, userId, clinicId, scope: 'short' } },
      update: { value: value as any, updatedAt: new Date() },
      create: { key, value: value as any, userId, clinicId, scope: 'short' },
    });
  }

  async getSession(key: string, userId: string, clinicId: string): Promise<unknown> {
    const entry = await prisma.aIMemory.findFirst({
      where: { key, userId, clinicId, scope: 'session' },
    });
    return entry?.value ?? null;
  }

  async setSession(key: string, value: unknown, userId: string, clinicId: string): Promise<void> {
    await prisma.aIMemory.upsert({
      where: { key_userId_clinicId_scope: { key, userId, clinicId, scope: 'session' } },
      update: { value: value as any, updatedAt: new Date() },
      create: { key, value: value as any, userId, clinicId, scope: 'session' },
    });
  }

  async getLongTerm(key: string, userId: string, clinicId: string): Promise<unknown> {
    const entry = await prisma.aIMemory.findFirst({
      where: { key, userId, clinicId, scope: 'long' },
    });
    return entry?.value ?? null;
  }

  async setLongTerm(key: string, value: unknown, userId: string, clinicId: string): Promise<void> {
    await prisma.aIMemory.upsert({
      where: { key_userId_clinicId_scope: { key, userId, clinicId, scope: 'long' } },
      update: { value: value as any, updatedAt: new Date() },
      create: { key, value: value as any, userId, clinicId, scope: 'long' },
    });
  }

  async clearScope(userId: string, clinicId: string, scope: 'short' | 'session' | 'long'): Promise<void> {
    await prisma.aIMemory.deleteMany({
      where: { userId, clinicId, scope },
    });
  }

  async getAllByScope(userId: string, clinicId: string, scope: 'short' | 'session' | 'long'): Promise<MemoryEntry[]> {
    const entries = await prisma.aIMemory.findMany({
      where: { userId, clinicId, scope },
      orderBy: { updatedAt: 'desc' },
    });
    return entries as MemoryEntry[];
  }
}

export const memoryEngine = new MemoryEngine();