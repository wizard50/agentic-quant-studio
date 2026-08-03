"use client";

import { useEffect, useMemo, useRef } from "react";
import { ChartBlock } from "@/components/chart/ChartBlock";
import { NoDatasetsMessage } from "@/components/chart/NoDatasetsMessage";
import { useTradingStore } from "@/stores/useTradingStore";
import { getMarketSymbols, useDatasets } from "@/hooks/useCatalog";
import { LAYERS_SELECTION, useStudies } from "@/hooks/useStudies";
import type { MarketDataKey } from "@/lib/chart";
import { marketDataKeyFromGraph } from "@/lib/chart-block";
import { formatStudyLabel } from "@/lib/studio/studySelection";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { IndicatorBrowser } from "@/components/chart/IndicatorBrowser";
import { DashboardShell } from "@/components/layout/DashboardShell";

export default function QuantResearchDashboard() {
  const {
    exchange,
    category,
    symbol,
    interval,
    setExchange,
    setCategory,
    setSymbol,
    setInterval,
  } = useTradingStore();

  const {
    studies,
    selected,
    loading: studiesLoading,
    disableControls,
    error: studiesError,
    actionError,
    select,
    reload,
    accept,
    remove,
    busy,
  } = useStudies();

  const {
    datasets,
    isLoading: catalogLoading,
    error: catalogError,
  } = useDatasets();

  /** Local market while on Layers; restored when leaving a study. */
  const layersMarketRef = useRef<MarketDataKey>({
    exchange,
    category,
    symbol,
    interval,
  });
  const wasStudySelectedRef = useRef(false);

  // Enter study: snapshot layers market then apply graph market.
  // Leave study: restore snapshot. Steady layers: keep snapshot in sync.
  useEffect(() => {
    if (selected) {
      if (!wasStudySelectedRef.current) {
        // First frame with a study: store still holds the layers market.
        layersMarketRef.current = { exchange, category, symbol, interval };
      }
      const key = marketDataKeyFromGraph(selected.graph);
      if (key) {
        setExchange(key.exchange);
        setCategory(key.category);
        setSymbol(key.symbol);
        setInterval(key.interval);
      }
      wasStudySelectedRef.current = true;
      return;
    }

    if (wasStudySelectedRef.current) {
      const saved = layersMarketRef.current;
      setExchange(saved.exchange);
      setCategory(saved.category);
      setSymbol(saved.symbol);
      setInterval(saved.interval);
      wasStudySelectedRef.current = false;
      return;
    }

    layersMarketRef.current = { exchange, category, symbol, interval };
  }, [
    selected,
    exchange,
    category,
    symbol,
    interval,
    setExchange,
    setCategory,
    setSymbol,
    setInterval,
  ]);

  const catalogSymbols = useMemo(
    () => getMarketSymbols(datasets, exchange, category),
    [datasets, exchange, category],
  );

  const availableSymbols = catalogLoading
    ? symbol
      ? [symbol]
      : []
    : catalogSymbols;

  const activeSymbol =
    availableSymbols.length === 0
      ? ""
      : availableSymbols.includes(symbol)
        ? symbol
        : availableSymbols[0];

  useEffect(() => {
    if (catalogLoading || selected) {
      return;
    }
    if (activeSymbol && activeSymbol !== symbol) {
      setSymbol(activeSymbol);
    }
  }, [catalogLoading, activeSymbol, symbol, setSymbol, selected]);

  const studySelected = selected != null;
  const studySelectValue = studySelected
    ? selected.id
    : LAYERS_SELECTION;

  const canShowChart =
    studySelected ||
    (!catalogLoading && !catalogError && catalogSymbols.length > 0);

  return (
    <DashboardShell>
      <header className="h-14 border-b border-zinc-800 bg-zinc-900 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            Market Research
          </h1>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {studiesLoading ? (
            <span className="px-3 py-1 rounded-2xl bg-zinc-800 text-zinc-400">
              Loading studies…
            </span>
          ) : studiesError ? (
            <span className="px-3 py-1 rounded-2xl bg-red-950/50 text-red-300 border border-red-900/50">
              Studies: {studiesError.message}
            </span>
          ) : studySelected ? (
            <span className="px-3 py-1 rounded-2xl bg-amber-950/60 text-amber-200 border border-amber-800/50">
              {selected.status} · v{selected.version}
            </span>
          ) : (
            <span className="px-3 py-1 rounded-2xl bg-zinc-800 text-zinc-400">
              Layers
            </span>
          )}
        </div>
      </header>

      <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-6 flex items-center text-sm">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-zinc-400 w-16">Exchange</Label>
            <Select
              value={exchange}
              onValueChange={setExchange}
              disabled={studySelected}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bybit">Bybit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-zinc-400 w-16">Category</Label>
            <Select
              value={category}
              onValueChange={setCategory}
              disabled={studySelected}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="spot">Spot</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-zinc-400 w-12">Symbol</Label>
            <Select
              value={activeSymbol || undefined}
              onValueChange={setSymbol}
              disabled={
                studySelected ||
                (!catalogLoading && catalogSymbols.length === 0)
              }
            >
              <SelectTrigger className="w-36 font-mono">
                <SelectValue
                  placeholder={catalogLoading ? "Loading..." : "No symbols"}
                />
              </SelectTrigger>
              <SelectContent>
                {availableSymbols.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-zinc-400 w-14">Interval</Label>
            <Select
              value={interval}
              onValueChange={setInterval}
              disabled={studySelected}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1m">1 minute</SelectItem>
                <SelectItem value="5m">5 minutes</SelectItem>
                <SelectItem value="15m">15 minutes</SelectItem>
                <SelectItem value="1h">1 hour</SelectItem>
                <SelectItem value="4h">4 hours</SelectItem>
                <SelectItem value="1d">1 day</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div
            className="h-6 w-px bg-zinc-700"
            role="separator"
            aria-orientation="vertical"
          />

          <div className="flex items-center gap-2">
            <Label className="text-zinc-400">Study</Label>
            <Select
              value={studySelectValue}
              onValueChange={(value) => {
                if (value === LAYERS_SELECTION) {
                  select(null);
                } else {
                  select(value);
                }
              }}
              disabled={disableControls}
            >
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Select study" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={LAYERS_SELECTION}>
                  Layers (local)
                </SelectItem>
                {studies.map((study) => (
                  <SelectItem key={study.id} value={study.id}>
                    {formatStudyLabel(study)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={reload}
            disabled={disableControls}
          >
            Reload
          </Button>

          {selected?.status === "draft" ? (
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => void accept(selected.id)}
              disabled={busy}
            >
              Accept
            </Button>
          ) : null}

          {selected && selected.status !== "applied" ? (
            <Button
              type="button"
              variant="destructive"
              size="xs"
              onClick={() => void remove(selected.id)}
              disabled={busy}
            >
              Delete
            </Button>
          ) : null}

          {!studySelected ? (
            <>
              <div
                className="h-6 w-px bg-zinc-700"
                role="separator"
                aria-orientation="vertical"
              />
              <IndicatorBrowser />
            </>
          ) : null}
        </div>
      </div>

      {actionError ? (
        <div className="px-6 py-2 text-xs text-red-400 border-b border-zinc-800 bg-zinc-950">
          {actionError.message}
        </div>
      ) : null}

      {catalogLoading && !studySelected ? (
        <div className="flex-1 p-6 overflow-hidden flex flex-col">
          <div className="relative flex-1 border border-zinc-800 rounded-3xl overflow-hidden bg-zinc-950 flex items-center justify-center">
            <p className="text-sm text-zinc-400">
              Loading available markets...
            </p>
          </div>
        </div>
      ) : catalogError && !studySelected ? (
        <div className="flex-1 p-6 overflow-hidden flex flex-col">
          <div className="relative flex-1 border border-zinc-800 rounded-3xl overflow-hidden bg-zinc-950 flex items-center justify-center">
            <p className="text-sm text-red-400">
              Failed to load catalog — is your Axum backend running?
            </p>
          </div>
        </div>
      ) : !canShowChart ? (
        <NoDatasetsMessage />
      ) : (
        <ChartBlock
          exchange={exchange}
          category={category}
          symbol={studySelected ? symbol : activeSymbol}
          interval={interval}
          study={selected}
        />
      )}
    </DashboardShell>
  );
}
