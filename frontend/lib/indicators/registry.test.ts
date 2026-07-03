import { describe, expect, it } from "vitest";
import { VOLUME_KIND } from "./builtins";
import { getIndicatorRegistry, lookupIndicatorDefinition } from "./registry";
import { TEST_INDICATOR_CATALOG } from "./testCatalog";

const catalogKinds = TEST_INDICATOR_CATALOG.indicators.map(
  (entry) => entry.kind,
);

describe("indicator registry", () => {
  it("registers catalog indicators and frontend builtins", () => {
    expect(Object.keys(getIndicatorRegistry()).sort()).toEqual(
      [...catalogKinds, VOLUME_KIND].sort(),
    );
  });

  it("uses catalog-aligned default periods", () => {
    expect(lookupIndicatorDefinition("indicator.sma")?.defaultParams).toEqual({
      period: 20,
    });
    expect(lookupIndicatorDefinition("indicator.ema")?.defaultParams).toEqual({
      period: 20,
    });
    expect(lookupIndicatorDefinition("indicator.rsi")?.defaultParams).toEqual({
      period: 14,
    });
  });

  it("normalizes backend chart defaults for frontend rendering", () => {
    expect(lookupIndicatorDefinition("indicator.sma")?.chartDefaults).toEqual({
      role: "overlay",
      series_type: "line",
      warmup_bars: 20,
    });
    expect(lookupIndicatorDefinition("indicator.ema")?.chartDefaults).toEqual({
      role: "overlay",
      series_type: "line",
      warmup_bars: 20,
    });
    expect(lookupIndicatorDefinition("indicator.rsi")?.chartDefaults).toEqual({
      role: "subchart",
      series_type: "line",
      default_pane_height: 144,
      value_range: { min: 0, max: 100 },
      warmup_bars: 14,
    });
  });

  it("wires close into the standard input port", () => {
    const contribution = lookupIndicatorDefinition("indicator.ema")?.contribute(
      {
        dsNodeId: "ds1",
        nodeId: "ema-1",
        params: { period: 50 },
      },
    );

    expect(contribution).toEqual({
      nodes: [{ id: "ema-1", kind: "indicator.ema", params: { period: 50 } }],
      edges: [{ from: "ds1.close", to: "ema-1.input" }],
      outputPorts: ["ema-1.value"],
    });
  });
});
