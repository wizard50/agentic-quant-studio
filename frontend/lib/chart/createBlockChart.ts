import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  type CandlestickSeriesPartialOptions,
  type ISeriesApi,
} from "lightweight-charts";
import {
  applyPaneLayoutToChart,
  buildHistogramSeriesOptionsFromLayer,
  getLayerDefaultVisible,
  resolveLayerVisible,
  shouldShowBlockTimeScale,
  type LayerSpec,
  type PaneSpec,
} from "@/lib/chart-block";
import { CHART_COLORS } from "./theme";
import type { BlockChartSeries, BlockLayerSeries } from "./types";

function buildCandlestickSeriesOptions(
  layer: LayerSpec,
): CandlestickSeriesPartialOptions {
  return {
    upColor: CHART_COLORS.up,
    downColor: CHART_COLORS.down,
    borderUpColor: CHART_COLORS.up,
    borderDownColor: CHART_COLORS.down,
    wickUpColor: CHART_COLORS.up,
    wickDownColor: CHART_COLORS.down,
    visible: resolveLayerVisible(layer.id, getLayerDefaultVisible(layer)),
  };
}

function buildHistogramOptionsFromLayer(layer: LayerSpec) {
  return buildHistogramSeriesOptionsFromLayer(
    layer,
    resolveLayerVisible(layer.id, getLayerDefaultVisible(layer)),
  );
}

export function createBlockChart(
  container: HTMLElement,
  panes: PaneSpec[],
): BlockChartSeries {
  const showTimeScale = shouldShowBlockTimeScale(panes);

  const chart = createChart(container, {
    width: container.clientWidth,
    height: container.clientHeight,
    layout: {
      background: { type: ColorType.Solid, color: CHART_COLORS.background },
      textColor: CHART_COLORS.text,
      panes: {
        separatorColor: CHART_COLORS.grid,
        separatorHoverColor: "rgba(161, 161, 170, 0.2)",
        enableResize: false,
      },
    },
    grid: {
      vertLines: { color: CHART_COLORS.grid },
      horzLines: { color: CHART_COLORS.grid },
    },
    crosshair: { mode: CrosshairMode.Normal },
    timeScale: {
      borderColor: CHART_COLORS.grid,
      timeVisible: showTimeScale,
      secondsVisible: false,
      visible: showTimeScale,
    },
    rightPriceScale: {
      borderColor: CHART_COLORS.grid,
    },
  });

  while (chart.panes().length < panes.length) {
    chart.addPane(true);
  }

  const byLayerId = new Map<string, BlockLayerSeries>();
  let candlesLayerId = "candles";
  const histogramLayerIds: string[] = [];

  for (let paneIndex = 0; paneIndex < panes.length; paneIndex += 1) {
    const pane = panes[paneIndex];

    for (const layer of pane.layers) {
      if (layer.visual === "candlestick") {
        candlesLayerId = layer.id;
        byLayerId.set(
          layer.id,
          chart.addSeries(
            CandlestickSeries,
            buildCandlestickSeriesOptions(layer),
            paneIndex,
          ),
        );
        continue;
      }

      if (layer.visual === "histogram") {
        histogramLayerIds.push(layer.id);
        byLayerId.set(
          layer.id,
          chart.addSeries(
            HistogramSeries,
            buildHistogramOptionsFromLayer(layer),
            paneIndex,
          ),
        );
      }
    }
  }

  applyPaneLayoutToChart(chart, panes, container.clientHeight);

  return {
    chart,
    byLayerId,
    candlesLayerId,
    histogramLayerIds,
  };
}

export function getCandlesSeries(
  series: BlockChartSeries | null,
): ISeriesApi<"Candlestick"> | null {
  if (!series) {
    return null;
  }

  const layer = series.byLayerId.get(series.candlesLayerId);
  return layer?.seriesType() === "Candlestick"
    ? (layer as ISeriesApi<"Candlestick">)
    : null;
}

export function getHistogramSeries(
  series: BlockChartSeries | null,
  layerId: string,
): ISeriesApi<"Histogram"> | null {
  if (!series) {
    return null;
  }

  const layer = series.byLayerId.get(layerId);
  return layer?.seriesType() === "Histogram"
    ? (layer as ISeriesApi<"Histogram">)
    : null;
}

export function getLayerSeries(
  series: BlockChartSeries | null,
  layerId: string,
): BlockLayerSeries | null {
  return series?.byLayerId.get(layerId) ?? null;
}
