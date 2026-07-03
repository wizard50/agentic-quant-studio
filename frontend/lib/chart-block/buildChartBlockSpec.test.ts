import { describe, expect, it } from "vitest";
import { createDefaultMarketLayer } from "./layers";
import { createVolumeBuiltinLayer, VOLUME_LAYER_ID } from "@/lib/indicators";
import { buildChartBlockSpecFromLayers } from "./buildChartBlockSpec";
import { MAIN_PANE_ID } from "./constants";

const marketDataKey = {
  exchange: "bybit",
  category: "spot",
  symbol: "BTCUSDT",
  interval: "1d",
};

describe("buildChartBlockSpecFromLayers", () => {
  it("builds main, volume, and subchart panes from layers", () => {
    const spec = buildChartBlockSpecFromLayers(marketDataKey, [
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
      {
        id: "rsi-14",
        kind: "indicator",
        indicatorKind: "indicator.rsi",
        params: { period: 14 },
        visible: true,
        color: "#a855f7",
      },
    ]);

    expect(spec.version).toBe(1);
    expect(spec.panes.map((pane) => pane.id)).toEqual([
      MAIN_PANE_ID,
      VOLUME_LAYER_ID,
      "rsi-14",
    ]);

    expect(spec.panes[0].role).toBe("main");
    expect(spec.panes[1].role).toBe("subchart");
    expect(spec.panes[1].layers[0]?.visual).toBe("histogram");
    expect(spec.panes[2].role).toBe("subchart");
    expect(spec.panes[2].layers[0]?.visual).toBe("line");

    expect(spec.panes[0].layers.map((layer) => layer.id)).toEqual([
      "candles",
      "sma-20",
    ]);
  });

  it("omits the volume pane when the builtin layer is removed", () => {
    const spec = buildChartBlockSpecFromLayers(marketDataKey, [
      createDefaultMarketLayer(),
      {
        id: "sma-20",
        kind: "indicator",
        indicatorKind: "indicator.sma",
        params: { period: 20 },
        visible: true,
        color: "#f59e0b",
      },
    ]);

    expect(spec.panes.map((pane) => pane.id)).toEqual([MAIN_PANE_ID]);
    expect(spec.data.outputs).not.toContain("ds1.volume");
  });

  it("includes datasource and indicator nodes in the graph", () => {
    const spec = buildChartBlockSpecFromLayers(marketDataKey, [
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
    ]);

    expect(spec.data.graph.nodes.map((node) => node.id)).toEqual([
      "ds1",
      "sma-20",
    ]);
    expect(spec.data.outputs).toContain("ds1.timestamp");
    expect(spec.data.outputs).toContain("ds1.volume");
    expect(spec.data.outputs).toContain("sma-20.value");
  });
});
