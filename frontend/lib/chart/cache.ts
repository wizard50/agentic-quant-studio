import type { Candle } from "@/lib/types";

export class CandleCache {
  private candles: Candle[] = [];

  getAll(): Candle[] {
    return this.candles;
  }

  getCount(): number {
    return this.candles.length;
  }

  getOldestTimestamp(): number | null {
    return this.candles[0]?.timestamp ?? null;
  }

  getNewestTimestamp(): number | null {
    return this.candles.at(-1)?.timestamp ?? null;
  }

  hasData(): boolean {
    return this.candles.length > 0;
  }

  set(candles: Candle[]): void {
    this.candles = toSortedCandles(candles);
  }

  merge(incoming: Candle[]): void {
    if (incoming.length === 0) {
      return;
    }

    this.candles = toSortedCandles([...this.candles, ...incoming]);
  }

  clear(): void {
    this.candles = [];
  }
}

function toSortedCandles(candles: Candle[]): Candle[] {
  const byTimestamp = new Map<number, Candle>();
  for (const candle of candles) {
    byTimestamp.set(candle.timestamp, candle);
  }

  return [...byTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp);
}
