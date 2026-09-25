import { ComponentType, lazy, LazyExoticComponent } from 'react';

const RELOAD_KEY = 'dv_chunk_reload';
type LazyModule<T extends ComponentType<any>> = { default: T } | { AIWorkspaceIndex: T };

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
 * Vite/React.lazy wrapper: retry transient chunk fetch failures before the
 * one-time hard reload used for stale deployment asset maps.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<LazyModule<T>>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: unknown;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const mod = await factory();
        try {
          sessionStorage.removeItem(RELOAD_KEY);
        } catch {
          /* ignore */
        }
        if ('default' in mod) return mod;
        return { default: mod.AIWorkspaceIndex };
      } catch (err) {
        lastError = err;
        if (!isChunkLoadError(err) || attempt === 2) break;
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }

    if (isChunkLoadError(lastError)) {
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
        return new Promise(() => undefined);
      }
    }

    throw lastError;
  });
}

export { isChunkLoadError };
