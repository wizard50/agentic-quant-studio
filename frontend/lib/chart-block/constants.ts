export const DS_NODE_ID = "ds1";
export const MAIN_PANE_ID = "main";
export const CHART_BLOCK_VERSION = 1;

export const DATASOURCE_PORTS = {
  time: `${DS_NODE_ID}.timestamp`,
  open: `${DS_NODE_ID}.open`,
  high: `${DS_NODE_ID}.high`,
  low: `${DS_NODE_ID}.low`,
  close: `${DS_NODE_ID}.close`,
  volume: `${DS_NODE_ID}.volume`,
} as const;

export const DEFAULT_VOLUME_PANE_HEIGHT = 120;
export const DEFAULT_SUBCHART_PANE_HEIGHT = 144;
