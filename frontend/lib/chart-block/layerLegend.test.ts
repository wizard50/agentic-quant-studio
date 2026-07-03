import { describe, expect, it } from "vitest";
import { createDefaultMarketLayer, type ChartLayer } from "./layers";
import { createVolumeBuiltinLayer } from "@/lib/indicators";
import {
  filterLegendLayers,
  getLayerLegendLabel,
  isChartLayerInLegend,
  paneHasLegendLayers,
} from "./layerLegend";
import type { LayerSpec, PaneSpec } from "./types";

const candlesLayer: LayerSpec = {
  id: "candles",
  label: "BTCUSDT",
  visual: "candlestick",
  ports: {
    time: "ds1.timestamp",
    open: "ds1.open",
    high: "ds1.high",
    low: "ds1.low",
    close: "ds1.close",
  },
};

const volumeLayer: LayerSpec = {
  id: "volume",
  visual: "histogram",
  ports: {
    time: "ds1.timestamp",
    value: "ds1.volume",
  },
};

const smaLayer: LayerSpec = {
  id: "sma-20",
  visual: "line",
  ports: {
    time: "ds1.timestamp",
    value: "sma-20.value",
  },
};

const chartLayers: ChartLayer[] = [
  createDefaultMarketLayer(),
  createVolumeBuiltinLayer(),
  {
    id: "sma-20",
    kind: "indicator",
    indicatorKind: "indicator.sma",
    params: { period: 20 },
    visible: true,
    color: "#f59e0b",
  },
];

describe("layerLegend helpers", () => {
  it("includes layers backed by chart-layer document entries", () => {
    expect(isChartLayerInLegend("candles", chartLayers)).toBe(true);
    expect(isChartLayerInLegend("volume", chartLayers)).toBe(true);
    expect(isChartLayerInLegend("sma-20", chartLayers)).toBe(true);
    expect(isChartLayerInLegend("unknown", chartLayers)).toBe(false);
  });

  it("filters pane layers using chart-layer membership", () => {
    expect(
      filterLegendLayers([candlesLayer, volumeLayer, smaLayer], chartLayers),
    ).toEqual([candlesLayer, volumeLayer, smaLayer]);
    expect(
      filterLegendLayers(
        [volumeLayer, { ...smaLayer, id: "orphan" }],
        chartLayers,
      ),
    ).toEqual([volumeLayer]);
  });

  it("detects whether a pane has legend layers", () => {
    const pane: PaneSpec = {
      id: "main",
      role: "main",
      height: "flex",
      layers: [candlesLayer, smaLayer],
    };

    expect(paneHasLegendLayers(pane, chartLayers)).toBe(true);
    expect(
      paneHasLegendLayers(
        {
          ...pane,
          layers: [{ ...smaLayer, id: "missing-layer" }],
        },
        chartLayers,
      ),
    ).toBe(false);
  });

  it("resolves legend labels with fallbacks", () => {
    expect(getLayerLegendLabel(candlesLayer)).toBe("BTCUSDT");
    expect(getLayerLegendLabel(volumeLayer)).toBe("Volume");
    expect(getLayerLegendLabel(smaLayer)).toBe("sma-20");
  });
});
