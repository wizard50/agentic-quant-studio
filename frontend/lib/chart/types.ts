import type { IChartApi, ISeriesApi } from "lightweight-charts";
import type { Candle } from "@/lib/types";

export type ChartStatus = "idle" | "loading" | "ready" | "error";

export type PageDirection = "older" | "newer";
export type RangeEdge = "start" | "end";

export interface MarketDataKey {
  exchange: string;
  category: string;
  symbol: string;
  interval: string;
}

export interface CandleQuery {
  limit?: number;
  start?: Date;
  end?: Date;
}

export type DatafeedEvent =
  | { type: "reset" }
  | { type: "loading" }
  | { type: "paging"; direction: PageDirection; loading: boolean }
  | { type: "pageError"; direction: PageDirection; error: Error }
  | { type: "rangeBoundary"; edge: RangeEdge }
  | { type: "replace"; candles: Candle[] }
  | { type: "prepend"; candles: Candle[]; barsAdded: number };

export type DatafeedListener = (event: DatafeedEvent) => void;

export interface HistoryScrollFeed {
  getHasMoreHistory(): boolean;
  loadOlder(pageSize?: number): Promise<void>;
}

export type BlockLayerSeries =
  | ISeriesApi<"Candlestick">
  | ISeriesApi<"Histogram">
  | ISeriesApi<"Line">;

export interface BlockChartSeries {
  chart: IChartApi;
  byLayerId: Map<string, BlockLayerSeries>;
  candlesLayerId: string;
  histogramLayerIds: string[];
}

export type FetchCandlesFn = (
  marketDataKey: MarketDataKey,
  query: CandleQuery,
) => Promise<Candle[]>;
