import { beforeEach, describe, expect, it } from "vitest";
import { INDICATOR_COLOR_POOL, TEMP_SMA_INSTANCE_ID } from "@/lib/indicators";
import { useChartIndicatorsStore } from "./useChartIndicatorsStore";

describe("useChartIndicatorsStore", () => {
  beforeEach(() => {
    useChartIndicatorsStore.setState({
      instances: [],
      runtime: {},
    });
  });

  it("adds and removes the temporary SMA instance", () => {
    const store = useChartIndicatorsStore.getState();

    expect(store.isTempSmaActive()).toBe(false);

    store.toggleTempSma();
    expect(useChartIndicatorsStore.getState().instances).toEqual([
      {
        id: TEMP_SMA_INSTANCE_ID,
        kind: "indicator.sma",
        params: { period: 20 },
        visible: true,
        color: INDICATOR_COLOR_POOL[0],
      },
    ]);
    expect(useChartIndicatorsStore.getState().isTempSmaActive()).toBe(true);

    store.toggleTempSma();
    expect(useChartIndicatorsStore.getState().instances).toEqual([]);
    expect(useChartIndicatorsStore.getState().isTempSmaActive()).toBe(false);
  });

  it("generates graph-safe ids when adding from the browser", () => {
    const store = useChartIndicatorsStore.getState();
    const id = store.addInstance("indicator.sma");

    expect(id.includes(".")).toBe(false);
    expect(useChartIndicatorsStore.getState().instances[0]?.id).toBe(id);
  });

  it("assigns distinct colors from the pool per instance", () => {
    const store = useChartIndicatorsStore.getState();

    store.addInstance("indicator.sma", undefined, "sma-a");
    store.addInstance("indicator.sma", undefined, "sma-b");

    const instances = useChartIndicatorsStore.getState().instances;
    expect(instances[0]?.color).toBe(INDICATOR_COLOR_POOL[0]);
    expect(instances[1]?.color).toBe(INDICATOR_COLOR_POOL[1]);
    expect(instances[0]?.color).not.toBe(instances[1]?.color);
  });

  it("toggles visibility without removing the instance", () => {
    const store = useChartIndicatorsStore.getState();
    const id = store.addInstance("indicator.sma");
    const color = useChartIndicatorsStore.getState().instances[0]?.color;

    store.setVisible(id, false);
    expect(useChartIndicatorsStore.getState().instances).toEqual([
      {
        id,
        kind: "indicator.sma",
        params: { period: 20 },
        visible: false,
        color,
      },
    ]);

    store.setVisible(id, true);
    expect(useChartIndicatorsStore.getState().instances[0]?.visible).toBe(true);
  });

  it("updates params on an existing instance", () => {
    const store = useChartIndicatorsStore.getState();
    const id = store.addInstance("indicator.sma");
    const color = useChartIndicatorsStore.getState().instances[0]?.color;

    store.updateParams(id, { period: 50 });
    expect(useChartIndicatorsStore.getState().instances[0]).toEqual({
      id,
      kind: "indicator.sma",
      params: { period: 50 },
      visible: true,
      color,
    });
  });
});
