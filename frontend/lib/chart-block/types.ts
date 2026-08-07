import type { GraphSpec } from "@/lib/studio/types";

export type LayerVisual =
  | "candlestick"
  | "bar"
  | "histogram"
  | "line"
  | "area"
  | "markers";

export type MarkerShape = "arrowUp" | "arrowDown" | "circle" | "square";

export type PaneHeight = "flex" | number;

export type PaneRole = "main" | "subchart";

export interface LayerStyleSpec {
  color?: string;
  lineWidth?: 1 | 2 | 3 | 4;
  /** Used when visual is "markers". */
  markerShape?: MarkerShape;
}

/** Fixed price scale range (from catalog chart_defaults.value_range). */
export interface LayerValueRange {
  min: number;
  max: number;
}

export interface LayerSpec {
  id: string;
  label?: string;
  visual: LayerVisual;
  ports: Record<string, string>;
  style?: LayerStyleSpec;
  visible?: boolean;
  /** When set, renderer uses a fixed autoscale range (e.g. RSI 0–100). */
  value_range?: LayerValueRange;
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

/**
 * Backend-derived presentation (from compile_presentation / Study.presentation).
 * Graph is not embedded; callers pair with Study.graph.
 */
export interface PresentationSpec {
  version: number;
  panes: PaneSpec[];
  outputs: string[];
}
