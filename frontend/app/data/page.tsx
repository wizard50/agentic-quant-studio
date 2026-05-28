"use client";

import { useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Database, Play, RefreshCw } from "lucide-react";

// Hardcoded for first version
const EXCHANGES = ["bybit"] as const;
const CATEGORIES = ["spot"] as const;
const SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "BNBUSDT",
  "DOGEUSDT",
  "ADAUSDT",
];

export default function DataManagementPage() {
  const [exchange, setExchange] = useState<"bybit">("bybit");
  const [category, setCategory] = useState<"spot">("spot");
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [isIngesting, setIsIngesting] = useState(false);

  const toggleSymbol = (symbol: string) => {
    setSelectedSymbols((prev) =>
      prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol],
    );
  };

  const toggleAll = () => {
    if (selectedSymbols.length === SYMBOLS.length) {
      setSelectedSymbols([]);
    } else {
      setSelectedSymbols([...SYMBOLS]);
    }
  };

  const clearSelection = () => setSelectedSymbols([]);

  // Ingest handler
  const handleIngest = async () => {
    if (selectedSymbols.length === 0) return;

    setIsIngesting(true);

    try {
      // Call the endpoint once per symbol (current backend limitation)
      const results = await Promise.allSettled(
        selectedSymbols.map(async (symbol) => {
          const params = new URLSearchParams({
            exchange,
            category,
            symbol,
          });

          const res = await fetch(
            `/api/backend/v1/candles/ingest?${params.toString()}`,
            {
              method: "POST",
            },
          );

          if (!res.ok) {
            throw new Error(`Failed for ${symbol}`);
          }
          return symbol;
        }),
      );

      // Count successes and failures
      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - successful;

      if (failed === 0) {
        alert(`Successfully queued ingestion for ${successful} symbol(s).`);
        setSelectedSymbols([]); // Clear selection
      } else {
        alert(
          `Ingestion queued for ${successful} symbol(s). ${failed} failed. Check console for details.`,
        );
      }
    } catch (error) {
      console.error("Ingest error:", error);
      alert("An error occurred while starting ingestion.");
    } finally {
      setIsIngesting(false);
    }
  };

  return (
    <DashboardShell>
      {/* Page Header */}
      <header className="h-14 border-b border-zinc-800 bg-zinc-900 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            Data Management
          </h1>
        </div>
        <div className="text-xs px-3 py-1 rounded-2xl bg-zinc-800 text-zinc-400">
          Warehouse Overview
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-zinc-400">
                  Total Datasets
                </CardTitle>
                <Database className="h-4 w-4 text-zinc-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">142</div>
                <p className="text-xs text-zinc-500 mt-1">+3 this week</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-zinc-400">
                  Total Candles
                </CardTitle>
                <Database className="h-4 w-4 text-zinc-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">2.4M</div>
                <p className="text-xs text-zinc-500 mt-1">Across all symbols</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-zinc-400">
                  Storage Used
                </CardTitle>
                <Database className="h-4 w-4 text-zinc-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">87.3 GB</div>
                <p className="text-xs text-zinc-500 mt-1">Parquet + indexes</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-zinc-400">
                  Active Jobs
                </CardTitle>
                <Play className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-emerald-400">3</div>
                <p className="text-xs text-zinc-500 mt-1">
                  2 running • 1 queued
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex-1 w-full sm:w-auto">
              <Input
                placeholder="Search symbols (e.g. BTCUSDT)..."
                className="max-w-sm"
              />
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>

              <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                <Play className="h-4 w-4" />
                Ingest Data
              </Button>
            </div>
          </div>

          {/* QUICK INGEST */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" /> Quick Ingest
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Selectors */}
              <div className="flex flex-wrap gap-4">
                <div>
                  <div className="text-xs text-zinc-400 mb-1.5">Exchange</div>
                  <select
                    value={exchange}
                    onChange={(e) => setExchange(e.target.value as "bybit")}
                    className="bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-sm"
                  >
                    {EXCHANGES.map((ex) => (
                      <option key={ex} value={ex}>
                        {ex}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="text-xs text-zinc-400 mb-1.5">Category</div>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as "spot")}
                    className="bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-sm"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Symbol Selection with Checkboxes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">
                    Select symbols to ingest
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={toggleAll}>
                      {selectedSymbols.length === SYMBOLS.length
                        ? "Deselect All"
                        : "Select All"}
                    </Button>
                    {selectedSymbols.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearSelection}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 border border-zinc-800 rounded-lg p-4 bg-zinc-950">
                  {SYMBOLS.map((symbol) => (
                    <label
                      key={symbol}
                      className="flex items-center gap-2 cursor-pointer hover:bg-zinc-900 px-3 py-2 rounded-md"
                    >
                      <Checkbox
                        checked={selectedSymbols.includes(symbol)}
                        onCheckedChange={() => toggleSymbol(symbol)}
                      />
                      <span className="font-mono text-sm">{symbol}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <Button
                  onClick={handleIngest}
                  disabled={selectedSymbols.length === 0 || isIngesting}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70"
                >
                  {isIngesting
                    ? `Ingesting ${selectedSymbols.length} symbol(s)...`
                    : `Ingest Selected (${selectedSymbols.length})`}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* My Datasets placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>My Datasets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-zinc-500">
                (We will add the datasets table here later)
              </div>
            </CardContent>
          </Card>

          {/* Placeholder for Table */}
          <Card>
            <CardHeader>
              <CardTitle>Datasets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-64 border border-dashed border-zinc-700 rounded-xl">
                <div className="text-center text-zinc-500">
                  <Database className="mx-auto h-8 w-8 mb-3 opacity-50" />
                  <p className="font-medium">Dataset table will go here</p>
                  <p className="text-sm mt-1">
                    We will build this in the next steps
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
