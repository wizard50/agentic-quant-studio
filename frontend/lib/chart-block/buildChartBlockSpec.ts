import type { MarketDataKey } from "@/lib/chart";
import {
  filterIndicatorLayers,
  isMarketChartLayer,
  type ChartLayer,
  type IndicatorChartLayer,
  type MarketChartLayer,
} from "./layers";
import {
  filterOverlayIndicatorLayers,
  filterSubchartIndicatorLayers,
  lookupIndicatorDefinition,
  seriesTypeForDefinition,
} from "@/lib/indicators";
import type { GraphSpec } from "@/lib/studio/types";
import {
  CHART_BLOCK_VERSION,
  DATASOURCE_PORTS,
  DEFAULT_SUBCHART_PANE_HEIGHT,
  DS_NODE_ID,
  MAIN_PANE_ID,
} from "./constants";
import { deriveOutputsFromPanes } from "./deriveOutputs";
import type { ChartBlockSpec, LayerSpec, PaneSpec } from "./types";

function buildDatasourceParams(
  marketDataKey: MarketDataKey,
): Record<string, string | number> {
  return {
    exchange: marketDataKey.exchange,
    category: marketDataKey.category,
    symbol: marketDataKey.symbol,
    interval: marketDataKey.interval,
  };
}

function buildGraphFromLayers(
  marketDataKey: MarketDataKey,
  indicatorLayers: IndicatorChartLayer[],
): GraphSpec {
  const nodes: GraphSpec["nodes"] = [
    {
      id: DS_NODE_ID,
      kind: "datasource.candles",
      params: buildDatasourceParams(marketDataKey),
    },
  ];
  const edges: GraphSpec["edges"] = [];

  for (const layer of indicatorLayers) {
    const definition = lookupIndicatorDefinition(layer.indicatorKind);
    if (!definition) {
      continue;
    }

    const contribution = definition.contribute({
      dsNodeId: DS_NODE_ID,
      nodeId: layer.id,
      params: layer.params,
    });

    if (contribution.nodes.length === 0) {
      continue;
    }

    nodes.push(...contribution.nodes);
    edges.push(...contribution.edges);
  }

  return {
    id: "chart-block",
    version: 1,
    kind: "chart",
    nodes,
    edges,
  };
}

function marketLayerSpec(layer: MarketChartLayer, symbol: string): LayerSpec {
  return {
    id: layer.id,
    label: layer.label ?? symbol,
    visual: layer.seriesStyle,
    ports: {
      time: DATASOURCE_PORTS.time,
      open: DATASOURCE_PORTS.open,
      high: DATASOURCE_PORTS.high,
      low: DATASOURCE_PORTS.low,
      close: DATASOURCE_PORTS.close,
    },
    visible: layer.visible,
  };
}

function overlayLayerFromIndicator(layer: IndicatorChartLayer): LayerSpec {
  return {
    id: layer.id,
    visual: "line",
    ports: {
      time: DATASOURCE_PORTS.time,
      value: `${layer.id}.value`,
    },
    style: { color: layer.color },
    visible: layer.visible,
  };
}

function subchartLayerFromIndicator(layer: IndicatorChartLayer): LayerSpec {
  const definition = lookupIndicatorDefinition(layer.indicatorKind);
  const seriesType = definition ? seriesTypeForDefinition(definition) : "line";

  if (seriesType === "histogram") {
    return {
      id: layer.id,
      label: definition?.name ?? layer.id,
      visual: "histogram",
      ports: {
        time: DATASOURCE_PORTS.time,
        value: DATASOURCE_PORTS.volume,
      },
      style: { color: layer.color },
      visible: layer.visible,
    };
  }

  return {
    id: layer.id,
    visual: "line",
    ports: {
      time: DATASOURCE_PORTS.time,
      value: `${layer.id}.value`,
    },
    style: { color: layer.color },
    visible: layer.visible,
  };
}

function subchartHeightForIndicator(layer: IndicatorChartLayer): number {
  const definition = lookupIndicatorDefinition(layer.indicatorKind);
  return (
    definition?.chartDefaults?.default_pane_height ??
    DEFAULT_SUBCHART_PANE_HEIGHT
  );
}

function subchartPaneFromIndicator(layer: IndicatorChartLayer): PaneSpec {
  return {
    id: layer.id,
    role: "subchart",
    height: subchartHeightForIndicator(layer),
    layers: [subchartLayerFromIndicator(layer)],
  };
}

export function buildChartBlockSpecFromLayers(
  marketDataKey: MarketDataKey,
  layers: ChartLayer[],
  blockId = "market-research",
): ChartBlockSpec {
  const marketLayer = layers.find(isMarketChartLayer);
  const indicatorLayers = filterIndicatorLayers(layers);
  const overlays = filterOverlayIndicatorLayers(indicatorLayers);
  const subcharts = filterSubchartIndicatorLayers(indicatorLayers);

  const mainLayers: LayerSpec[] = marketLayer
    ? [
        marketLayerSpec(marketLayer, marketDataKey.symbol),
        ...overlays.map(overlayLayerFromIndicator),
      ]
    : overlays.map(overlayLayerFromIndicator);

  const panes: PaneSpec[] = [
    {
      id: MAIN_PANE_ID,
      role: "main",
      height: "flex",
      layers: mainLayers,
    },
    ...subcharts.map(subchartPaneFromIndicator),
  ];

  return {
    id: blockId,
    version: CHART_BLOCK_VERSION,
    data: {
      graph: buildGraphFromLayers(marketDataKey, indicatorLayers),
      outputs: deriveOutputsFromPanes(panes),
    },
    panes,
  };
}
