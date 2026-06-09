import { describe, expect, it } from "vitest";
import type { DatasetCoverage } from "@/lib/types";
import { getMarketSymbols } from "./useCatalog";

function makeDataset(
  overrides: Partial<DatasetCoverage> = {},
): DatasetCoverage {
  return {
    exchange: "bybit",
    category: "spot",
    symbol: "BTCUSDT",
    interval: "1min",
    from: 0,
    to: 0,
    record_count: 100,
    approx_size_bytes: 1024,
    last_updated: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("getMarketSymbols", () => {
  it("returns symbols for the selected market regardless of stored interval label", () => {
    const datasets = [
      makeDataset({ symbol: "BTCUSDT", interval: "1min" }),
      makeDataset({ symbol: "ETHUSDT", interval: "1min" }),
      makeDataset({
        exchange: "bybit",
        category: "spot",
        symbol: "SOLUSDT",
        interval: "5m",
      }),
      makeDataset({
        exchange: "bybit",
        category: "linear",
        symbol: "BTCUSDT",
        interval: "1min",
      }),
    ];

    expect(getMarketSymbols(datasets, "bybit", "spot")).toEqual([
      "BTCUSDT",
      "ETHUSDT",
      "SOLUSDT",
    ]);
  });

  it("returns an empty list when no datasets match the market", () => {
    expect(
      getMarketSymbols(
        [makeDataset({ exchange: "bybit", category: "spot" })],
        "bybit",
        "linear",
      ),
    ).toEqual([]);
  });
});
