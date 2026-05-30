"use client";

import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, Database, Play, RefreshCw, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCatalogSummary } from "@/hooks/useCatalogSummary";
import { useActiveJobSummary } from "@/hooks/useIngestionJobs";
import { useDatasets } from "@/hooks/useCatalog";
import { formatBytes, formatCompactNumber } from "@/lib/utils";
import type { DatasetCoverage } from "@/lib/types";

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
  const [isQuickIngestOpen, setIsQuickIngestOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Real warehouse stats from backend catalog
  const { data: catalog, isLoading: isCatalogLoading } = useCatalogSummary();

  // Active ingestion jobs (for the KPI card)
  const { data: jobSummary, isLoading: isJobsLoading } = useActiveJobSummary();

  // Full list of datasets for the table
  const { datasets, isLoading: isDatasetsLoading } = useDatasets();

  // Compute which symbols are not yet in the catalog for the current market
  const availableSymbols = useMemo(() => {
    const existing = new Set(
      datasets
        .filter((d) => d.exchange === exchange && d.category === category)
        .map((d) => d.symbol),
    );
    return SYMBOLS.filter((s) => !existing.has(s));
  }, [datasets, exchange, category]);

  // Effective selected symbols that are still valid for the current market
  const validSelectedSymbols = useMemo(() => {
    return selectedSymbols.filter((s) => availableSymbols.includes(s));
  }, [selectedSymbols, availableSymbols]);

  // Filtered datasets for the table based on search
  const filteredDatasets = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return datasets;

    return datasets.filter(
      (d) =>
        d.symbol.toLowerCase().includes(term) ||
        d.exchange.toLowerCase().includes(term) ||
        d.category.toLowerCase().includes(term) ||
        d.interval.toLowerCase().includes(term),
    );
  }, [datasets, searchTerm]);

  const queryClient = useQueryClient();

  const toggleSymbol = (symbol: string) => {
    setSelectedSymbols((prev) =>
      prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol],
    );
  };

  const toggleAll = () => {
    if (validSelectedSymbols.length === availableSymbols.length) {
      setSelectedSymbols([]);
    } else {
      setSelectedSymbols([...availableSymbols]);
    }
  };

  const clearSelection = () => setSelectedSymbols([]);

  const handleRefresh = () => {
    // Invalidate both data sources used on this page
    queryClient.invalidateQueries({ queryKey: ["catalog"] });
    queryClient.invalidateQueries({ queryKey: ["ingest-jobs"] });
  };

  // Ingest handler
  const handleIngest = async () => {
    if (validSelectedSymbols.length === 0) return;

    setIsIngesting(true);

    try {
      // Call the endpoint once per symbol (current backend limitation)
      const results = await Promise.allSettled(
        validSelectedSymbols.map(async (symbol) => {
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
        // Refresh the Active Jobs card
        queryClient.invalidateQueries({ queryKey: ["ingest-jobs"] });
      } else {
        alert(
          `Ingestion queued for ${successful} symbol(s). ${failed} failed. Check console for details.`,
        );
        queryClient.invalidateQueries({ queryKey: ["ingest-jobs"] });
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
                <div className="text-2xl font-semibold">
                  {isCatalogLoading
                    ? "—"
                    : (catalog?.totalDatasets?.toLocaleString() ?? "0")}
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  {catalog?.lastUpdated
                    ? `Updated ${new Date(catalog.lastUpdated).toLocaleDateString()}`
                    : "No data yet"}
                </p>
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
                <div className="text-2xl font-semibold">
                  {isCatalogLoading
                    ? "—"
                    : formatCompactNumber(catalog?.totalCandles ?? 0)}
                </div>
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
                <div className="text-2xl font-semibold">
                  {isCatalogLoading
                    ? "—"
                    : formatBytes(catalog?.storageBytes ?? 0)}
                </div>
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
                <div className="text-2xl font-semibold text-emerald-400">
                  {isJobsLoading ? "—" : (jobSummary?.totalActive ?? 0)}
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  {isJobsLoading
                    ? "Loading..."
                    : `${jobSummary?.running ?? 0} running • ${jobSummary?.pending ?? 0} queued`}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            {/* Search */}
            <div className="flex-1 w-full lg:max-w-sm relative">
              <Input
                placeholder="Search symbols (e.g. BTCUSDT)..."
                className="pr-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div>
                <div className="text-xs text-zinc-400 mb-1">Exchange</div>
                <select
                  value={exchange}
                  onChange={(e) => setExchange(e.target.value as "bybit")}
                  className="bg-zinc-950 border border-zinc-700 rounded-md px-3 py-1.5 text-sm"
                >
                  {EXCHANGES.map((ex) => (
                    <option key={ex} value={ex}>
                      {ex}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-xs text-zinc-400 mb-1">Category</div>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as "spot")}
                  className="bg-zinc-950 border border-zinc-700 rounded-md px-3 py-1.5 text-sm"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4 lg:pt-0">
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleRefresh}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>

              <Button
                variant={isQuickIngestOpen ? "default" : "outline"}
                className="gap-2"
                onClick={() => setIsQuickIngestOpen(!isQuickIngestOpen)}
              >
                {isQuickIngestOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Quick Ingest
              </Button>
            </div>
          </div>

          {/* Quick Ingest Panel (controlled from toolbar) */}
          {isQuickIngestOpen && (
            <Card>
              <CardContent className="pt-4 space-y-4">
                {/* Symbol Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">
                      Select symbols to ingest
                      <span className="ml-1 text-zinc-500">
                        ({availableSymbols.length} available)
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {availableSymbols.length > 0 && (
                        <>
                          <Button variant="ghost" size="sm" onClick={toggleAll}>
                            {validSelectedSymbols.length ===
                            availableSymbols.length
                              ? "Deselect All"
                              : "Select All"}
                          </Button>
                          {validSelectedSymbols.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={clearSelection}
                            >
                              Clear
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {availableSymbols.length === 0 ? (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-500">
                      All symbols are already present in the catalog for this
                      market.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 border border-zinc-800 rounded-lg p-4 bg-zinc-950">
                      {availableSymbols.map((symbol) => (
                        <label
                          key={symbol}
                          className="flex items-center gap-2 cursor-pointer hover:bg-zinc-900 px-3 py-2 rounded-md"
                        >
                          <Checkbox
                            checked={validSelectedSymbols.includes(symbol)}
                            onCheckedChange={() => toggleSymbol(symbol)}
                          />
                          <span className="font-mono text-sm">{symbol}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ingest Action */}
                <div className="pt-2 flex justify-end">
                  <Button
                    onClick={handleIngest}
                    disabled={validSelectedSymbols.length === 0 || isIngesting}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70"
                  >
                    {isIngesting
                      ? `Ingesting ${validSelectedSymbols.length} symbol(s)...`
                      : `Ingest Selected (${validSelectedSymbols.length})`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Datasets Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Datasets</CardTitle>
              <span className="text-sm text-zinc-500">
                {isDatasetsLoading
                  ? "…"
                  : searchTerm
                    ? `${filteredDatasets.length} of ${datasets.length}`
                    : `${datasets.length} total`}
              </span>
            </CardHeader>
            <CardContent>
              {isDatasetsLoading ? (
                <div className="flex items-center justify-center h-48 text-zinc-500">
                  Loading datasets...
                </div>
              ) : datasets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center text-zinc-500">
                  <Database className="h-8 w-8 mb-3 opacity-50" />
                  <p className="font-medium">No datasets found</p>
                  <p className="text-sm mt-1">
                    Ingest some data to populate the catalog
                  </p>
                </div>
              ) : filteredDatasets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center text-zinc-500">
                  <p className="font-medium">No results for “{searchTerm}”</p>
                  <p className="text-sm mt-1">Try a different search term</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-zinc-800">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-950 text-zinc-400">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">
                          Symbol
                        </th>
                        <th className="px-4 py-3 text-left font-medium">
                          Exchange
                        </th>
                        <th className="px-4 py-3 text-left font-medium">
                          Category
                        </th>
                        <th className="px-4 py-3 text-left font-medium">
                          Interval
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          Records
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                          Size
                        </th>
                        <th className="px-4 py-3 text-left font-medium">
                          Last Updated
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {filteredDatasets.map((ds: DatasetCoverage) => (
                        <tr
                          key={`${ds.exchange}-${ds.category}-${ds.symbol}-${ds.interval}`}
                          className="hover:bg-zinc-900/60 transition-colors"
                        >
                          <td className="px-4 py-3 font-mono font-medium text-zinc-100">
                            {ds.symbol}
                          </td>
                          <td className="px-4 py-3 text-zinc-300">
                            {ds.exchange}
                          </td>
                          <td className="px-4 py-3 text-zinc-300">
                            {ds.category}
                          </td>
                          <td className="px-4 py-3 text-zinc-300">
                            {ds.interval}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-zinc-100">
                            {formatCompactNumber(ds.record_count)}
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-300">
                            {formatBytes(ds.approx_size_bytes)}
                          </td>
                          <td className="px-4 py-3 text-zinc-400 text-xs">
                            {new Date(ds.last_updated).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
