"use client";

import { useEffect, useMemo } from "react";
import { CandleChartPanel } from "@/components/chart/CandleChartPanel";
import { NoDatasetsMessage } from "@/components/chart/NoDatasetsMessage";
import { useTradingStore } from "@/stores/useTradingStore";
import { getMarketSymbols, useDatasets } from "@/hooks/useCatalog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IndicatorToolbar } from "@/components/chart/IndicatorToolbar";
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
    datasets,
    isLoading: catalogLoading,
    error: catalogError,
  } = useDatasets();

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
    if (catalogLoading) {
      return;
    }
    if (activeSymbol && activeSymbol !== symbol) {
      setSymbol(activeSymbol);
    }
  }, [catalogLoading, activeSymbol, symbol, setSymbol]);

  return (
    <DashboardShell>
      <header className="h-14 border-b border-zinc-800 bg-zinc-900 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            Market Research
          </h1>
        </div>
        <div className="text-xs px-3 py-1 rounded-2xl bg-zinc-800 text-zinc-400">
          Candle Visualization
        </div>
      </header>

      <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-6 flex items-center justify-between text-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Label className="text-zinc-400 w-16">Exchange</Label>
            <Select value={exchange} onValueChange={setExchange}>
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
            <Select value={category} onValueChange={setCategory}>
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
              disabled={!catalogLoading && catalogSymbols.length === 0}
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
            <Select value={interval} onValueChange={setInterval}>
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
        </div>

        <IndicatorToolbar />
      </div>

      {catalogLoading ? (
        <div className="flex-1 p-6 overflow-hidden flex flex-col">
          <div className="relative flex-1 border border-zinc-800 rounded-3xl overflow-hidden bg-zinc-950 flex items-center justify-center">
            <p className="text-sm text-zinc-400">
              Loading available markets...
            </p>
          </div>
        </div>
      ) : catalogError ? (
        <div className="flex-1 p-6 overflow-hidden flex flex-col">
          <div className="relative flex-1 border border-zinc-800 rounded-3xl overflow-hidden bg-zinc-950 flex items-center justify-center">
            <p className="text-sm text-red-400">
              Failed to load catalog — is your Axum backend running?
            </p>
          </div>
        </div>
      ) : catalogSymbols.length === 0 ? (
        <NoDatasetsMessage />
      ) : (
        <CandleChartPanel
          exchange={exchange}
          category={category}
          symbol={activeSymbol}
          interval={interval}
        />
      )}
    </DashboardShell>
  );
}
