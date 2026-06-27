import type { SeriesKey } from "@/lib/chart";
import type { StudioRunRequest } from "@/lib/studio/types";
import { INDICATOR_REGISTRY } from "./registry";
import type { IndicatorInstance } from "./types";

const DS_NODE_ID = "ds1";

export interface IndicatorRunParams {
  settings: SeriesKey;
  instances: IndicatorInstance[];
  limit?: number;
}

export function buildIndicatorRunRequest({
  settings,
  instances,
  limit,
}: IndicatorRunParams): StudioRunRequest | null {
  const activeInstances = instances.filter((instance) => instance.visible);
  if (activeInstances.length === 0) {
    return null;
  }

  const { exchange, category, symbol, interval } = settings;
  const dsParams: Record<string, string | number> = {
    exchange,
    category,
    symbol,
    interval,
  };

  if (limit != null) {
    dsParams.limit = limit;
  }

  const nodes: StudioRunRequest["graph"]["nodes"] = [
    {
      id: DS_NODE_ID,
      kind: "datasource.candles",
      params: dsParams,
    },
  ];
  const edges: StudioRunRequest["graph"]["edges"] = [];
  const outputs = [`${DS_NODE_ID}.timestamp`];

  for (const instance of activeInstances) {
    const definition = INDICATOR_REGISTRY[instance.kind];
    if (!definition) {
      continue;
    }

    const contribution = definition.contribute({
      dsNodeId: DS_NODE_ID,
      nodeId: instance.id,
      params: instance.params,
    });

    nodes.push(...contribution.nodes);
    edges.push(...contribution.edges);
    outputs.push(...contribution.outputPorts);
  }

  if (outputs.length === 1) {
    return null;
  }

  return {
    graph: {
      id: "chart-indicators",
      version: 1,
      kind: "chart",
      nodes,
      edges,
    },
    outputs,
  };
}
