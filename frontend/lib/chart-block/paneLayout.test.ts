import { describe, expect, it } from "vitest";
import type { IChartApi } from "lightweight-charts";
import {
  applyPaneLayoutToChart,
  computePaneHeightsFromSpec,
  computePaneTopOffsets,
  countSubchartPanes,
  paneLayoutKey,
  resolvePaneHeight,
  shouldShowBlockTimeScale,
  specPaneToIndex,
  stretchFactorsToRenderedHeights,
} from "./paneLayout";
import type { PaneSpec } from "./types";

const panes: PaneSpec[] = [
  {
    id: "main",
    role: "main",
    height: "flex",
    layers: [{ id: "candles", visual: "candlestick", ports: {} }],
  },
  {
    id: "volume",
    role: "subchart",
    height: 120,
    layers: [{ id: "volume", visual: "histogram", ports: {} }],
  },
  {
    id: "rsi-14",
    role: "subchart",
    height: 144,
    layers: [{ id: "rsi-14", visual: "line", ports: {} }],
  },
];

describe("paneLayout", () => {
  it("maps pane ids to spec order indices", () => {
    expect(specPaneToIndex(panes, "volume")).toBe(1);
    expect(specPaneToIndex(panes, "rsi-14")).toBe(2);
  });

  it("counts subchart panes", () => {
    expect(countSubchartPanes(panes)).toBe(2);
  });

  it("shows the block time scale when panes exist", () => {
    expect(shouldShowBlockTimeScale(panes)).toBe(true);
    expect(
      shouldShowBlockTimeScale([
        {
          id: "main",
          role: "main",
          height: "flex",
          layers: [{ id: "candles", visual: "candlestick", ports: {} }],
        },
      ]),
    ).toBe(true);
    expect(shouldShowBlockTimeScale([])).toBe(false);
  });

  it("resolves numeric and default heights", () => {
    expect(resolvePaneHeight(panes[0])).toBeNull();
    expect(resolvePaneHeight(panes[1])).toBe(120);
    expect(resolvePaneHeight(panes[2])).toBe(144);
  });

  it("builds a stable layout key", () => {
    expect(paneLayoutKey(panes)).toBe(
      "main:main:flex|volume:subchart:120|rsi-14:subchart:144",
    );
  });

  it("scales pane heights proportionally when space is tight", () => {
    const balanced = computePaneHeightsFromSpec(panes, 360);

    expect(balanced.main).toBeLessThan(Math.floor(358 * 0.55));
    expect(balanced.volume).toBeLessThan(120);
    expect(balanced["rsi-14"]).toBeLessThan(144);
    expect(
      balanced.main + balanced.volume + balanced["rsi-14"],
    ).toBeLessThanOrEqual(358);
  });

  it("keeps desired heights when there is enough container space", () => {
    const balanced = computePaneHeightsFromSpec(panes, 900);

    expect(balanced.main).toBe(Math.floor(896 * 0.55));
    expect(balanced.volume).toBe(120);
    expect(balanced["rsi-14"]).toBe(144);
  });

  it("maps stretch factors to rendered pixel heights", () => {
    const factors = computePaneHeightsFromSpec(panes, 900);
    const rendered = stretchFactorsToRenderedHeights(panes, factors, 900);

    expect(rendered.main + rendered.volume + rendered["rsi-14"]).toBe(896);
    expect(rendered.main).toBeGreaterThan(factors.main);
  });

  it("computes legend offsets from rendered pane heights", () => {
    const factors = computePaneHeightsFromSpec(panes, 900);
    const rendered = stretchFactorsToRenderedHeights(panes, factors, 900);
    const offsets = computePaneTopOffsets(panes, 900);

    expect(offsets.main).toBe(6);
    expect(offsets.volume).toBe(rendered.main + 2 + 6);
    expect(offsets["rsi-14"]).toBe(rendered.main + 2 + rendered.volume + 2 + 6);
  });

  it("applies balanced stretch factors when container height is known", () => {
    const calls: Array<{ index: number; stretch: number }> = [];
    const chart = {
      panes: () => [
        {
          setStretchFactor: (stretch: number) =>
            calls.push({ index: 0, stretch }),
        },
        {
          setStretchFactor: (stretch: number) =>
            calls.push({ index: 1, stretch }),
        },
        {
          setStretchFactor: (stretch: number) =>
            calls.push({ index: 2, stretch }),
        },
      ],
    } as unknown as IChartApi;

    applyPaneLayoutToChart(chart, panes, 360);

    const balanced = computePaneHeightsFromSpec(panes, 360);

    expect(calls).toContainEqual({ index: 0, stretch: balanced.main });
    expect(calls).toContainEqual({ index: 1, stretch: balanced.volume });
    expect(calls).toContainEqual({ index: 2, stretch: balanced["rsi-14"] });
  });
});
