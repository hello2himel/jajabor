import type { PairInfo } from "../types";

interface CacheEntry {
  value: PairInfo | null;
  time: number;
}

const STORAGE_KEY = "jajabor.pairs.v1";
const SEAT_TTL = 15 * 60 * 1000;
const EMPTY_TTL = 2 * 60 * 1000;
const MAX_ENTRIES = 900;

export function pairCacheKey(
  trainNumber: string,
  date: string,
  cls: string,
  from: string,
  to: string,
): string {
  return `${trainNumber}|${date}|${cls}|${from}|${to}`;
}

function loadEntries(): Record<string, CacheEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

export class PairCache {
  private entries: Record<string, CacheEntry>;
  private dirty = false;

  constructor() {
    this.entries = loadEntries();
  }

  get(key: string): PairInfo | null | undefined {
    const entry = this.entries[key];
    if (!entry) return undefined;
    const ttl = entry.value ? SEAT_TTL : EMPTY_TTL;
    if (Date.now() - entry.time > ttl) return undefined;
    return entry.value;
  }

  set(key: string, value: PairInfo | null): void {
    this.entries[key] = { value, time: Date.now() };
    this.dirty = true;
  }

  flush(): void {
    if (!this.dirty) return;
    try {
      const now = Date.now();
      const entries = Object.entries(this.entries)
        .filter(([, entry]) => now - entry.time <= SEAT_TTL)
        .sort(([, a], [, b]) => b.time - a.time)
        .slice(0, MAX_ENTRIES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
      this.dirty = false;
    } catch {
      // cache is optional — ignore quota / private mode failures
    }
  }
}
