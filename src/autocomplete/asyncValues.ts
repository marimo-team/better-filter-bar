import type { AsyncValueContext } from "../types.ts";

/** A fetcher for lazily-loaded value suggestions. */
export type ValueFetcher<T> = (query: string, ctx: AsyncValueContext) => Promise<T[]>;

/** The externally observable state of a cache lookup for a given (field, query). */
export type CacheState<T> =
  | { status: "pending" }
  | { status: "resolved"; items: T[] }
  | { status: "error"; error: unknown };

type Entry =
  | { status: "pending"; controller: AbortController }
  | { status: "resolved"; items: unknown[]; at: number }
  | { status: "error"; error: unknown; at: number };

/** How long a resolved entry is served before a fresh fetch is triggered. */
const RESOLVED_TTL = 30_000;
/** How long an error entry is served (implicit typing) before retrying. */
const ERROR_TTL = 5_000;
/**
 * On an explicit trigger (Ctrl-Space, or a `startCompletion` re-query), an error
 * entry younger than this is still served rather than refetched. This breaks the
 * retry loop that would otherwise form: a fetch settles → re-query fires → the
 * fresh (age ~0) error entry would immediately refetch → settle → re-query …
 */
const EXPLICIT_ERROR_MIN_AGE = 1_000;
/** Insertion-order bounded cache size. */
const MAX_ENTRIES = 50;

export interface AsyncValueCacheOptions {
  /** Injectable clock for deterministic tests. Defaults to `Date.now`. */
  now?: () => number;
}

/**
 * Fetcher-agnostic cache for async value suggestions, one instance per completion
 * source. Handles dedup, keep-latest cancellation per field, TTL-based retry, and
 * bounded eviction. Entries are keyed by `${fieldName}\0${normalizedQuery}`.
 */
export class AsyncValueCache {
  private entries = new Map<string, Entry>();
  /** The latest in-flight fetch per field, for keep-latest cancellation. */
  private pendingByField = new Map<string, { key: string; controller: AbortController }>();
  private now: () => number;

  constructor(opts: AsyncValueCacheOptions = {}) {
    this.now = opts.now ?? (() => Date.now());
  }

  /**
   * Look up the state for `(fieldName, query)`, starting a fetch if there is no
   * usable entry. Returns synchronously so the completion source can render a
   * loading/error/resolved result immediately; `onSettled` fires once a freshly
   * started fetch resolves or rejects (never for aborted fetches).
   */
  lookup<T>(
    fieldName: string,
    query: string,
    fetcher: ValueFetcher<T>,
    opts: { explicit: boolean; onSettled: () => void },
  ): CacheState<T> {
    const key = cacheKey(fieldName, query);
    const existing = this.entries.get(key);
    const now = this.now();

    if (existing) {
      if (existing.status === "pending") {
        return { status: "pending" };
      }
      if (existing.status === "resolved" && now - existing.at < RESOLVED_TTL) {
        return { status: "resolved", items: existing.items as T[] };
      }
      if (existing.status === "error") {
        const age = now - existing.at;
        const stale = opts.explicit ? age > EXPLICIT_ERROR_MIN_AGE : age > ERROR_TTL;
        if (!stale) {
          return { status: "error", error: existing.error };
        }
      }
      // Otherwise the entry is stale — fall through and refetch.
    }

    this.startFetch(key, fieldName, query, fetcher, opts.onSettled);
    return { status: "pending" };
  }

  private startFetch<T>(
    key: string,
    fieldName: string,
    query: string,
    fetcher: ValueFetcher<T>,
    onSettled: () => void,
  ): void {
    // Keep-latest: abort the previous in-flight fetch for this field and drop its
    // orphaned pending entry so a later lookup for that query restarts cleanly
    // (rather than showing a spinner that never resolves).
    const prev = this.pendingByField.get(fieldName);
    if (prev) {
      prev.controller.abort();
      if (this.entries.get(prev.key)?.status === "pending") {
        this.entries.delete(prev.key);
      }
    }

    const controller = new AbortController();
    this.pendingByField.set(fieldName, { key, controller });

    const settle = (entry: Entry) => {
      // Aborted fetches never write entries or fire onSettled.
      if (controller.signal.aborted) return;
      this.set(key, entry);
      if (this.pendingByField.get(fieldName)?.controller === controller) {
        this.pendingByField.delete(fieldName);
      }
      onSettled();
    };

    void fetcher(query, { signal: controller.signal }).then(
      (items) => settle({ status: "resolved", items, at: this.now() }),
      (error) => settle({ status: "error", error, at: this.now() }),
    );

    this.set(key, { status: "pending", controller });
  }

  private set(key: string, entry: Entry): void {
    // Refresh insertion order so recently-touched keys evict last.
    this.entries.delete(key);
    this.entries.set(key, entry);
    while (this.entries.size > MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}

function cacheKey(fieldName: string, query: string): string {
  return `${fieldName}\0${query}`;
}

/**
 * Normalize a raw value prefix into the query passed to a fetcher: strip a
 * leading quote from partially-typed quoted values (e.g. `"nee` → `nee`).
 */
export function normalizeQuery(prefix: string): string {
  return prefix.startsWith('"') ? prefix.slice(1) : prefix;
}
