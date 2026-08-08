"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { IChartApi } from "lightweight-charts";
import { Datafeed } from "@/lib/chart";
import type { ChartStatus, MarketDataKey } from "@/lib/chart";
import {
  buildChartBlockSpecFromLayers,
  buildChartBlockSpecFromStudy,
  marketDataKeyFromGraph,
  maxWarmupBarsFromGraph,
  maxWarmupBarsFromLayers,
} from "@/lib/chart-block";
import type { ChartBlockSpec } from "@/lib/chart-block";
import type { Study } from "@/lib/studio/types";
import { useChartLayersStore } from "@/stores/useChartLayersStore";

export interface UseChartBlockDataParams {
  exchange: string;
  category: string;
  symbol: string;
  interval: string;
  /** When set, drives ChartBlockSpec from study.graph + study.presentation. */
  study?: Study | null;
}

export interface UseChartBlockDataResult {
  spec: ChartBlockSpec;
  datafeedRef: React.RefObject<Datafeed>;
  marketDataKey: MarketDataKey;
  chartReady: boolean;
  status: ChartStatus;
  error: Error | null;
  mainChartRef: React.RefObject<IChartApi | null>;
  /** True when rendering from an applied study rather than layer document. */
  studyMode: boolean;
}

export function useChartBlockData({
  exchange,
  category,
  symbol,
  interval,
  study = null,
}: UseChartBlockDataParams): UseChartBlockDataResult {
  const layers = useChartLayersStore((state) => state.layers);

  const studyMode = study != null;

  const marketDataKey = useMemo<MarketDataKey>(() => {
    if (study) {
      const fromGraph = marketDataKeyFromGraph(study.graph);
      if (fromGraph) {
        return fromGraph;
      }
    }

    return { exchange, category, symbol, interval };
  }, [study, exchange, category, symbol, interval]);

  const warmupBars = useMemo(() => {
    if (study) {
      return maxWarmupBarsFromGraph(study.graph);
    }
    return maxWarmupBarsFromLayers(layers);
  }, [study, layers]);

  const spec = useMemo(() => {
    if (study) {
      return buildChartBlockSpecFromStudy(
        study.graph,
        study.presentation,
        study.id,
      );
    }

    return buildChartBlockSpecFromLayers(marketDataKey, layers);
  }, [study, marketDataKey, layers]);

  const runKey = useMemo(
    () =>
      JSON.stringify({
        graph: spec.data.graph,
        outputs: spec.data.outputs,
        studyVersion: study?.version ?? null,
      }),
    [spec.data.graph, spec.data.outputs, study?.version],
  );

  const datafeedRef = useRef(new Datafeed());
  const lastLoadedMarketDataKeyRef = useRef<string | null>(null);
  const lastStudyModeRef = useRef(studyMode);
  const mainChartRef = useRef<IChartApi | null>(null);

  const [status, setStatus] = useState<ChartStatus>("idle");
  const [error, setError] = useState<Error | null>(null);

  // Identity of the chart "session". Changing this must mark not-ready on the *same*
  // render (setState alone only applies next render, which is too late for effects).
  const hardSwitchKey = `${studyMode}:${study?.id ?? ""}:${study?.version ?? ""}:${marketDataKey.exchange}:${marketDataKey.category}:${marketDataKey.symbol}:${marketDataKey.interval}`;
  const [seenHardSwitchKey, setSeenHardSwitchKey] = useState(hardSwitchKey);
  const hardSwitchPending = seenHardSwitchKey !== hardSwitchKey;
  if (hardSwitchPending) {
    setSeenHardSwitchKey(hardSwitchKey);
    if (status === "ready" || status === "error") {
      setStatus("loading");
      setError(null);
    }
  }

  const displayStatus: ChartStatus = marketDataKey.symbol ? status : "idle";
  const displayError = marketDataKey.symbol ? error : null;
  // hardSwitchPending: this render still has status==="ready" from previous study
  const chartReady = displayStatus === "ready" && !hardSwitchPending;

  useEffect(() => {
    datafeedRef.current.configure(spec, warmupBars);
  }, [spec, warmupBars]);

  // Subscribe before reload effect so "loading" events from loadInitial/refresh are received.
  useEffect(() => {
    const feed = datafeedRef.current;

    return feed.subscribe((event) => {
      if (event.type === "loading") {
        setStatus("loading");
        setError(null);
      }
    });
  }, []);

  useEffect(() => {
    if (!marketDataKey.symbol) {
      return;
    }

    const feed = datafeedRef.current;
    const marketDataKeyToken = JSON.stringify(marketDataKey);
    const sameMarket =
      feed.getCandleCount() > 0 &&
      lastLoadedMarketDataKeyRef.current === marketDataKeyToken;
    const studyModeChanged = lastStudyModeRef.current !== studyMode;
    lastStudyModeRef.current = studyMode;

    // Hard-reset when:
    // - in study mode (any study graph change)
    // - switching between study and layers (avoid stale candles behind loading)
    // - market key changed
    // Soft refresh only for layers-only indicator edits on the same market.
    const hardReload = studyMode || studyModeChanged || !sameMarket;

    let cancelled = false;

    // Status updates: "loading" via datafeed events; ready/error only in async callbacks.
    const reload = hardReload
      ? (feed.reset(marketDataKey), feed.loadInitial())
      : feed.refresh();

    reload.then(
      () => {
        if (!cancelled) {
          lastLoadedMarketDataKeyRef.current = marketDataKeyToken;
          setStatus("ready");
          setError(null);
        }
      },
      (cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause : new Error(String(cause)));
          setStatus("error");
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [marketDataKey, runKey, studyMode]);

  return {
    spec,
    datafeedRef,
    marketDataKey,
    chartReady,
    status: displayStatus,
    error: displayError,
    mainChartRef,
    studyMode,
  };
}
