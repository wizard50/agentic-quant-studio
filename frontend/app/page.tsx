"use client";

import { useQuery } from "@tanstack/react-query";
import { CandleChart } from "@/components/chart/CandleChart";
import { useTradingStore } from "@/stores/useTradingStore";
import type { Candle } from "@/lib/types";

import { BarChart3, Brain, Database, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function QuantResearchDashboard() {
  const {
    exchange,
    category,
    symbol,
    interval,
    limit,
    setExchange,
    setCategory,
    setSymbol,
    setInterval,
    setLimit,
  } = useTradingStore();

  const {
    data: candles = [],
    isLoading,
    error,
  } = useQuery<Candle[]>({
    queryKey: ["candles", exchange, category, symbol, interval, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        exchange,
        category,
        symbol,
        interval,
        limit: limit.toString(),
      });
      const res = await fetch(`/api/backend/v1/candles?${params}`);
      if (!res.ok) throw new Error("Failed to fetch candles");
      return res.json();
    },
    enabled: !!symbol,
  });

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-200 overflow-hidden">
      {/* LEFT SIDEBAR - Squared icons navigation */}
      <div className="w-16 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-6 gap-8">
        {/* Logo */}
        <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center text-zinc-950 font-bold text-xl">
          AQ
        </div>

        {/* Navigation */}
        <div className="flex flex-col gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="w-10 h-10 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-emerald-400"
          >
            <BarChart3 className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="w-10 h-10 rounded-2xl hover:bg-zinc-800 text-zinc-400"
          >
            <Database className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="w-10 h-10 rounded-2xl hover:bg-zinc-800 text-zinc-400"
          >
            <Brain className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="w-10 h-10 rounded-2xl hover:bg-zinc-800 text-zinc-400"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1" />
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
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

        {/* Compact Controls */}
        <div className="h-14 border-b border-zinc-800 bg-zinc-900 px-6 flex items-center gap-6 text-sm">
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
            <Input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="w-28 font-mono h-8"
            />
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

          <div className="flex items-center gap-2">
            <Label className="text-zinc-400 w-10">Limit</Label>
            <Input
              type="number"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-20 h-8"
            />
          </div>
        </div>

        {/* CHART AREA - now takes all remaining space */}
        <div className="flex-1 p-6 overflow-hidden flex flex-col">
          {isLoading && (
            <div className="flex-1 flex items-center justify-center bg-zinc-900 rounded-3xl border border-zinc-800">
              Loading candles...
            </div>
          )}

          {error && (
            <div className="flex-1 flex items-center justify-center bg-red-950/30 border border-red-900 rounded-3xl text-red-400">
              Failed to load data — is your Axum backend running?
            </div>
          )}

          {!isLoading && !error && (
            <div className="flex-1 border border-zinc-800 rounded-3xl overflow-hidden bg-zinc-950">
              <CandleChart candles={candles} />{" "}
            </div>
          )}
        </div>

        {/* Small footer info */}
        <div className="h-9 text-[10px] text-zinc-500 flex items-center px-6 border-t border-zinc-800">
          {candles.length} candles loaded • {symbol} • {interval}
        </div>
      </div>
    </div>
  );
}
