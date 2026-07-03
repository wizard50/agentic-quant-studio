import type { IndicatorCatalog } from "./catalog";

/** Backend-aligned fixture for unit tests and vitest setup. */
export const TEST_INDICATOR_CATALOG: IndicatorCatalog = {
  indicators: [
    {
      kind: "indicator.ema",
      inputs: [{ name: "input", type: "number", series: true }],
      outputs: [{ name: "value", type: "number", series: true }],
      params: [{ name: "period", type: "integer", default: 20, min: 1 }],
      chart_defaults: { role: "overlay", warmup_bars: 20 },
    },
    {
      kind: "indicator.rsi",
      inputs: [{ name: "input", type: "number", series: true }],
      outputs: [{ name: "value", type: "number", series: true }],
      params: [{ name: "period", type: "integer", default: 14, min: 1 }],
      chart_defaults: {
        role: "subchart",
        value_range: { min: 0, max: 100 },
        warmup_bars: 14,
      },
    },
    {
      kind: "indicator.sma",
      inputs: [{ name: "input", type: "number", series: true }],
      outputs: [{ name: "value", type: "number", series: true }],
      params: [{ name: "period", type: "integer", default: 20, min: 1 }],
      chart_defaults: { role: "overlay", warmup_bars: 20 },
    },
  ],
};
