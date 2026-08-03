import type { GraphSpec, NodeSpec } from "@/lib/studio/types";
import type { MarketDataKey } from "@/lib/chart";
import { DS_NODE_ID } from "./constants";

export const CANDLES_DATASOURCE_KIND = "datasource.candles";

/** First candles datasource node (by kind), else node id `ds1` if present. */
export function findCandlesDatasource(graph: GraphSpec): NodeSpec | undefined {
  const byKind = graph.nodes.find(
    (node) => node.kind === CANDLES_DATASOURCE_KIND,
  );
  if (byKind) {
    return byKind;
  }

  return graph.nodes.find((node) => node.id === DS_NODE_ID);
}

export function resolveDatasourceNodeId(graph: GraphSpec): string | undefined {
  return findCandlesDatasource(graph)?.id;
}

export function marketDataKeyFromDatasource(
  node: NodeSpec,
): MarketDataKey | null {
  const exchange = node.params.exchange;
  const category = node.params.category;
  const symbol = node.params.symbol;
  const interval = node.params.interval;

  if (
    typeof exchange !== "string" ||
    typeof category !== "string" ||
    typeof symbol !== "string" ||
    typeof interval !== "string" ||
    !exchange ||
    !category ||
    !symbol ||
    !interval
  ) {
    return null;
  }

  return { exchange, category, symbol, interval };
}

export function marketDataKeyFromGraph(graph: GraphSpec): MarketDataKey | null {
  const ds = findCandlesDatasource(graph);
  if (!ds) {
    return null;
  }
  return marketDataKeyFromDatasource(ds);
}

export function datasourcePorts(dsNodeId: string) {
  return {
    time: `${dsNodeId}.timestamp`,
    open: `${dsNodeId}.open`,
    high: `${dsNodeId}.high`,
    low: `${dsNodeId}.low`,
    close: `${dsNodeId}.close`,
    volume: `${dsNodeId}.volume`,
  } as const;
}
