import type { Candle } from "@/lib/types";
import type { CandleQuery, FetchCandlesFn, SeriesKey } from "./types";

function buildCandlesUrl(key: SeriesKey, query: CandleQuery): string {
  const { exchange, category, symbol, interval } = key;
  const params = new URLSearchParams();

  if (query.start) {
    params.set("start", query.start.toISOString());
  }
  if (query.end) {
    params.set("end", query.end.toISOString());
  }
  if (query.limit != null) {
    params.set("limit", String(query.limit));
  }

  const queryString = params.toString();
  const base = `/api/backend/v1/candles/${exchange}/${category}/${symbol}/${interval}`;
  return queryString ? `${base}?${queryString}` : base;
}

export const fetchCandles: FetchCandlesFn = async (key, query) => {
  const res = await fetch(buildCandlesUrl(key, query));

  if (!res.ok) {
    throw new Error(`Failed to fetch candles: ${res.status}`);
  }

  return res.json() as Promise<Candle[]>;
};
