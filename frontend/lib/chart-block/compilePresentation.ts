import type { GraphSpec, NodeSpec } from "@/lib/studio/types";
import { INDICATOR_COLOR_POOL } from "@/lib/indicators/colors";
import { lookupIndicatorDefinition } from "@/lib/indicators";
import type { ChartRole } from "@/lib/indicators/catalog";
import {
  CHART_BLOCK_VERSION,
  DEFAULT_SUBCHART_PANE_HEIGHT,
  MAIN_PANE_ID,
} from "./constants";
import { datasourcePorts, findCandlesDatasource } from "./datasource";
import { deriveOutputsFromPanes } from "./deriveOutputs";
import { MARKET_LAYER_ID } from "./layers";
import type { ChartBlockSpec, LayerSpec, PaneSpec } from "./types";

function isIndicatorKind(kind: string): boolean {
  return kind.startsWith("indicator.");
}

function roleForIndicatorNode(node: NodeSpec): ChartRole {
  const definition = lookupIndicatorDefinition(node.kind);
  return definition?.chartDefaults?.role ?? "overlay";
}

function indicatorLineLayer(
  node: NodeSpec,
  timePort: string,
  color: string,
): LayerSpec {
  const definition = lookupIndicatorDefinition(node.kind);
  const value_range = definition?.chartDefaults?.value_range;

  return {
    id: node.id,
    label: definition?.name ?? node.id,
    visual: "line",
    ports: {
      time: timePort,
      value: `${node.id}.value`,
    },
    style: {
      color,
      lineWidth: definition?.seriesStyle.lineWidth ?? 2,
    },
    visible: true,
    ...(value_range ? { value_range: { ...value_range } } : {}),
  };
}

function subchartHeightForNode(node: NodeSpec): number {
  const definition = lookupIndicatorDefinition(node.kind);
  return (
    definition?.chartDefaults?.default_pane_height ?? DEFAULT_SUBCHART_PANE_HEIGHT
  );
}

/**
 * Presentation compiler (slice 1): GraphSpec + registry chart_defaults → ChartBlockSpec.
 *
 * Rules:
 * - Candles on main
 * - indicator.* overlay → main; subchart → own pane
 * - Skip logic/literal (markers later)
 * - Unknown indicator kinds default to overlay
 */
export function compilePresentation(
  graph: GraphSpec,
  blockId = "study",
): ChartBlockSpec {
  const ds = findCandlesDatasource(graph);
  if (!ds) {
    throw new Error("Study graph is missing a datasource.candles node");
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

  const subchartPanes: PaneSpec[] = [];
  let colorIndex = 0;

  for (const node of graph.nodes) {
    if (!isIndicatorKind(node.kind)) {
      continue;
    }

    const color =
      INDICATOR_COLOR_POOL[colorIndex % INDICATOR_COLOR_POOL.length]!;
    colorIndex += 1;

    const layer = indicatorLineLayer(node, ports.time, color);
    const role = roleForIndicatorNode(node);

    if (role === "subchart") {
      subchartPanes.push({
        id: node.id,
        role: "subchart",
        height: subchartHeightForNode(node),
        layers: [layer],
      });
    } else {
      mainLayers.push(layer);
    }
  }

  const panes: PaneSpec[] = [
    {
      id: MAIN_PANE_ID,
      role: "main",
      height: "flex",
      layers: mainLayers,
    },
    ...subchartPanes,
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
