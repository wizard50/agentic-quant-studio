import {
  buildStudioRunRequest,
  deriveOutputs,
  resolveDatasourceNodeId,
  studioResponseToCandles,
  type ChartBlockSpec,
} from "@/lib/chart-block";
import { runStudioGraph } from "@/lib/studio/api";
import type { StudioRunResponse } from "@/lib/studio/types";
import type { Candle } from "@/lib/types";
import { CandleCache } from "./cache";
import { PAGE_SIZE } from "./constants";
import type { DatafeedListener, MarketDataKey } from "./types";
import { estimateBarDurationMs } from "./viewportMath";

export class Datafeed {
  private readonly cache = new CandleCache();
  private readonly listeners = new Set<DatafeedListener>();

  private spec: ChartBlockSpec | null = null;
  private warmupBars = 0;
  private marketDataKey: MarketDataKey | null = null;
  private generation = 0;
  private isLoadingOlder = false;
  private hasMoreHistory = true;
  private lastResponse: StudioRunResponse | null = null;

  subscribe(listener: DatafeedListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  configure(spec: ChartBlockSpec, warmupBars: number): void {
    this.spec = spec;
    this.warmupBars = warmupBars;
  }

  getLastResponse(): StudioRunResponse | null {
    return this.lastResponse;
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

  reset(marketDataKey: MarketDataKey): void {
    this.generation += 1;
    this.marketDataKey = marketDataKey;
    this.isLoadingOlder = false;
    this.hasMoreHistory = true;
    this.lastResponse = null;
    this.cache.clear();
    this.emit({ type: "paging", direction: "older", loading: false });
    this.emit({ type: "reset" });
  }

  async loadInitial(limit: number = PAGE_SIZE): Promise<void> {
    this.assertReady();

    const generation = this.generation;
    this.emit({ type: "loading" });

    const response = await runStudioGraph(
      buildStudioRunRequest(this.spec!, {
        limit: limit + this.warmupBars,
      }),
    );

    if (!this.isCurrentRequest(generation)) {
      return;
    }

    // Fetch PAGE_SIZE + warmup so indicators are valid across the display window,
    // but only keep the newest `limit` candles on the chart (warmup is history padding).
    this.applyResponse(response, "replace", { displayLimit: limit });

    if (this.cache.getCount() < limit) {
      this.hasMoreHistory = false;
      this.emit({ type: "rangeBoundary", edge: "start" });
    }
  }

  async refresh(): Promise<void> {
    this.assertReady();

    if (!this.cache.hasData()) {
      await this.loadInitial();
      return;
    }

    const generation = this.generation;
    this.emit({ type: "loading" });

    const oldest = this.cache.getOldestTimestamp();
    const newest = this.cache.getNewestTimestamp();
    const count = this.cache.getCount();

    if (oldest == null || newest == null) {
      return;
    }

    const barDurationMs = estimateBarDurationMs(oldest, newest, count);

    const response = await runStudioGraph(
      buildStudioRunRequest(this.spec!, {
        startMs: oldest - this.warmupBars * barDurationMs,
        endMs: newest,
        limit: count + this.warmupBars,
      }),
    );

    if (!this.isCurrentRequest(generation)) {
      return;
    }

    this.applyResponse(response, "replace");
  }

  async loadOlder(pageSize: number = PAGE_SIZE): Promise<void> {
    this.assertReady();

    if (!this.hasMoreHistory || this.isLoadingOlder || !this.cache.hasData()) {
      return;
    }

    const oldest = this.cache.getOldestTimestamp();
    const newest = this.cache.getNewestTimestamp();
    const count = this.cache.getCount();

    if (oldest == null || newest == null) {
      return;
    }

    const generation = this.generation;
    const countBefore = count;
    const previousOldest = oldest;
    const barDurationMs = estimateBarDurationMs(oldest, newest, count);

    this.isLoadingOlder = true;
    this.emit({ type: "paging", direction: "older", loading: true });

    try {
      const response = await runStudioGraph(
        buildStudioRunRequest(this.spec!, {
          startMs:
            oldest - pageSize * barDurationMs - this.warmupBars * barDurationMs,
          endMs: newest,
          limit: count + pageSize + this.warmupBars,
        }),
      );

      if (!this.isCurrentRequest(generation)) {
        return;
      }

      const candles = this.parseCandles(response);
      const newOldest = candles[0]?.timestamp ?? null;

      if (
        candles.length <= countBefore ||
        newOldest == null ||
        newOldest >= previousOldest
      ) {
        this.hasMoreHistory = false;
        this.emit({ type: "rangeBoundary", edge: "start" });
        return;
      }

      this.cache.set(candles);
      this.lastResponse = response;

      if (candles.length < countBefore + pageSize) {
        this.hasMoreHistory = false;
        this.emit({ type: "rangeBoundary", edge: "start" });
      }

      const barsAdded = candles.length - countBefore;
      this.emit({
        type: "prepend",
        candles: this.cache.getAll(),
        barsAdded,
      });
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

  private applyResponse(
    response: StudioRunResponse,
    mode: "replace" | "prepend" = "replace",
    options: { displayLimit?: number } = {},
  ): void {
    let candles = this.parseCandles(response);
    const displayLimit = options.displayLimit;
    if (
      displayLimit != null &&
      displayLimit > 0 &&
      candles.length > displayLimit
    ) {
      candles = candles.slice(candles.length - displayLimit);
    }

    const countBefore = this.cache.getCount();

    this.cache.set(candles);
    // Keep the full run response (including warmup bars) for indicator alignment.
    this.lastResponse = response;

    if (mode === "prepend") {
      const barsAdded = Math.max(0, candles.length - countBefore);
      this.emit({
        type: "prepend",
        candles: this.cache.getAll(),
        barsAdded,
      });
      return;
    }

    this.emit({ type: "replace", candles: this.cache.getAll() });
  }

  private parseCandles(response: StudioRunResponse): Candle[] {
    const dsNodeId = this.spec
      ? resolveDatasourceNodeId(this.spec.data.graph)
      : undefined;

    return studioResponseToCandles(response, {
      dsNodeId,
      requestedOutputs: this.spec ? deriveOutputs(this.spec) : [],
    });
  }

  private assertReady(): void {
    if (!this.marketDataKey) {
      throw new Error("Datafeed.reset() must be called before loading data");
    }

    if (!this.spec) {
      throw new Error(
        "Datafeed.configure() must be called before loading data",
      );
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
