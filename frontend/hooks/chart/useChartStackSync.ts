"use client";

import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import type { IChartApi, LogicalRange } from "lightweight-charts";
import {
  syncTimeScaleBetween,
  syncVisibleLogicalRangeBetween,
} from "@/lib/chart/syncTimeScale";

interface UseChartStackSyncParams {
  mainChartRef: RefObject<IChartApi | null>;
  enabled: boolean;
}

export interface ChartStackSyncApi {
  registerOscillatorChart: (
    instanceId: string,
    chart: IChartApi | null,
  ) => void;
  syncOscillatorsFromMaster: () => void;
  runOscillatorScroll: (sourceId: string, range: LogicalRange) => void;
  isProxyLocked: () => boolean;
}

export function useChartStackSync({
  mainChartRef,
  enabled,
}: UseChartStackSyncParams): ChartStackSyncApi {
  const oscillatorChartsRef = useRef(new Map<string, IChartApi>());
  const proxyLockRef = useRef(false);

  const syncOscillatorsFromMaster = useCallback(() => {
    const master = mainChartRef.current;
    if (!master) {
      return;
    }

    const logicalRange = master.timeScale().getVisibleLogicalRange();
    if (!logicalRange) {
      return;
    }

    for (const oscillator of oscillatorChartsRef.current.values()) {
      syncVisibleLogicalRangeBetween(master, oscillator, logicalRange);
    }
  }, [mainChartRef]);

  const registerOscillatorChart = useCallback(
    (instanceId: string, chart: IChartApi | null) => {
      if (chart) {
        oscillatorChartsRef.current.set(instanceId, chart);

        const master = mainChartRef.current;
        if (master) {
          syncTimeScaleBetween(master, chart);
        }
        return;
      }

      oscillatorChartsRef.current.delete(instanceId);
    },
    [mainChartRef],
  );

  const runOscillatorScroll = useCallback(
    (sourceId: string, range: LogicalRange) => {
      if (proxyLockRef.current) {
        return;
      }

      const master = mainChartRef.current;
      if (!master) {
        return;
      }

      proxyLockRef.current = true;
      try {
        master.timeScale().setVisibleLogicalRange(range);

        for (const [instanceId, oscillator] of oscillatorChartsRef.current) {
          if (instanceId === sourceId) {
            continue;
          }

          syncVisibleLogicalRangeBetween(master, oscillator, range);
        }
      } finally {
        proxyLockRef.current = false;
      }
    },
    [mainChartRef],
  );

  const isProxyLocked = useCallback(() => proxyLockRef.current, []);

  const stackSync = useMemo(
    (): ChartStackSyncApi => ({
      registerOscillatorChart,
      syncOscillatorsFromMaster,
      runOscillatorScroll,
      isProxyLocked,
    }),
    [
      registerOscillatorChart,
      syncOscillatorsFromMaster,
      runOscillatorScroll,
      isProxyLocked,
    ],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const master = mainChartRef.current;
    if (!master) {
      return;
    }

    const lock = { active: false };

    const onMasterChange = () => {
      if (lock.active || proxyLockRef.current) {
        return;
      }

      lock.active = true;
      proxyLockRef.current = true;
      try {
        syncOscillatorsFromMaster();
      } finally {
        proxyLockRef.current = false;
        lock.active = false;
      }
    };

    master.timeScale().subscribeVisibleLogicalRangeChange(onMasterChange);

    return () => {
      master.timeScale().unsubscribeVisibleLogicalRangeChange(onMasterChange);
    };
  }, [enabled, mainChartRef, syncOscillatorsFromMaster]);

  return stackSync;
}
