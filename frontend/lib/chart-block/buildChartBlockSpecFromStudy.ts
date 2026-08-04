import type { GraphSpec } from "@/lib/studio/types";
import { compilePresentation } from "./compilePresentation";
import type { ChartBlockSpec } from "./types";

/**
 * Study → ChartBlockSpec via the presentation compiler.
 * Prefer `compilePresentation` for new call sites.
 */
export function buildChartBlockSpecFromStudy(
  graph: GraphSpec,
  blockId = "study",
): ChartBlockSpec {
  return compilePresentation(graph, blockId);
}
