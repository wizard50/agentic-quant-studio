import type { GraphSpec } from "@/lib/studio/types";
import { INDICATOR_COLOR_POOL } from "@/lib/indicators/colors";
import { CHART_BLOCK_VERSION, MAIN_PANE_ID } from "./constants";
import { datasourcePorts, findCandlesDatasource } from "./datasource";
import { deriveOutputsFromPanes } from "./deriveOutputs";
import { MARKET_LAYER_ID } from "./layers";
import type { ChartBlockSpec, LayerSpec, PaneSpec } from "./types";

function isIndicatorKind(kind: string): boolean {
  return kind.startsWith("indicator.");
}

/**
 * Presentation v0: map a study GraphSpec to ChartBlockSpec.
 *
 * - Candles from first `datasource.candles` on the main pane
 * - Each `indicator.*` node as a line on main (`{id}.value`)
 * - Skips logic/literal; no subcharts or markers
 */
export function buildChartBlockSpecFromStudy(
  graph: GraphSpec,
  blockId = "study",
): ChartBlockSpec {
  const ds = findCandlesDatasource(graph);
  if (!ds) {
    throw new Error(
      "Study graph is missing a datasource.candles node",
    );
  }

  const ports = datasourcePorts(ds.id);
  const symbol =
    typeof ds.params.symbol === "string" ? ds.params.symbol : ds.id;

  const mainLayers: LayerSpec[] = [
    {
      id: MARKET_LAYER_ID,
      label: symbol,
      visual: "candlestick",
      ports: {
        time: ports.time,
        open: ports.open,
        high: ports.high,
        low: ports.low,
        close: ports.close,
      },
      visible: true,
    },
  ];

  let colorIndex = 0;
  for (const node of graph.nodes) {
    if (!isIndicatorKind(node.kind)) {
      continue;
    }

    const color =
      INDICATOR_COLOR_POOL[colorIndex % INDICATOR_COLOR_POOL.length]!;
    colorIndex += 1;

    mainLayers.push({
      id: node.id,
      label: node.id,
      visual: "line",
      ports: {
        time: ports.time,
        value: `${node.id}.value`,
      },
      style: { color },
      visible: true,
    });
  }

  const panes: PaneSpec[] = [
    {
      id: MAIN_PANE_ID,
      role: "main",
      height: "flex",
      layers: mainLayers,
    },
  ];

  return {
    id: blockId,
    version: CHART_BLOCK_VERSION,
    data: {
      graph,
      outputs: deriveOutputsFromPanes(panes),
    },
    panes,
  };
}
