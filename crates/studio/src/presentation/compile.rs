use std::collections::{BTreeMap, HashMap, HashSet};

use crate::error::{Error, Result};
use crate::presentation::colors::{
    indicator_color, LITERAL_LINE_COLOR, MARKER_COLOR_CROSSOVER, MARKER_COLOR_CROSSUNDER,
    MARKER_COLOR_DEFAULT,
};
use crate::presentation::types::{
    LayerSpec, LayerStyle, LayerVisual, MarkerShape, PaneHeight, PaneRole, PaneSpec,
    PresentationSpec, DEFAULT_SUBCHART_PANE_HEIGHT, MAIN_PANE_ID, MARKET_LAYER_ID,
    PRESENTATION_VERSION,
};
use crate::registry::NodeRegistry;
use crate::runtime::display::{ChartRole, ValueRange};
use crate::spec::{Edge, GraphSpec, NodeSpec};

fn is_indicator_kind(kind: &str) -> bool {
    kind.starts_with("indicator.")
}

fn is_literal_number_kind(kind: &str) -> bool {
    kind == "literal.number"
}

fn is_logic_kind(kind: &str) -> bool {
    kind.starts_with("logic.")
}

fn port_ref(node_id: &str, port: &str) -> String {
    format!("{node_id}.{port}")
}

fn find_candles_datasource(graph: &GraphSpec) -> Option<&NodeSpec> {
    graph
        .nodes
        .iter()
        .find(|node| node.kind == "datasource.candles")
}

fn symbol_label(ds: &NodeSpec) -> String {
    ds.params
        .get("symbol")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .unwrap_or_else(|| ds.id.clone())
}

fn outgoing_edges<'a>(edges: &'a [Edge], node_id: &str) -> Vec<&'a Edge> {
    edges
        .iter()
        .filter(|edge| edge.from.node_id == node_id)
        .collect()
}

fn incoming_edges<'a>(edges: &'a [Edge], node_id: &str) -> Vec<&'a Edge> {
    edges
        .iter()
        .filter(|edge| edge.to.node_id == node_id)
        .collect()
}

/// Prefer the first non-main (subchart) pane in order; otherwise main.
pub fn prefer_context_pane(pane_ids: &[String]) -> String {
    for pane_id in pane_ids {
        if pane_id != MAIN_PANE_ID {
            return pane_id.clone();
        }
    }
    MAIN_PANE_ID.to_string()
}

/// Context pane for a node from peer sources into its consumers.
/// Returns `None` when the node has no outgoing edges (orphan — skip).
pub fn resolve_pane_from_consumer_peers(
    node_id: &str,
    edges: &[Edge],
    pane_by_node_id: &HashMap<String, String>,
) -> Option<String> {
    let outs = outgoing_edges(edges, node_id);
    if outs.is_empty() {
        return None;
    }

    let mut peer_pane_ids: Vec<String> = Vec::new();
    let mut seen_peers = HashSet::new();

    for out in outs {
        let consumer_id = &out.to.node_id;
        for edge in incoming_edges(edges, consumer_id) {
            let peer_id = &edge.from.node_id;
            if peer_id == node_id || !seen_peers.insert(peer_id.clone()) {
                continue;
            }
            if let Some(pane_id) = pane_by_node_id.get(peer_id) {
                peer_pane_ids.push(pane_id.clone());
            }
        }
    }

    if peer_pane_ids.is_empty() {
        return Some(MAIN_PANE_ID.to_string());
    }

    Some(prefer_context_pane(&peer_pane_ids))
}

/// Context pane from a node's own input sources (in edge order).
pub fn resolve_pane_from_inputs(
    node_id: &str,
    edges: &[Edge],
    pane_by_node_id: &HashMap<String, String>,
) -> String {
    let mut pane_ids: Vec<String> = Vec::new();
    let mut seen = HashSet::new();

    for edge in incoming_edges(edges, node_id) {
        let source_id = &edge.from.node_id;
        if !seen.insert(source_id.clone()) {
            continue;
        }
        if let Some(pane_id) = pane_by_node_id.get(source_id) {
            pane_ids.push(pane_id.clone());
        }
    }

    prefer_context_pane(&pane_ids)
}

