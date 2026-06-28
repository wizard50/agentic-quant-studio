import type { LineData, Time } from "lightweight-charts";
import type { StudioRunResponse } from "@/lib/studio/types";

export type IndicatorParams = Record<string, string | number>;

export interface IndicatorInstance {
  id: string;
  kind: string;
  params: IndicatorParams;
  visible: boolean;
  color: string;
}

export interface ParamField {
  name: string;
  type: "number" | "string";
  label?: string;
  min?: number;
  max?: number;
}

export interface GraphContribution {
  nodes: Array<{
    id: string;
    kind: string;
    params: IndicatorParams;
  }>;
  edges: Array<{ from: string; to: string }>;
  outputPorts: string[];
}

export interface IndicatorDefinition {
  kind: string;
  name: string;
  description?: string;
  label: (params: IndicatorParams) => string;
  defaultParams: IndicatorParams;
  configSchema: ParamField[];
  seriesStyle: { lineWidth: 1 | 2 | 3 | 4 };
  contribute: (ctx: {
    dsNodeId: string;
    nodeId: string;
    params: IndicatorParams;
  }) => GraphContribution;
  parseLineData: (
    response: StudioRunResponse,
    nodeId: string,
    dsNodeId: string,
  ) => LineData<Time>[];
}

export interface IndicatorRuntime {
  loading: boolean;
  error: string | null;
}
