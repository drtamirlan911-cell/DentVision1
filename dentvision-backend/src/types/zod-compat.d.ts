import type { ZodIssue } from 'zod';

declare module 'zod' {
  interface ZodError<T = unknown> {
    /** Backward-compatible alias for Zod 3 consumers; Zod 4 stores issues here. */
    readonly errors: ZodIssue[];
  }
}
