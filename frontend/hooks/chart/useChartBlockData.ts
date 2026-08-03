"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { IChartApi } from "lightweight-charts";
import { Datafeed } from "@/lib/chart";
import type { ChartStatus, MarketDataKey } from "@/lib/chart";
import {
  buildChartBlockSpecFromLayers,
  buildChartBlockSpecFromStudy,
  marketDataKeyFromGraph,
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
  /** When set, drives ChartBlockSpec from the study graph (presentation v0). */
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

  const warmupBars = useMemo(
    () => (studyMode ? 0 : maxWarmupBarsFromLayers(layers)),
    [layers, studyMode],
  );

  const spec = useMemo(() => {
    if (study) {
      return buildChartBlockSpecFromStudy(study.graph);
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
  const mainChartRef = useRef<IChartApi | null>(null);

  const [status, setStatus] = useState<ChartStatus>("idle");
  const [error, setError] = useState<Error | null>(null);

  const displayStatus: ChartStatus = marketDataKey.symbol ? status : "idle";
  const displayError = marketDataKey.symbol ? error : null;
  const chartReady = displayStatus === "ready";

  useEffect(() => {
    datafeedRef.current.configure(spec, warmupBars);
  }, [spec, warmupBars]);

  useEffect(() => {
    if (!marketDataKey.symbol) {
      return;
    }

    const feed = datafeedRef.current;
    const marketDataKeyToken = JSON.stringify(marketDataKey);
    const hadDataForMarket =
      feed.getCandleCount() > 0 &&
      lastLoadedMarketDataKeyRef.current === marketDataKeyToken;

    let cancelled = false;

    const reload = hadDataForMarket
      ? feed.refresh()
      : (feed.reset(marketDataKey), feed.loadInitial());

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
  }, [marketDataKey, runKey]);

  useEffect(() => {
    const feed = datafeedRef.current;

    return feed.subscribe((event) => {
      if (event.type === "loading") {
        setStatus("loading");
        setError(null);
      }
    });
  }, []);

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
