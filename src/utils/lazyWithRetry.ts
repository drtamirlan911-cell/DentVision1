import { ComponentType, lazy, LazyExoticComponent } from 'react';

const RELOAD_KEY = 'dv_chunk_reload';

function isChunkLoadError(err: unknown): boolean {
  const msg = String((err as Error)?.message || err || '');
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Loading chunk [\d]+ failed/i.test(msg) ||
    /ChunkLoadError/i.test(msg)
  );
}

/**
 * Vite/React.lazy wrapper: on stale-chunk / protected-preview fetch failures,
 * hard-reload once so the browser picks up the current index.html asset map.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const mod = await factory();
      try {
        sessionStorage.removeItem(RELOAD_KEY);
      } catch {
        /* ignore */
      }
      return mod;
    } catch (err) {
      if (isChunkLoadError(err)) {
        let already = false;
        try {
          already = sessionStorage.getItem(RELOAD_KEY) === '1';
        } catch {
          /* ignore */
        }
        if (!already) {
          try {
            sessionStorage.setItem(RELOAD_KEY, '1');
          } catch {
            /* ignore */
          }
          window.location.reload();
          // Keep suspense pending while the reload happens.
          return new Promise(() => undefined);
        }
      }
      throw err;
    }
  });
}

export { isChunkLoadError };
