import { describe, expect, it } from "vitest";
import {
  definitionFromCatalogEntry,
  normalizeChartDefaults,
} from "./buildFromCatalog";

describe("buildFromCatalog", () => {
  it("applies default subchart pane height when none is provided", () => {
    expect(
      normalizeChartDefaults({
        role: "subchart",
        value_range: { min: 0, max: 100 },
        warmup_bars: 14,
      }),
    ).toEqual({
      role: "subchart",
      series_type: "line",
      default_pane_height: 144,
      value_range: { min: 0, max: 100 },
      warmup_bars: 14,
    });
  });

  it("builds generic graph wiring from catalog ports", () => {
    const definition = definitionFromCatalogEntry({
      kind: "indicator.sma",
      inputs: [{ name: "input", type: "number", series: true }],
      outputs: [{ name: "value", type: "number", series: true }],
      params: [{ name: "period", type: "integer", default: 20, min: 1 }],
      chart_defaults: { role: "overlay", warmup_bars: 20 },
    });

    expect(
      definition.contribute({
        dsNodeId: "ds1",
        nodeId: "sma-20",
        params: { period: 20 },
      }),
    ).toEqual({
      nodes: [{ id: "sma-20", kind: "indicator.sma", params: { period: 20 } }],
      edges: [{ from: "ds1.close", to: "sma-20.input" }],
      outputPorts: ["sma-20.value"],
    });
  });
});