fn find_pane_mut<'a>(panes: &'a mut [PaneSpec], pane_id: &str) -> Option<&'a mut PaneSpec> {
    panes.iter_mut().find(|pane| pane.id == pane_id)
}

fn first_value_range_on_pane(pane: &PaneSpec) -> Option<ValueRange> {
    pane.layers.iter().find_map(|layer| layer.value_range.clone())
}

fn derive_outputs_from_panes(panes: &[PaneSpec]) -> Vec<String> {
    let mut ports: HashSet<String> = HashSet::new();
    for pane in panes {
        for layer in &pane.layers {
            for port in layer.ports.values() {
                ports.insert(port.clone());
            }
        }
    }
    let mut out: Vec<String> = ports.into_iter().collect();
    out.sort();
    out
}

fn ports_map(entries: &[(&str, String)]) -> BTreeMap<String, String> {
    entries
        .iter()
        .map(|(k, v)| ((*k).to_string(), v.clone()))
        .collect()
}

fn role_for_indicator(kind: &str, registry: &NodeRegistry) -> ChartRole {
    registry
        .meta(kind)
        .and_then(|meta| meta.chart_defaults.as_ref())
        .map(|defaults| defaults.role)
        .unwrap_or(ChartRole::Overlay)
}

fn value_range_for_indicator(kind: &str, registry: &NodeRegistry) -> Option<ValueRange> {
    registry
        .meta(kind)
        .and_then(|meta| meta.chart_defaults.as_ref())
        .and_then(|defaults| defaults.value_range.clone())
}

fn indicator_line_layer(
    node: &NodeSpec,
    time_port: &str,
    color: &str,
    registry: &NodeRegistry,
) -> LayerSpec {
    let value_range = value_range_for_indicator(&node.kind, registry);
    LayerSpec {
        id: node.id.clone(),
        label: Some(node.id.clone()),
        visual: LayerVisual::Line,
        ports: ports_map(&[
            ("time", time_port.to_string()),
            ("value", port_ref(&node.id, "value")),
        ]),
        style: Some(LayerStyle {
            color: Some(color.to_string()),
            line_width: Some(2),
            marker_shape: None,
        }),
        visible: true,
        value_range,
    }
}

fn literal_line_layer(
    node: &NodeSpec,
    time_port: &str,
    value_range: Option<ValueRange>,
) -> LayerSpec {
    LayerSpec {
        id: node.id.clone(),
        label: Some(node.id.clone()),
        visual: LayerVisual::Line,
        ports: ports_map(&[
            ("time", time_port.to_string()),
            ("value", port_ref(&node.id, "value")),
        ]),
        style: Some(LayerStyle {
            color: Some(LITERAL_LINE_COLOR.to_string()),
            line_width: Some(1),
            marker_shape: None,
        }),
        visible: true,
        value_range,
    }
}

fn marker_shape_for_logic_kind(kind: &str) -> MarkerShape {
    match kind {
        "logic.crossover" => MarkerShape::ArrowUp,
        "logic.crossunder" => MarkerShape::ArrowDown,
        _ => MarkerShape::Circle,
    }
}

fn marker_color_for_logic_kind(kind: &str) -> &'static str {
    match kind {
        "logic.crossover" => MARKER_COLOR_CROSSOVER,
        "logic.crossunder" => MARKER_COLOR_CROSSUNDER,
        _ => MARKER_COLOR_DEFAULT,
    }
}

fn logic_marker_layer(node: &NodeSpec, time_port: &str) -> LayerSpec {
    LayerSpec {
        id: node.id.clone(),
        label: Some(node.id.clone()),
        visual: LayerVisual::Markers,
        ports: ports_map(&[
            ("time", time_port.to_string()),
            ("signal", port_ref(&node.id, "signal")),
        ]),
        style: Some(LayerStyle {
            color: Some(marker_color_for_logic_kind(&node.kind).to_string()),
            line_width: None,
            marker_shape: Some(marker_shape_for_logic_kind(&node.kind)),
        }),
        visible: true,
        value_range: None,
    }
}

