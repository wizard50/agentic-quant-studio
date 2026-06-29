import { ColorType, createChart, CrosshairMode } from "lightweight-charts";
import { CHART_COLORS } from "./theme";

export function createOscillatorChart(container: HTMLElement) {
  const chart = createChart(container, {
    width: container.clientWidth,
    height: container.clientHeight,
    layout: {
      background: { type: ColorType.Solid, color: CHART_COLORS.background },
      textColor: CHART_COLORS.text,
    },
    grid: {
      vertLines: { color: CHART_COLORS.grid },
      horzLines: { color: CHART_COLORS.grid },
    },
    crosshair: { mode: CrosshairMode.Normal },
    handleScale: false,
    timeScale: {
      borderColor: CHART_COLORS.grid,
      timeVisible: true,
      secondsVisible: false,
    },
    rightPriceScale: {
      borderColor: CHART_COLORS.grid,
    },
  });

  return { chart };
}
