import { describe, expect, it } from "vitest";
import { deriveOutputsFromPanes } from "./deriveOutputs";
import type { PaneSpec } from "./types";

describe("deriveOutputsFromPanes", () => {
  it("collects unique ports from all pane layers", () => {
    const panes: PaneSpec[] = [
      {
        id: "main",
        role: "main",
        height: "flex",
        layers: [
          {
            id: "candles",
            visual: "candlestick",
            ports: {
              time: "ds1.timestamp",
              open: "ds1.open",
              high: "ds1.high",
              low: "ds1.low",
              close: "ds1.close",
            },
          },
          {
            id: "sma20",
            visual: "line",
            ports: {
              time: "ds1.timestamp",
              value: "sma20.value",
            },
          },
        ],
      },
      {
        id: "volume",
        role: "subchart",
        height: 120,
        layers: [
          {
            id: "volume",
            visual: "histogram",
            ports: {
              time: "ds1.timestamp",
              value: "ds1.volume",
            },
          },
        ],
      },
    ];

    expect(deriveOutputsFromPanes(panes)).toEqual([
      "ds1.close",
      "ds1.high",
      "ds1.low",
      "ds1.open",
      "ds1.timestamp",
      "ds1.volume",
      "sma20.value",
    ]);
  });
});