/// Presentation compiler: `GraphSpec` + registry `chart_defaults` → `PresentationSpec`.
///
/// Rules:
/// - Candles on main
/// - `indicator.*` overlay → main; subchart → own pane
/// - `literal.number` → line on peer/context pane (skip orphans)
/// - `logic.*` → markers on input-context pane
/// - Unknown indicator kinds default to overlay
pub fn compile_presentation(
    graph: &GraphSpec,
    registry: &NodeRegistry,
) -> Result<PresentationSpec> {
    let ds = find_candles_datasource(graph).ok_or(Error::MissingCandlesDatasource)?;
    let time_port = port_ref(&ds.id, "timestamp");
    let symbol = symbol_label(ds);

    let mut main_layers = vec![LayerSpec {
        id: MARKET_LAYER_ID.to_string(),
        label: Some(symbol),
        visual: LayerVisual::Candlestick,
        ports: ports_map(&[
            ("time", time_port.clone()),
            ("open", port_ref(&ds.id, "open")),
            ("high", port_ref(&ds.id, "high")),
            ("low", port_ref(&ds.id, "low")),
            ("close", port_ref(&ds.id, "close")),
        ]),
        style: None,
        visible: true,
        value_range: None,
    }];

    let mut subchart_panes: Vec<PaneSpec> = Vec::new();
    let mut pane_by_node_id: HashMap<String, String> = HashMap::new();
    let mut color_index = 0usize;

    // Phase A — indicators
    for node in &graph.nodes {
        if !is_indicator_kind(&node.kind) {
            continue;
        }

        let color = indicator_color(color_index);
        color_index += 1;

        let layer = indicator_line_layer(node, &time_port, color, registry);
        let role = role_for_indicator(&node.kind, registry);

        match role {
            ChartRole::Subchart => {
                subchart_panes.push(PaneSpec {
                    id: node.id.clone(),
                    role: PaneRole::Subchart,
                    height: PaneHeight::Fixed(DEFAULT_SUBCHART_PANE_HEIGHT),
                    layers: vec![layer],
                });
                pane_by_node_id.insert(node.id.clone(), node.id.clone());
            }
            ChartRole::Overlay => {
                main_layers.push(layer);
                pane_by_node_id.insert(node.id.clone(), MAIN_PANE_ID.to_string());
            }
        }
    }

    let mut panes = vec![PaneSpec {
        id: MAIN_PANE_ID.to_string(),
        role: PaneRole::Main,
        height: PaneHeight::Flex,
        layers: main_layers,
    }];
    panes.extend(subchart_panes);

    // Phase B — literal.number as lines on peer context pane
    for node in &graph.nodes {
        if !is_literal_number_kind(&node.kind) {
            continue;
        }

        let Some(pane_id) =
            resolve_pane_from_consumer_peers(&node.id, &graph.edges, &pane_by_node_id)
        else {
            continue;
        };

        let Some(pane) = find_pane_mut(&mut panes, &pane_id) else {
            continue;
        };

        let value_range = first_value_range_on_pane(pane);
        pane.layers
            .push(literal_line_layer(node, &time_port, value_range));
        pane_by_node_id.insert(node.id.clone(), pane_id);
    }

    // Phase C — logic.* as markers on input context pane
    for node in &graph.nodes {
        if !is_logic_kind(&node.kind) {
            continue;
        }

        let pane_id = resolve_pane_from_inputs(&node.id, &graph.edges, &pane_by_node_id);
        let Some(pane) = find_pane_mut(&mut panes, &pane_id) else {
            continue;
        };

        pane.layers.push(logic_marker_layer(node, &time_port));
    }

    let outputs = derive_outputs_from_panes(&panes);

    Ok(PresentationSpec {
        version: PRESENTATION_VERSION,
        panes,
        outputs,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::registry::builtin_registry;
    use crate::spec::{Edge, GraphKind, GraphSpec, NodeSpec};

    fn edge(from: &str, to: &str) -> Edge {
        Edge {
            from: from.parse().unwrap(),
            to: to.parse().unwrap(),
        }
    }

    fn candles_ds() -> NodeSpec {
        NodeSpec {
            id: "ds1".into(),
            kind: "datasource.candles".into(),
            params: serde_json::json!({
                "exchange": "bybit",
                "category": "spot",
                "symbol": "BTCUSDT",
                "interval": "1d"
            }),
        }
    }

    fn rsi_reclaim() -> GraphSpec {
        GraphSpec {
            id: "rsi-reclaim".into(),
            version: 1,
            kind: GraphKind::Chart,
            nodes: vec![
                candles_ds(),
                NodeSpec {
                    id: "rsi14".into(),
                    kind: "indicator.rsi".into(),
                    params: serde_json::json!({ "period": 14 }),
                },
                NodeSpec {
                    id: "sma20".into(),
                    kind: "indicator.sma".into(),
                    params: serde_json::json!({ "period": 20 }),
                },
                NodeSpec {
                    id: "level30".into(),
                    kind: "literal.number".into(),
                    params: serde_json::json!({ "value": 30 }),
                },
                NodeSpec {
                    id: "reclaim".into(),
                    kind: "logic.crossover".into(),
                    params: serde_json::json!({}),
                },
            ],
            edges: vec![
                edge("ds1.close", "rsi14.input"),
                edge("ds1.close", "sma20.input"),
                edge("ds1.timestamp", "level30.reference"),
                edge("rsi14.value", "reclaim.fast"),
                edge("level30.value", "reclaim.slow"),
            ],
        }
    }

    fn layer_ids(pane: &PaneSpec) -> Vec<&str> {
        pane.layers.iter().map(|l| l.id.as_str()).collect()
    }

    #[test]
    fn prefer_context_pane_first_subchart_else_main() {
        assert_eq!(prefer_context_pane(&[]), MAIN_PANE_ID);
        assert_eq!(
            prefer_context_pane(&[MAIN_PANE_ID.to_string()]),
            MAIN_PANE_ID
        );
        assert_eq!(
            prefer_context_pane(&[MAIN_PANE_ID.to_string(), "rsi14".into()]),
            "rsi14"
        );
        assert_eq!(
            prefer_context_pane(&["rsi14".into(), "macd".into()]),
            "rsi14"
        );
        assert_eq!(
            prefer_context_pane(&["macd".into(), "rsi14".into()]),
            "macd"
        );
    }

    #[test]
    fn resolve_consumer_peers_orphan_and_subchart() {
        let mut pane_by = HashMap::new();
        pane_by.insert("rsi14".into(), "rsi14".into());
        assert!(resolve_pane_from_consumer_peers("orphan", &[], &pane_by).is_none());

        pane_by.insert("sma20".into(), MAIN_PANE_ID.into());
        let edges = vec![
            edge("rsi14.value", "reclaim.fast"),
            edge("level30.value", "reclaim.slow"),
        ];
        assert_eq!(
            resolve_pane_from_consumer_peers("level30", &edges, &pane_by).as_deref(),
            Some("rsi14")
        );
    }

    #[test]
    fn resolve_inputs_prefers_subchart_else_main() {
        let mut pane_by = HashMap::new();
        pane_by.insert("rsi14".into(), "rsi14".into());
        pane_by.insert("macd".into(), "macd".into());
        let edges = vec![
            edge("rsi14.value", "cmp.left"),
            edge("macd.value", "cmp.right"),
        ];
        assert_eq!(resolve_pane_from_inputs("cmp", &edges, &pane_by), "rsi14");

        let mut overlays = HashMap::new();
        overlays.insert("sma20".into(), MAIN_PANE_ID.into());
        overlays.insert("sma50".into(), MAIN_PANE_ID.into());
        let edges = vec![
            edge("sma20.value", "cross.fast"),
            edge("sma50.value", "cross.slow"),
        ];
        assert_eq!(
            resolve_pane_from_inputs("cross", &edges, &overlays),
            MAIN_PANE_ID
        );
    }

    #[test]
    fn rsi_reclaim_places_level_and_markers_on_subchart() {
        let registry = builtin_registry();
        let spec = compile_presentation(&rsi_reclaim(), &registry).unwrap();

        assert_eq!(
            spec.panes.iter().map(|p| p.id.as_str()).collect::<Vec<_>>(),
            vec![MAIN_PANE_ID, "rsi14"]
        );

        let main = &spec.panes[0];
        assert_eq!(main.role, PaneRole::Main);
        assert_eq!(layer_ids(main), vec![MARKET_LAYER_ID, "sma20"]);

        let rsi_pane = &spec.panes[1];
        assert_eq!(rsi_pane.role, PaneRole::Subchart);
        assert_eq!(
            rsi_pane.height,
            PaneHeight::Fixed(DEFAULT_SUBCHART_PANE_HEIGHT)
        );
        assert_eq!(layer_ids(rsi_pane), vec!["rsi14", "level30", "reclaim"]);

        let rsi = &rsi_pane.layers[0];
        assert_eq!(rsi.visual, LayerVisual::Line);
        assert_eq!(rsi.ports.get("value").map(String::as_str), Some("rsi14.value"));
        assert_eq!(
            rsi.value_range,
            Some(ValueRange {
                min: 0.0,
                max: 100.0
            })
        );

        let level = &rsi_pane.layers[1];
        assert_eq!(level.visual, LayerVisual::Line);
        assert_eq!(
            level.ports.get("value").map(String::as_str),
            Some("level30.value")
        );
        assert_eq!(
            level.ports.get("time").map(String::as_str),
            Some("ds1.timestamp")
        );
        assert_eq!(
            level.value_range,
            Some(ValueRange {
                min: 0.0,
                max: 100.0
            })
        );
        assert_eq!(
            level.style.as_ref().and_then(|s| s.color.as_deref()),
            Some(LITERAL_LINE_COLOR)
        );

        let reclaim = &rsi_pane.layers[2];
        assert_eq!(reclaim.visual, LayerVisual::Markers);
        assert_eq!(
            reclaim.ports.get("signal").map(String::as_str),
            Some("reclaim.signal")
        );
        assert_eq!(
            reclaim.ports.get("time").map(String::as_str),
            Some("ds1.timestamp")
        );
        assert_eq!(
            reclaim
                .style
                .as_ref()
                .and_then(|s| s.marker_shape),
            Some(MarkerShape::ArrowUp)
        );

        for port in [
            "ds1.close",
            "sma20.value",
            "rsi14.value",
            "level30.value",
            "reclaim.signal",
        ] {
            assert!(
                spec.outputs.iter().any(|o| o == port),
                "missing output {port}"
            );
        }
    }

    #[test]
    fn skips_orphan_literal_number() {
        let graph = GraphSpec {
            id: "orphan-literal".into(),
            version: 1,
            kind: GraphKind::Chart,
            nodes: vec![
                candles_ds(),
                NodeSpec {
                    id: "sma20".into(),
                    kind: "indicator.sma".into(),
                    params: serde_json::json!({ "period": 20 }),
                },
                NodeSpec {
                    id: "level".into(),
                    kind: "literal.number".into(),
                    params: serde_json::json!({ "value": 100 }),
                },
            ],
            edges: vec![
                edge("ds1.close", "sma20.input"),
                edge("ds1.timestamp", "level.reference"),
            ],
        };

        let spec = compile_presentation(&graph, &builtin_registry()).unwrap();
        let all: Vec<_> = spec
            .panes
            .iter()
            .flat_map(|p| p.layers.iter().map(|l| l.id.as_str()))
            .collect();
        assert!(!all.contains(&"level"));
        assert!(!spec.outputs.iter().any(|o| o == "level.value"));
    }

    #[test]
    fn sma_crossover_markers_on_main() {
        let graph = GraphSpec {
            id: "sma-cross".into(),
            version: 1,
            kind: GraphKind::Chart,
            nodes: vec![
                candles_ds(),
                NodeSpec {
                    id: "sma20".into(),
                    kind: "indicator.sma".into(),
                    params: serde_json::json!({ "period": 20 }),
                },
                NodeSpec {
                    id: "sma50".into(),
                    kind: "indicator.sma".into(),
                    params: serde_json::json!({ "period": 50 }),
                },
                NodeSpec {
                    id: "cross".into(),
                    kind: "logic.crossover".into(),
                    params: serde_json::json!({}),
                },
            ],
            edges: vec![
                edge("ds1.close", "sma20.input"),
                edge("ds1.close", "sma50.input"),
                edge("sma20.value", "cross.fast"),
                edge("sma50.value", "cross.slow"),
            ],
        };

        let spec = compile_presentation(&graph, &builtin_registry()).unwrap();
        assert_eq!(spec.panes.len(), 1);
        assert_eq!(
            layer_ids(&spec.panes[0]),
            vec![MARKET_LAYER_ID, "sma20", "sma50", "cross"]
        );
        assert_eq!(spec.panes[0].layers[3].visual, LayerVisual::Markers);
        assert!(spec.outputs.iter().any(|o| o == "cross.signal"));
    }

    #[test]
    fn logic_across_two_subcharts_uses_first_input_pane() {
        let graph = GraphSpec {
            id: "two-subcharts".into(),
            version: 1,
            kind: GraphKind::Chart,
            nodes: vec![
                candles_ds(),
                NodeSpec {
                    id: "rsi14".into(),
                    kind: "indicator.rsi".into(),
                    params: serde_json::json!({ "period": 14 }),
                },
                NodeSpec {
                    id: "rsi28".into(),
                    kind: "indicator.rsi".into(),
                    params: serde_json::json!({ "period": 28 }),
                },
                NodeSpec {
                    id: "cmp".into(),
                    kind: "logic.gt".into(),
                    params: serde_json::json!({}),
                },
            ],
            edges: vec![
                edge("ds1.close", "rsi14.input"),
                edge("ds1.close", "rsi28.input"),
                edge("rsi14.value", "cmp.left"),
                edge("rsi28.value", "cmp.right"),
            ],
        };

        let spec = compile_presentation(&graph, &builtin_registry()).unwrap();
        let rsi14 = spec.panes.iter().find(|p| p.id == "rsi14").unwrap();
        let rsi28 = spec.panes.iter().find(|p| p.id == "rsi28").unwrap();
        assert!(rsi14.layers.iter().any(|l| l.id == "cmp"));
        assert!(!rsi28.layers.iter().any(|l| l.id == "cmp"));
        let cmp = rsi14.layers.iter().find(|l| l.id == "cmp").unwrap();
        assert_eq!(
            cmp.style.as_ref().and_then(|s| s.marker_shape),
            Some(MarkerShape::Circle)
        );
    }

    #[test]
    fn overlays_only_single_main_pane() {
        let graph = GraphSpec {
            id: "sma-only".into(),
            version: 1,
            kind: GraphKind::Chart,
            nodes: vec![
                candles_ds(),
                NodeSpec {
                    id: "sma20".into(),
                    kind: "indicator.sma".into(),
                    params: serde_json::json!({ "period": 20 }),
                },
            ],
            edges: vec![edge("ds1.close", "sma20.input")],
        };

        let spec = compile_presentation(&graph, &builtin_registry()).unwrap();
        assert_eq!(spec.panes.len(), 1);
        assert_eq!(layer_ids(&spec.panes[0]), vec![MARKET_LAYER_ID, "sma20"]);
    }

    #[test]
    fn unknown_indicator_defaults_to_overlay() {
        let graph = GraphSpec {
            id: "unknown".into(),
            version: 1,
            kind: GraphKind::Chart,
            nodes: vec![
                candles_ds(),
                NodeSpec {
                    id: "x".into(),
                    kind: "indicator.unknown_future".into(),
                    params: serde_json::json!({}),
                },
            ],
            edges: vec![],
        };

        let spec = compile_presentation(&graph, &builtin_registry()).unwrap();
        assert_eq!(spec.panes.len(), 1);
        assert!(spec.panes[0].layers.iter().any(|l| l.id == "x"));
    }

    #[test]
    fn missing_candles_datasource_errors() {
        let graph = GraphSpec {
            id: "empty".into(),
            version: 1,
            kind: GraphKind::Chart,
            nodes: vec![NodeSpec {
                id: "sma20".into(),
                kind: "indicator.sma".into(),
                params: serde_json::json!({ "period": 20 }),
            }],
            edges: vec![],
        };

        let err = compile_presentation(&graph, &builtin_registry()).unwrap_err();
        assert!(matches!(err, Error::MissingCandlesDatasource));
        assert!(err.to_string().contains("datasource.candles"));
    }

}
