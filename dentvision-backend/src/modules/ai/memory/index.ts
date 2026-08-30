/**
 * `memory.service.ts` used to be re-exported from here. It wrote raw SQL to a
 * table named `ai_memory` with snake_case columns, while the real model is
 * `ai_memories` with `userId`/`clinicId` and `scope` in its unique key — so
 * every query it made failed, and every failure was swallowed by a
 * `console.warn`. Nothing ever imported it.
 *
 * `memory.engine.ts` is the working implementation, used by
 * `learning.service.ts` and `core/ai.service.ts`.
 */
export * from './memory.engine.js';
