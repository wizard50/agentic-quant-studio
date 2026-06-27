import { beforeEach, describe, expect, it } from "vitest";
import { TEMP_SMA_INSTANCE_ID } from "@/lib/indicators";
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
      },
    ]);
    expect(useChartIndicatorsStore.getState().isTempSmaActive()).toBe(true);

    store.toggleTempSma();
    expect(useChartIndicatorsStore.getState().instances).toEqual([]);
    expect(useChartIndicatorsStore.getState().isTempSmaActive()).toBe(false);
  });
});
