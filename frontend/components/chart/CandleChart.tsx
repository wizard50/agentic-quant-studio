"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  type Time,
} from "lightweight-charts";
import type { Candle } from "@/lib/types";

interface CandleChartProps {
  candles: Candle[];
}

export function CandleChart({ candles }: CandleChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0) return;

    const container = chartContainerRef.current;

    // Create chart using the ACTUAL container size
    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "#09090b" },
        textColor: "#a1a1aa",
      },
      grid: {
        vertLines: { color: "#27272a" },
        horzLines: { color: "#27272a" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: {
        borderColor: "#27272a",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "#27272a",
      },
    });

    chartRef.current = chart;

    // Initialize series
    const candleSeries = createCandleSeries(chart);
    const volumeSeries = createVolumeSeries(chart);

    // Prepare and set data
    const candleData = candles.map((c) => ({
      time: Math.floor(c.timestamp / 1000) as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const volumeData = candles.map((c) => ({
      time: Math.floor(c.timestamp / 1000) as Time,
      value: c.volume,
      color: c.close >= c.open ? "#22c55e80" : "#ef444480",
    }));

    candleSeries.setData(candleData);
    volumeSeries.setData(volumeData);

    // Resize handler - now uses real container size
    const handleResize = () => {
      if (container && chartRef.current) {
        chartRef.current.resize(container.clientWidth, container.clientHeight);
      }
    };

    window.addEventListener("resize", handleResize);
    chart.timeScale().fitContent();

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [candles]);

  if (candles.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-950 text-zinc-500">
        No candle data loaded
      </div>
    );
  }

  return <div ref={chartContainerRef} className="w-full h-full" />;
}

// Helper: Create candlestick series
function createCandleSeries(chart: ReturnType<typeof createChart>) {
  return chart.addSeries(CandlestickSeries, {
    upColor: "#22c55e",
    downColor: "#ef4444",
    borderUpColor: "#22c55e",
    borderDownColor: "#ef4444",
    wickUpColor: "#22c55e",
    wickDownColor: "#ef4444",
  });
}

// Helper: Create volume histogram series
function createVolumeSeries(chart: ReturnType<typeof createChart>) {
  const volumeSeries = chart.addSeries(HistogramSeries, {
    color: "#3b82f6",
    priceFormat: { type: "volume" },
    priceScaleId: "volume",
  });

  chart.priceScale("volume").applyOptions({
    scaleMargins: { top: 0.8, bottom: 0 },
  });

  return volumeSeries;
}
