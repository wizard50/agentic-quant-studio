import type { EdgeSpec, GraphSpec, NodeSpec } from "@/lib/studio/types";
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
import type {
  ChartBlockSpec,
  LayerSpec,
  LayerValueRange,
  MarkerShape,
  PaneSpec,
} from "./types";

const LITERAL_LINE_COLOR = "#a1a1aa";
const MARKER_COLOR_CROSSOVER = "#22c55e";
const MARKER_COLOR_CROSSUNDER = "#ef4444";
const MARKER_COLOR_DEFAULT = "#a855f7";

function isIndicatorKind(kind: string): boolean {
  return kind.startsWith("indicator.");
}

function isLiteralNumberKind(kind: string): boolean {
  return kind === "literal.number";
}

function isLogicKind(kind: string): boolean {
  return kind.startsWith("logic.");
}

function nodeIdFromPortRef(portRef: string): string | null {
  const dot = portRef.indexOf(".");
  if (dot <= 0) {
    return null;
  }
  return portRef.slice(0, dot);
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

function outgoingEdges(edges: EdgeSpec[], nodeId: string): EdgeSpec[] {
  const prefix = `${nodeId}.`;
  return edges.filter((edge) => edge.from.startsWith(prefix));
}

function incomingEdges(edges: EdgeSpec[], nodeId: string): EdgeSpec[] {
  const prefix = `${nodeId}.`;
  return edges.filter((edge) => edge.to.startsWith(prefix));
}

/**
 * Prefer the first non-main (subchart) pane in input order; otherwise main.
 * When both inputs are subcharts, the first input's pane wins.
 */
export function preferContextPane(paneIds: string[]): string {
  for (const paneId of paneIds) {
    if (paneId !== MAIN_PANE_ID) {
      return paneId;
    }
  }
  return MAIN_PANE_ID;
}

/**
 * Context pane for a node from peer sources into its consumers
 * (other inputs of the same consumer nodes).
 * Returns null when the node has no outgoing edges (orphan — skip).
 */
export function resolvePaneFromConsumerPeers(
  nodeId: string,
  edges: EdgeSpec[],
  paneByNodeId: Map<string, string>,
): string | null {
  const outs = outgoingEdges(edges, nodeId);
  if (outs.length === 0) {
    return null;
  }

  const peerPaneIds: string[] = [];
  const seenPeers = new Set<string>();

  for (const out of outs) {
    const consumerId = nodeIdFromPortRef(out.to);
    if (!consumerId) {
      continue;
    }

    for (const edge of incomingEdges(edges, consumerId)) {
      const peerId = nodeIdFromPortRef(edge.from);
      if (!peerId || peerId === nodeId || seenPeers.has(peerId)) {
        continue;
      }
      seenPeers.add(peerId);

      const paneId = paneByNodeId.get(peerId);
      if (paneId) {
        peerPaneIds.push(paneId);
      }
    }
  }

  if (peerPaneIds.length === 0) {
    return MAIN_PANE_ID;
  }

  return preferContextPane(peerPaneIds);
}

/**
 * Context pane from a node's own input sources (in edge order).
 * Sources without a pane assignment are skipped.
 */
export function resolvePaneFromInputs(
  nodeId: string,
  edges: EdgeSpec[],
  paneByNodeId: Map<string, string>,
): string {
  const paneIds: string[] = [];
  const seen = new Set<string>();

  for (const edge of incomingEdges(edges, nodeId)) {
    const sourceId = nodeIdFromPortRef(edge.from);
    if (!sourceId || seen.has(sourceId)) {
      continue;
    }
    seen.add(sourceId);

    const paneId = paneByNodeId.get(sourceId);
    if (paneId) {
      paneIds.push(paneId);
    }
  }

  return preferContextPane(paneIds);
}

function findPane(panes: PaneSpec[], paneId: string): PaneSpec | undefined {
  return panes.find((pane) => pane.id === paneId);
}

function firstValueRangeOnPane(pane: PaneSpec | undefined): LayerValueRange | undefined {
  if (!pane) {
    return undefined;
  }
  for (const layer of pane.layers) {
    if (layer.value_range) {
      return { ...layer.value_range };
    }
  }
  return undefined;
}

function literalLineLayer(
  node: NodeSpec,
  timePort: string,
  valueRange?: LayerValueRange,
): LayerSpec {
  return {
    id: node.id,
    label: node.id,
    visual: "line",
    ports: {
      time: timePort,
      value: `${node.id}.value`,
    },
    style: {
      color: LITERAL_LINE_COLOR,
      lineWidth: 1,
    },
    visible: true,
    ...(valueRange ? { value_range: valueRange } : {}),
  };
}

function markerShapeForLogicKind(kind: string): MarkerShape {
  if (kind === "logic.crossover") {
    return "arrowUp";
  }
  if (kind === "logic.crossunder") {
    return "arrowDown";
  }
  return "circle";
}

function markerColorForLogicKind(kind: string): string {
  if (kind === "logic.crossover") {
    return MARKER_COLOR_CROSSOVER;
  }
  if (kind === "logic.crossunder") {
    return MARKER_COLOR_CROSSUNDER;
  }
  return MARKER_COLOR_DEFAULT;
}

function logicMarkerLayer(node: NodeSpec, timePort: string): LayerSpec {
  return {
    id: node.id,
    label: node.id,
    visual: "markers",
    ports: {
      time: timePort,
      signal: `${node.id}.signal`,
    },
    style: {
      color: markerColorForLogicKind(node.kind),
      markerShape: markerShapeForLogicKind(node.kind),
    },
    visible: true,
  };
}

/**
 * Presentation compiler: GraphSpec + registry chart_defaults → ChartBlockSpec.
 *
 * Rules:
 * - Candles on main
 * - indicator.* overlay → main; subchart → own pane
 * - literal.number → line on peer/context pane (skip orphans)
 * - logic.* → markers on input-context pane
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
  const paneByNodeId = new Map<string, string>();
  let colorIndex = 0;

  // Phase A — indicators
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
      paneByNodeId.set(node.id, node.id);
    } else {
      mainLayers.push(layer);
      paneByNodeId.set(node.id, MAIN_PANE_ID);
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

  // Phase B — literal.number as lines on peer context pane
  for (const node of graph.nodes) {
    if (!isLiteralNumberKind(node.kind)) {
      continue;
    }

    const paneId = resolvePaneFromConsumerPeers(
      node.id,
      graph.edges,
      paneByNodeId,
    );
    if (paneId == null) {
      continue;
    }

    const pane = findPane(panes, paneId);
    if (!pane) {
      continue;
    }

    const valueRange = firstValueRangeOnPane(pane);
    pane.layers.push(literalLineLayer(node, ports.time, valueRange));
    paneByNodeId.set(node.id, paneId);
  }

  // Phase C — logic.* as markers on input context pane
  for (const node of graph.nodes) {
    if (!isLogicKind(node.kind)) {
      continue;
    }

    const paneId = resolvePaneFromInputs(node.id, graph.edges, paneByNodeId);
    const pane = findPane(panes, paneId);
    if (!pane) {
      continue;
    }

    pane.layers.push(logicMarkerLayer(node, ports.time));
  }

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
