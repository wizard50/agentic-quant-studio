use std::collections::HashSet;

use crate::{
    error::{Error, Result},
    registry::NodeRegistry,
    runtime::plan::topo_sort,
    spec::graph::{Edge, GraphSpec},
};

pub fn validate(graph: &GraphSpec, registry: &NodeRegistry) -> Result<()> {
    validate_unique_node_ids(graph)?;
    validate_node_kinds(graph, registry)?;

    validate_unique_input_wire(graph)?;
    validate_edges(graph, registry)?;

    topo_sort(graph)?;

    Ok(())
}

fn validate_unique_node_ids(graph: &GraphSpec) -> Result<()> {
    let mut seen = HashSet::new();
    for node in &graph.nodes {
        if !seen.insert(&node.id) {
            return Err(Error::DuplicateNodeId(node.id.clone()));
        }
    }
    Ok(())
}

fn validate_node_kinds(graph: &GraphSpec, registry: &NodeRegistry) -> Result<()> {
    for node in &graph.nodes {
        if registry.get(&node.kind).is_none() {
            return Err(Error::UnknownKind(node.kind.clone()));
        }
    }
    Ok(())
}

fn validate_unique_input_wire(graph: &GraphSpec) -> Result<()> {
    let mut input_wires = HashSet::new();
    for edge in &graph.edges {
        if !input_wires.insert(edge.to.clone()) {
            return Err(Error::DuplicateInputWire(edge.to.to_string()));
        }
    }

    Ok(())
}

fn validate_edges(graph: &GraphSpec, registry: &NodeRegistry) -> Result<()> {
    for edge in &graph.edges {
        validate_edge(edge, graph, registry)?;
    }

    Ok(())
}

fn validate_edge(edge: &Edge, graph: &GraphSpec, registry: &NodeRegistry) -> Result<()> {
    let from_spec = graph.node(&edge.from.node_id)?;
    let to_spec = graph.node(&edge.to.node_id)?;

    let from_op = registry
        .get(&from_spec.kind)
        .ok_or_else(|| Error::UnknownKind(from_spec.kind.clone()))?;
    let to_op = registry
        .get(&to_spec.kind)
        .ok_or_else(|| Error::UnknownKind(to_spec.kind.clone()))?;

    let from_meta = from_op.meta();
    let to_meta = to_op.meta();

    let out_port = from_meta
        .outputs
        .iter()
        .find(|port| port.name == edge.from.port_name)
        .ok_or_else(|| Error::PortNotFound(edge.from.port_name.clone()))?;

    let in_port = to_meta
        .inputs
        .iter()
        .find(|port| port.name == edge.to.port_name)
        .ok_or_else(|| Error::PortNotFound(edge.to.port_name.clone()))?;

    if !out_port.type_match(in_port) {
        return Err(Error::PortTypeMismatch {
            from: edge.from.clone(),
            to: edge.to.clone(),
        });
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{registry::builtin_registry, spec::PortRef};

    const GOLDEN_CROSS_JSON: &str = r#"
{
  "id": "golden-cross-btc-1d",
  "version": 1,
  "kind": "chart",
  "nodes": [
    {
      "id": "ds1",
      "kind": "datasource.candles",
      "params": {
        "exchange": "bybit",
        "category": "spot",
        "symbol": "BTCUSDT",
        "interval": "1d"
      }
    },
    { "id": "sma20", "kind": "indicator.sma", "params": { "period": 20 } },
    { "id": "sma50", "kind": "indicator.sma", "params": { "period": 50 } },
    { "id": "cross", "kind": "logic.crossover", "params": {} },
    { "id": "out_fast", "kind": "output.series", "params": { "label": "SMA 20" } },
    { "id": "out_sig", "kind": "output.signal", "params": { "label": "Golden cross" } }
  ],
  "edges": [
    { "from": "ds1.close", "to": "sma20.input" },
    { "from": "ds1.close", "to": "sma50.input" },
    { "from": "sma20.value", "to": "cross.fast" },
    { "from": "sma50.value", "to": "cross.slow" },
    { "from": "sma20.value", "to": "out_fast.series" },
    { "from": "cross.signal", "to": "out_sig.signal" }
  ]
}
"#;

    #[test]
    fn validate_unknown_kind_fails() {
        let graph: GraphSpec = serde_json::from_str(GOLDEN_CROSS_JSON).unwrap();
        let registry = builtin_registry();
        let err = validate(&graph, &registry).unwrap_err();
        assert!(matches!(err, Error::UnknownKind(_)));
    }

    #[test]
    fn validate_sma_edge_ports() {
        let graph = GraphSpec {
            id: "test".to_string(),
            version: 1,
            kind: crate::spec::GraphKind::Chart,
            nodes: vec![
                crate::spec::NodeSpec {
                    id: "sma20".to_string(),
                    kind: "indicator.sma".to_string(),
                    params: serde_json::json!({ "period": 20 }),
                },
                crate::spec::NodeSpec {
                    id: "sma50".to_string(),
                    kind: "indicator.sma".to_string(),
                    params: serde_json::json!({ "period": 50 }),
                },
            ],
            edges: vec![Edge {
                from: PortRef::new("sma20", "value").unwrap(),
                to: PortRef::new("sma50", "input").unwrap(),
            }],
        };

        validate(&graph, &builtin_registry()).unwrap();
    }

    #[test]
    fn validate_output_series_edge() {
        let graph = GraphSpec {
            id: "test".to_string(),
            version: 1,
            kind: crate::spec::GraphKind::Chart,
            nodes: vec![
                crate::spec::NodeSpec {
                    id: "sma20".to_string(),
                    kind: "indicator.sma".to_string(),
                    params: serde_json::json!({ "period": 20 }),
                },
                crate::spec::NodeSpec {
                    id: "out_fast".to_string(),
                    kind: "output.series".to_string(),
                    params: serde_json::json!({ "label": "SMA 20" }),
                },
            ],
            edges: vec![Edge {
                from: crate::spec::PortRef::new("sma20", "value").unwrap(),
                to: crate::spec::PortRef::new("out_fast", "series").unwrap(),
            }],
        };

        validate(&graph, &builtin_registry()).unwrap();
    }
}
