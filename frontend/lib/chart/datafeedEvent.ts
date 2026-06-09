import type { IChartApi } from "lightweight-charts";
import { toCandleBars, toVolumeBars } from "./mapCandles";
import { preserveViewportOnPrepend } from "./preserveViewport";
import type { ChartSeries, DatafeedEvent } from "./types";

export interface DatafeedEventContext {
  chart: IChartApi | null;
  series: ChartSeries | null;
}

export interface DatafeedEventHandlers {
  onLoading: () => void;
}

export function handleDatafeedEvent(
  event: DatafeedEvent,
  ctx: DatafeedEventContext,
  handlers: DatafeedEventHandlers,
): void {
  switch (event.type) {
    case "loading":
      handlers.onLoading();
      return;

    case "paging":
    case "pageError":
    case "rangeBoundary":
      return;

    case "reset":
      if (ctx.series) {
        syncSeriesFromEvent(ctx.series, event);
      }
      return;

    case "replace":
      if (!ctx.series) {
        return;
      }

      syncSeriesFromEvent(ctx.series, event);
      ctx.chart?.timeScale().fitContent();
      return;

    case "prepend": {
      if (!ctx.series) {
        return;
      }

      const rangeBeforeUpdate =
        ctx.chart?.timeScale().getVisibleLogicalRange() ?? null;
      syncSeriesFromEvent(ctx.series, event);

      if (ctx.chart) {
        preserveViewportOnPrepend(
          ctx.chart,
          event.barsAdded,
          rangeBeforeUpdate,
        );
      }
      return;
    }
  }
}

export function syncSeriesFromEvent(
  series: ChartSeries,
  event: DatafeedEvent,
): void {
  switch (event.type) {
    case "reset":
      series.candles.setData([]);
      series.volume.setData([]);
      return;

    case "replace":
    case "prepend":
      series.candles.setData(toCandleBars(event.candles));
      series.volume.setData(toVolumeBars(event.candles));
      return;
  }
}
