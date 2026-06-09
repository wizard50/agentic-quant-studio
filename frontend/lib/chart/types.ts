import type { IChartApi, ISeriesApi } from "lightweight-charts";
import type { Candle } from "@/lib/types";

export type ChartStatus = "idle" | "loading" | "ready" | "error";

export type PageDirection = "older" | "newer";
export type RangeEdge = "start" | "end";

export interface SeriesKey {
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

export interface ChartSeries {
  chart: IChartApi;
  candles: ISeriesApi<"Candlestick">;
  volume: ISeriesApi<"Histogram">;
}

export type FetchCandlesFn = (
  key: SeriesKey,
  query: CandleQuery,
) => Promise<Candle[]>;
