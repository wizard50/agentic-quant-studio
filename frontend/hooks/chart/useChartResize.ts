"use client";

import { useEffect, type RefObject } from "react";
import type { BlockChartSeries } from "@/lib/chart";

export interface UseChartResizeParams {
  containerRef: RefObject<HTMLDivElement | null>;
  seriesRef: RefObject<BlockChartSeries | null>;
  revision: string;
  onResized?: () => void;
  onContainerResize?: (height: number) => void;
}

export function useChartResize({
  containerRef,
  seriesRef,
  revision,
  onResized,
  onContainerResize,
}: UseChartResizeParams): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let disposed = false;
    let raf = 0;

    const resize = () => {
      if (disposed) {
        return;
      }

      const { clientWidth, clientHeight } = container;
      onContainerResize?.(clientHeight);

      if (clientWidth === 0 || clientHeight === 0) {
        return;
      }

      const chart = seriesRef.current?.chart;
      if (!chart) {
        return;
      }

      chart.resize(clientWidth, clientHeight);
      onResized?.();
    };

    const observer = new ResizeObserver(() => {
      if (disposed) {
        return;
      }

      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(resize);
    });

    observer.observe(container);
    resize();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [containerRef, onContainerResize, onResized, revision, seriesRef]);
}
