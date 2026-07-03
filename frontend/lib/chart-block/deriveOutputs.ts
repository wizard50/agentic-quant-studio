import type { ChartBlockSpec, LayerSpec, PaneSpec } from "./types";

function portsFromLayer(layer: LayerSpec): string[] {
  return Object.values(layer.ports);
}

function portsFromPane(pane: PaneSpec): string[] {
  return pane.layers.flatMap(portsFromLayer);
}

export function deriveOutputsFromPanes(panes: PaneSpec[]): string[] {
  const ports = new Set<string>();

  for (const pane of panes) {
    for (const port of portsFromPane(pane)) {
      ports.add(port);
    }
  }

  return [...ports].sort();
}

export function deriveOutputs(spec: ChartBlockSpec): string[] {
  return deriveOutputsFromPanes(spec.panes);
}
