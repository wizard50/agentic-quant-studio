import type { GraphSpec } from "@/lib/studio/types";

export type LayerVisual = "candlestick" | "bar" | "histogram" | "line" | "area";

export type PaneHeight = "flex" | number;

export type PaneRole = "main" | "subchart";

export interface LayerStyleSpec {
  color?: string;
  lineWidth?: 1 | 2 | 3 | 4;
}

export interface LayerSpec {
  id: string;
  label?: string;
  visual: LayerVisual;
  ports: Record<string, string>;
  style?: LayerStyleSpec;
  visible?: boolean;
}

export interface PaneSpec {
  id: string;
  role: PaneRole;
  height: PaneHeight;
  layers: LayerSpec[];
}

export interface ChartBlockDataSpec {
  graph: GraphSpec;
  outputs: string[];
}

export interface ChartBlockSpec {
  id: string;
  version: number;
  data: ChartBlockDataSpec;
  panes: PaneSpec[];
}
