import { describe, expect, it } from "vitest";
import { INDICATOR_COLOR_POOL, pickIndicatorColor } from "./colors";
import type { IndicatorInstance } from "./types";

function makeInstance(id: string, color: string): IndicatorInstance {
  return {
    id,
    kind: "indicator.sma",
    params: { period: 20 },
    visible: true,
    color,
  };
}

describe("indicator colors", () => {
  it("exposes ten distinct pool colors", () => {
    expect(INDICATOR_COLOR_POOL).toHaveLength(10);
    expect(new Set(INDICATOR_COLOR_POOL).size).toBe(10);
  });

  it("picks the first unused color from the pool", () => {
    expect(pickIndicatorColor([])).toBe(INDICATOR_COLOR_POOL[0]);
    expect(
      pickIndicatorColor([makeInstance("a", INDICATOR_COLOR_POOL[0])]),
    ).toBe(INDICATOR_COLOR_POOL[1]);
  });

  it("cycles when all pool colors are already used", () => {
    const used = INDICATOR_COLOR_POOL.map((color, index) =>
      makeInstance(`id-${index}`, color),
    );

    expect(pickIndicatorColor(used)).toBe(INDICATOR_COLOR_POOL[0]);
  });
});
