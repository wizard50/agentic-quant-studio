"use client";

import type { IChartApi } from "lightweight-charts";
import { useEffect, type RefObject } from "react";

export function useChartResize(
  containerRef: RefObject<HTMLDivElement | null>,
  chartRef: RefObject<IChartApi | null>,
): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let raf = 0;

    const resize = () => {
      const chart = chartRef.current;
      if (!chart) {
        return;
      }

      const { clientWidth, clientHeight } = container;
      if (clientWidth === 0 || clientHeight === 0) {
        return;
      }

      chart.resize(clientWidth, clientHeight);
    };

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(resize);
    });

    observer.observe(container);
    resize();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [containerRef, chartRef]);
}
