import type { GraphSpec } from "@/lib/studio/types";
import type { ChartBlockSpec, PresentationSpec } from "./types";

/**
 * Pair a study graph with its backend-compiled presentation.
 * Does not re-derive panes; agents/server own placement via compile_presentation.
 */
export function buildChartBlockSpecFromStudy(
  graph: GraphSpec,
  presentation: PresentationSpec,
  blockId = "study",
): ChartBlockSpec {
  return {
    id: blockId,
    version: presentation.version,
    data: {
      graph,
      outputs: presentation.outputs,
    },
    panes: presentation.panes,
  };
}
