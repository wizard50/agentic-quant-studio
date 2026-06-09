import type { CandlestickData, HistogramData, Time } from "lightweight-charts";
import type { Candle } from "@/lib/types";
import { volumeBarColor } from "./theme";

export function toChartTime(timestamp: number): Time {
  return Math.floor(timestamp / 1000) as Time;
}

export function toCandleBar(candle: Candle): CandlestickData {
  return {
    time: toChartTime(candle.timestamp),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  };
}

export function toVolumeBar(candle: Candle): HistogramData {
  return {
    time: toChartTime(candle.timestamp),
    value: candle.volume,
    color: volumeBarColor(candle.close >= candle.open),
  };
}

export function toCandleBars(candles: Candle[]): CandlestickData[] {
  return candles.map(toCandleBar);
}

export function toVolumeBars(candles: Candle[]): HistogramData[] {
  return candles.map(toVolumeBar);
}
