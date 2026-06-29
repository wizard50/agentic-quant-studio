import type { Candle } from "@/lib/types";
import { fetchCandles } from "./api";
import { CandleCache } from "./cache";
import type { DatafeedListener, FetchCandlesFn, SeriesKey } from "./types";

export const PAGE_SIZE = 500;

export class CandleDatafeed {
  private readonly cache = new CandleCache();
  private readonly listeners = new Set<DatafeedListener>();
  private readonly fetchCandles: FetchCandlesFn;

  private key: SeriesKey | null = null;
  private generation = 0;
  private isLoadingOlder = false;
  private hasMoreHistory = true;

  constructor(fetchFn: FetchCandlesFn = fetchCandles) {
    this.fetchCandles = fetchFn;
  }

  subscribe(listener: DatafeedListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getCandleCount(): number {
    return this.cache.getCount();
  }

  getOldestTimestamp(): number | null {
    return this.cache.getOldestTimestamp();
  }

  getNewestTimestamp(): number | null {
    return this.cache.getNewestTimestamp();
  }

  getCandles(): Candle[] {
    return this.cache.getAll();
  }

  getHasMoreHistory(): boolean {
    return this.hasMoreHistory;
  }

  isLoadingMore(): boolean {
    return this.isLoadingOlder;
  }

  reset(key: SeriesKey): void {
    this.generation += 1;
    this.key = key;
    this.isLoadingOlder = false;
    this.hasMoreHistory = true;
    this.cache.clear();
    this.emit({ type: "paging", direction: "older", loading: false });
    this.emit({ type: "reset" });
  }

  async loadInitial(limit: number = PAGE_SIZE): Promise<void> {
    if (!this.key) {
      throw new Error(
        "CandleDatafeed.reset() must be called before loadInitial()",
      );
    }

    const generation = this.generation;
    const key = this.key;

    this.emit({ type: "loading" });

    const candles = await this.fetchCandles(key, { limit });

    if (!this.isCurrentRequest(generation)) {
      return;
    }

    this.cache.set(candles);

    if (candles.length < limit) {
      this.hasMoreHistory = false;
    }

    this.emit({ type: "replace", candles: this.cache.getAll() });

    if (!this.hasMoreHistory) {
      this.emit({ type: "rangeBoundary", edge: "start" });
    }
  }

  async loadOlder(pageSize: number = PAGE_SIZE): Promise<void> {
    if (!this.key || !this.hasMoreHistory || this.isLoadingOlder) {
      return;
    }

    if (!this.cache.hasData()) {
      return;
    }

    const oldest = this.cache.getOldestTimestamp();
    if (oldest == null) {
      return;
    }

    const generation = this.generation;
    const key = this.key;
    const countBefore = this.cache.getCount();

    this.isLoadingOlder = true;
    this.emit({ type: "paging", direction: "older", loading: true });

    try {
      const candles = await this.fetchCandles(key, {
        end: new Date(oldest - 1),
        limit: pageSize,
      });

      if (!this.isCurrentRequest(generation)) {
        return;
      }

      if (candles.length === 0) {
        this.hasMoreHistory = false;
        this.emit({ type: "rangeBoundary", edge: "start" });
        return;
      }

      this.cache.merge(candles);
      const barsAdded = this.cache.getCount() - countBefore;

      if (candles.length < pageSize || barsAdded === 0) {
        this.hasMoreHistory = false;
        this.emit({ type: "rangeBoundary", edge: "start" });
      }

      if (barsAdded > 0) {
        this.emit({
          type: "prepend",
          candles: this.cache.getAll(),
          barsAdded,
        });
      }
    } catch (cause) {
      if (!this.isCurrentRequest(generation)) {
        return;
      }

      const error = cause instanceof Error ? cause : new Error(String(cause));
      this.emit({ type: "pageError", direction: "older", error });
    } finally {
      if (this.isCurrentRequest(generation)) {
        this.isLoadingOlder = false;
        this.emit({ type: "paging", direction: "older", loading: false });
      }
    }
  }

  private isCurrentRequest(generation: number): boolean {
    return generation === this.generation;
  }

  private emit(event: Parameters<DatafeedListener>[0]): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
