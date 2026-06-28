import { describe, expect, it } from "vitest";
import {
  EMA_KIND,
  INDICATOR_REGISTRY,
  RSI_KIND,
  SMA_KIND,
} from "./registry";

describe("indicator registry", () => {
  it("registers chartable line indicators from the backend catalog", () => {
    expect(Object.keys(INDICATOR_REGISTRY).sort()).toEqual(
      [EMA_KIND, RSI_KIND, SMA_KIND].sort(),
    );
  });

  it("uses backend-aligned default periods", () => {
    expect(INDICATOR_REGISTRY[SMA_KIND]?.defaultParams).toEqual({ period: 20 });
    expect(INDICATOR_REGISTRY[EMA_KIND]?.defaultParams).toEqual({ period: 20 });
    expect(INDICATOR_REGISTRY[RSI_KIND]?.defaultParams).toEqual({ period: 14 });
  });

  it("wires close into the standard input port", () => {
    const contribution = INDICATOR_REGISTRY[EMA_KIND]?.contribute({
      dsNodeId: "ds1",
      nodeId: "ema-1",
      params: { period: 50 },
    });

    expect(contribution).toEqual({
      nodes: [{ id: "ema-1", kind: EMA_KIND, params: { period: 50 } }],
      edges: [{ from: "ds1.close", to: "ema-1.input" }],
      outputPorts: ["ema-1.value"],
    });
  });
});
