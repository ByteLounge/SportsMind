import NodeCache from 'node-cache';
import { CacheMeta } from '../types';

interface CacheStats {
  hits: number;
  misses: number;
}

const _stats: CacheStats = { hits: 0, misses: 0 };
const _store = new NodeCache({ useClones: false });

export const cache = {
  get<T>(key: string): { data: T; meta: CacheMeta } | null {
    const entry = _store.get<{ data: T; storedAt: number }>(key);
    if (!entry) {
      _stats.misses++;
      return null;
    }
    _stats.hits++;
    return {
      data: entry.data,
      meta: {
        fromCache: true,
        cachedAt: new Date(entry.storedAt).toISOString(),
        cacheAgeMs: Date.now() - entry.storedAt,
      },
    };
  },

  set<T>(key: string, data: T, ttlSeconds: number): void {
    _store.set(key, { data, storedAt: Date.now() }, ttlSeconds);
  },

  del(key: string): void {
    _store.del(key);
  },

  flush(): void {
    _store.flushAll();
  },

  stats() {
    return {
      keys: _store.keys().length,
      hits: _stats.hits,
      misses: _stats.misses,
    };
  },

  freshMeta(): CacheMeta {
    return { fromCache: false, cachedAt: null, cacheAgeMs: null };
  },
};
