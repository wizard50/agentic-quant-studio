import type { IChartApi } from "lightweight-charts";
import type { Candle } from "@/lib/types";
import { getCandlesSeries } from "./createBlockChart";
import { toCandleBars, toVolumeBars } from "./mapCandles";
import { preserveViewportOnPrepend } from "./preserveViewport";
import type { BlockChartSeries, DatafeedEvent } from "./types";

export interface BlockChartDatafeedEventContext {
  chart: IChartApi | null;
  series: BlockChartSeries | null;
}

export function handleBlockChartDatafeedEvent(
  event: DatafeedEvent,
  ctx: BlockChartDatafeedEventContext,
): void {
  switch (event.type) {
    case "loading":
    case "paging":
    case "pageError":
    case "rangeBoundary":
      return;

    case "reset":
      if (ctx.series) {
        syncBlockChartFromEvent(ctx.series, event);
      }
      return;

    case "replace":
      if (!ctx.series) {
        return;
      }

      try {
        syncBlockChartFromEvent(ctx.series, event);
        ctx.chart?.timeScale().fitContent();
      } catch {
        // Chart disposed mid-update.
      }
      return;

    case "prepend": {
      if (!ctx.series) {
        return;
      }

      try {
        const rangeBeforeUpdate =
          ctx.chart?.timeScale().getVisibleLogicalRange() ?? null;
        syncBlockChartFromEvent(ctx.series, event);

        if (ctx.chart) {
          preserveViewportOnPrepend(
            ctx.chart,
            event.barsAdded,
            rangeBeforeUpdate,
          );
        }
      } catch {
        // Chart disposed mid-update.
      }
      return;
    }
  }
}

function syncHistogramLayersFromCandles(
  series: BlockChartSeries,
  candles: Candle[],
): void {
  const volumeBars = toVolumeBars(candles);

  for (const layerId of series.histogramLayerIds) {
    const histogram = series.byLayerId.get(layerId);
    if (histogram?.seriesType() === "Histogram") {
      try {
        histogram.setData(volumeBars);
      } catch {
        // Series disposed.
      }
    }
  }
}

export function hydrateBlockChart(
  series: BlockChartSeries | null,
  candles: Candle[],
): void {
  if (!series || candles.length === 0) {
    return;
  }

  try {
    getCandlesSeries(series)?.setData(toCandleBars(candles));
    syncHistogramLayersFromCandles(series, candles);
  } catch {
    // Chart/series disposed during study ↔ layers switch.
  }
}

export function syncBlockChartFromEvent(
  series: BlockChartSeries,
  event: DatafeedEvent,
): void {
  switch (event.type) {
    case "reset":
      try {
        getCandlesSeries(series)?.setData([]);
        for (const layerId of series.histogramLayerIds) {
          series.byLayerId.get(layerId)?.setData([]);
        }
      } catch {
        // Chart disposed.
      }
      return;

    case "replace":
    case "prepend":
      try {
        getCandlesSeries(series)?.setData(toCandleBars(event.candles));
        syncHistogramLayersFromCandles(series, event.candles);
      } catch {
        // Chart disposed.
      }
      return;
  }
}
