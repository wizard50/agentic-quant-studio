import { beforeEach, describe, expect, it } from "vitest";
import {
  createDefaultMarketLayer,
  isIndicatorChartLayer,
  MARKET_LAYER_ID,
} from "@/lib/chart-block";
import {
  createVolumeBuiltinLayer,
  INDICATOR_COLOR_POOL,
  VOLUME_LAYER_ID,
} from "@/lib/indicators";
import { useChartLayersStore } from "./useChartLayersStore";

describe("useChartLayersStore", () => {
  beforeEach(() => {
    useChartLayersStore.setState({
      layers: [createDefaultMarketLayer(), createVolumeBuiltinLayer()],
      layerStatusById: {},
    });
  });

  it("starts with a market layer and builtin volume layer", () => {
    const layers = useChartLayersStore.getState().layers;

    expect(layers.map((layer) => layer.id)).toEqual([
      MARKET_LAYER_ID,
      VOLUME_LAYER_ID,
    ]);
    expect(layers[0]?.kind).toBe("market");
    expect(layers[1]?.kind).toBe("indicator");
  });

  it("generates graph-safe ids when adding from the browser", () => {
    const store = useChartLayersStore.getState();
    const id = store.addIndicator("indicator.sma");

    expect(id.includes(".")).toBe(false);
    expect(
      useChartLayersStore.getState().layers.find((layer) => layer.id === id)
        ?.id,
    ).toBe(id);
  });

  it("assigns distinct colors from the pool per indicator layer", () => {
    const store = useChartLayersStore.getState();

    store.addIndicator("indicator.sma", undefined, "sma-a");
    store.addIndicator("indicator.sma", undefined, "sma-b");

    const indicatorLayers = useChartLayersStore
      .getState()
      .layers.filter((layer) => layer.kind === "indicator");
    const smaA = indicatorLayers.find((layer) => layer.id === "sma-a");
    const smaB = indicatorLayers.find((layer) => layer.id === "sma-b");

    expect(smaA?.color).toBe(INDICATOR_COLOR_POOL[0]);
    expect(smaB?.color).toBe(INDICATOR_COLOR_POOL[2]);
    expect(smaA?.color).not.toBe(smaB?.color);
  });

  it("toggles visibility on the layer itself", () => {
    const store = useChartLayersStore.getState();
    const id = store.addIndicator("indicator.sma");

    store.setVisible(id, false);
    expect(
      useChartLayersStore.getState().layers.find((layer) => layer.id === id)
        ?.visible,
    ).toBe(false);

    store.setVisible(id, true);
    expect(
      useChartLayersStore.getState().layers.find((layer) => layer.id === id)
        ?.visible,
    ).toBe(true);
  });

  it("does not remove the market layer", () => {
    const store = useChartLayersStore.getState();

    store.removeLayer(MARKET_LAYER_ID);

    expect(
      useChartLayersStore
        .getState()
        .layers.some((layer) => layer.id === MARKET_LAYER_ID),
    ).toBe(true);
  });

  it("allows removing the builtin volume layer", () => {
    const store = useChartLayersStore.getState();

    store.removeLayer(VOLUME_LAYER_ID);

    expect(
      useChartLayersStore
        .getState()
        .layers.some((layer) => layer.id === VOLUME_LAYER_ID),
    ).toBe(false);
  });

  it("allows adding multiple builtin volume layers", () => {
    const store = useChartLayersStore.getState();

    const firstId = store.addIndicator("builtin.volume");
    const secondId = store.addIndicator("builtin.volume");

    expect(firstId).not.toBe(secondId);
    expect(
      useChartLayersStore
        .getState()
        .layers.filter(
          (layer) =>
            layer.kind === "indicator" &&
            layer.indicatorKind === "builtin.volume",
        ),
    ).toHaveLength(3);
  });

  it("updates params on an existing indicator layer", () => {
    const store = useChartLayersStore.getState();
    const id = store.addIndicator("indicator.sma");
    const addedLayer = useChartLayersStore
      .getState()
      .layers.find((layer) => layer.id === id);
    const color =
      addedLayer && isIndicatorChartLayer(addedLayer) ? addedLayer.color : "";

    store.updateIndicatorParams(id, { period: 50 });
    expect(
      useChartLayersStore
        .getState()
        .layers.find((layer) => layer.id === id && layer.kind === "indicator"),
    ).toEqual({
      id,
      kind: "indicator",
      indicatorKind: "indicator.sma",
      params: { period: 50 },
      visible: true,
      color,
    });
  });
});
