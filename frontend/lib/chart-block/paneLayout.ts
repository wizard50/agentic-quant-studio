import type { IChartApi } from "lightweight-charts";
import { DEFAULT_SUBCHART_PANE_HEIGHT } from "./constants";
import type { PaneSpec } from "./types";

export const MIN_PANE_HEIGHT_PX = 30;
export const MIN_MAIN_PANE_HEIGHT_PX = 120;
export const MAIN_PANE_DESIRED_RATIO = 0.55;
export const MAIN_PANE_STRETCH_FACTOR = 3;
export const PANE_SEPARATOR_HEIGHT_PX = 2;

interface PaneHeightEntry {
  id: string;
  min: number;
  height: number;
}

function isMainPane(pane: PaneSpec): boolean {
  return pane.role === "main";
}

function trimPaneHeightsToBudget(
  entries: PaneHeightEntry[],
  budget: number,
): PaneHeightEntry[] {
  let total = entries.reduce((sum, entry) => sum + entry.height, 0);

  while (total > budget) {
    const reducible = entries
      .filter((entry) => entry.height > entry.min)
      .sort((left, right) => right.height - left.height);

    if (reducible.length === 0) {
      break;
    }

    for (const entry of reducible) {
      if (total <= budget) {
        break;
      }
      entry.height -= 1;
      total -= 1;
    }
  }

  return entries;
}

export function specPaneToIndex(panes: PaneSpec[], paneId: string): number {
  return panes.findIndex((pane) => pane.id === paneId);
}

export function resolvePaneHeight(pane: PaneSpec): number | null {
  if (isMainPane(pane)) {
    return null;
  }

  if (typeof pane.height === "number") {
    return pane.height;
  }

  if (pane.role === "subchart") {
    return DEFAULT_SUBCHART_PANE_HEIGHT;
  }

  return null;
}

export function paneLayoutKey(panes: PaneSpec[]): string {
  return panes
    .map((pane) => `${pane.id}:${pane.role}:${pane.height}`)
    .join("|");
}

export function countSubchartPanes(panes: PaneSpec[]): number {
  return panes.filter((pane) => pane.role === "subchart").length;
}

export function shouldShowBlockTimeScale(panes: PaneSpec[]): boolean {
  return panes.length > 0;
}

function resolveMinPaneHeight(pane: PaneSpec): number {
  return isMainPane(pane) ? MIN_MAIN_PANE_HEIGHT_PX : MIN_PANE_HEIGHT_PX;
}

function resolveDesiredPaneHeight(pane: PaneSpec, available: number): number {
  if (isMainPane(pane)) {
    return Math.max(
      MIN_MAIN_PANE_HEIGHT_PX,
      Math.floor(available * MAIN_PANE_DESIRED_RATIO),
    );
  }

  return resolvePaneHeight(pane) ?? MIN_PANE_HEIGHT_PX;
}

export function computePaneHeightsFromSpec(
  panes: PaneSpec[],
  containerHeight: number,
): Record<string, number> {
  if (panes.length === 0 || containerHeight <= 0) {
    return {};
  }

  const available =
    containerHeight - Math.max(0, panes.length - 1) * PANE_SEPARATOR_HEIGHT_PX;

  const desired = panes.map((pane) => ({
    id: pane.id,
    min: resolveMinPaneHeight(pane),
    desired: resolveDesiredPaneHeight(pane, available),
  }));

  const totalDesired = desired.reduce((sum, entry) => sum + entry.desired, 0);
  const minTotal = desired.reduce((sum, entry) => sum + entry.min, 0);
  const budget = Math.max(minTotal, available);

  let balanced: PaneHeightEntry[] = desired.map((entry) => ({
    id: entry.id,
    min: entry.min,
    height: entry.desired,
  }));

  if (totalDesired > budget) {
    const scale = budget / totalDesired;
    balanced = desired.map((entry) => ({
      id: entry.id,
      min: entry.min,
      height: Math.max(entry.min, Math.floor(entry.desired * scale)),
    }));
    balanced = trimPaneHeightsToBudget(balanced, budget);
  }

  return Object.fromEntries(balanced.map((entry) => [entry.id, entry.height]));
}

export function stretchFactorsToRenderedHeights(
  panes: PaneSpec[],
  stretchFactors: Record<string, number>,
  containerHeight: number,
): Record<string, number> {
  if (panes.length === 0 || containerHeight <= 0) {
    return {};
  }

  const separatorTotal =
    Math.max(0, panes.length - 1) * PANE_SEPARATOR_HEIGHT_PX;
  const available = containerHeight - separatorTotal;
  const weights = panes.map((pane) => stretchFactors[pane.id] ?? 0);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  if (totalWeight <= 0 || available <= 0) {
    return {};
  }

  const raw = weights.map((weight) => (available * weight) / totalWeight);
  const floored = raw.map((value) => Math.floor(value));
  let remainder = available - floored.reduce((sum, value) => sum + value, 0);

  const rendered = [...floored];
  const remainderOrder = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction);

  for (const { index } of remainderOrder) {
    if (remainder <= 0) {
      break;
    }
    rendered[index] += 1;
    remainder -= 1;
  }

  return Object.fromEntries(
    panes.map((pane, index) => [pane.id, rendered[index]]),
  );
}

export function computePaneTopOffsets(
  panes: PaneSpec[],
  containerHeight: number,
  legendInsetPx = 6,
): Record<string, number> {
  if (panes.length === 0 || containerHeight <= 0) {
    return {};
  }

  const stretchFactors = computePaneHeightsFromSpec(panes, containerHeight);
  const heights = stretchFactorsToRenderedHeights(
    panes,
    stretchFactors,
    containerHeight,
  );
  const offsets: Record<string, number> = {};
  let top = 0;

  for (let index = 0; index < panes.length; index += 1) {
    const pane = panes[index];
    offsets[pane.id] = top + legendInsetPx;
    top += heights[pane.id] ?? 0;

    if (index < panes.length - 1) {
      top += PANE_SEPARATOR_HEIGHT_PX;
    }
  }

  return offsets;
}

export function applyPaneLayoutToChart(
  chart: IChartApi,
  panes: PaneSpec[],
  containerHeight?: number,
): void {
  const balancedHeights =
    containerHeight !== undefined && containerHeight > 0
      ? computePaneHeightsFromSpec(panes, containerHeight)
      : null;

  if (balancedHeights !== null) {
    panes.forEach((paneSpec, paneIndex) => {
      const paneApi = chart.panes()[paneIndex];
      const balancedHeight = balancedHeights[paneSpec.id];
      if (!paneApi || balancedHeight === undefined) {
        return;
      }

      paneApi.setStretchFactor(balancedHeight);
    });
    return;
  }

  panes.forEach((paneSpec, paneIndex) => {
    const paneApi = chart.panes()[paneIndex];
    if (!paneApi) {
      return;
    }

    const height = resolvePaneHeight(paneSpec);
    if (height !== null) {
      paneApi.setHeight(height);
      return;
    }

    if (isMainPane(paneSpec)) {
      paneApi.setStretchFactor(MAIN_PANE_STRETCH_FACTOR);
    }
  });
}
