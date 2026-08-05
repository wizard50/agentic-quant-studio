import { describe, expect, it } from "vitest";
import type { StudioRunResponse } from "@/lib/studio/types";
import { parseMarkerLayerData } from "./parseMarkerLayer";
import type { LayerSpec } from "./types";

const response: StudioRunResponse = {
  outputs: {
    "ds1.timestamp": {
      kind: "series_i64",
      values: [1_700_000_000_000, 1_700_000_060_000, 1_700_000_120_000],
    },
    "reclaim.signal": {
      kind: "series_bool",
      values: [false, true, null],
    },
  },
  meta: { graph_id: "g" },
};

const layer: LayerSpec = {
  id: "reclaim",
  visual: "markers",
  ports: {
    time: "ds1.timestamp",
    signal: "reclaim.signal",
  },
  style: {
    color: "#22c55e",
    markerShape: "arrowUp",
  },
};

describe("parseMarkerLayerData", () => {
  it("emits markers only for true signal bars", () => {
    const markers = parseMarkerLayerData(response, layer);
    expect(markers).toHaveLength(1);
    expect(markers![0]).toMatchObject({
      time: 1_700_000_060,
      shape: "arrowUp",
      color: "#22c55e",
      position: "belowBar",
    });
  });

  it("returns null when ports are missing or wrong kind", () => {
    expect(
      parseMarkerLayerData(response, {
        ...layer,
        ports: { time: "ds1.timestamp" },
      }),
    ).toBeNull();

    expect(
      parseMarkerLayerData(
        {
          outputs: {
            "ds1.timestamp": {
              kind: "series_i64",
              values: [1],
            },
            "reclaim.signal": {
              kind: "series_f64",
              values: [1],
            },
          },
          meta: { graph_id: "g" },
        },
        layer,
      ),
    ).toBeNull();
  });

  it("uses aboveBar for arrowDown", () => {
    const markers = parseMarkerLayerData(response, {
      ...layer,
      style: { color: "#ef4444", markerShape: "arrowDown" },
    });
    expect(markers![0]?.position).toBe("aboveBar");
    expect(markers![0]?.shape).toBe("arrowDown");
  });
});
