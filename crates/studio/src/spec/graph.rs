use crate::error::{Error, Result};
use serde::{Deserialize, Serialize};
use std::{fmt, str::FromStr};

pub type NodeId = String;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphSpec {
    pub id: String,
    pub version: u32,
    pub kind: GraphKind,
    pub nodes: Vec<NodeSpec>,
    pub edges: Vec<Edge>,
}

impl GraphSpec {
    pub fn node(&self, id: &str) -> Result<&NodeSpec> {
        self.nodes
            .iter()
            .find(|node| node.id == id)
            .ok_or_else(|| Error::NodeNotFound(id.to_string()))
    }

    pub fn edge_to(&self, port: &PortRef) -> Result<&Edge> {
        self.edges
            .iter()
            .find(|edge| &edge.to == port)
            .ok_or_else(|| Error::PortNotFound(port.to_string()))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GraphKind {
    Chart,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeSpec {
    pub id: NodeId,
    pub kind: String,
    pub params: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Edge {
    pub from: PortRef,
    pub to: PortRef,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(try_from = "String", into = "String")]
pub struct PortRef {
    pub node_id: NodeId,
    pub port_name: String,
}

impl PortRef {
    pub fn new(node_id: impl Into<String>, port_name: impl Into<String>) -> Result<Self> {
        let node_id = node_id.into();
        let port_name = port_name.into();

        if node_id.is_empty() || port_name.is_empty() {
            return Err(Error::Empty);
        }
        if node_id.contains('.') || port_name.contains('.') {
            return Err(Error::ContainsDot);
        }

        Ok(Self { node_id, port_name })
    }
}

impl FromStr for PortRef {
    type Err = Error;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        let (node_id, port_name) = s.split_once(".").ok_or(Error::InvalidFormat)?;

        Self::new(node_id, port_name)
    }
}

impl TryFrom<String> for PortRef {
    type Error = Error;

    fn try_from(s: String) -> Result<Self> {
        s.parse()
    }
}

impl From<PortRef> for String {
    fn from(p: PortRef) -> Self {
        format!("{}.{}", p.node_id, p.port_name)
    }
}

impl fmt::Display for PortRef {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}.{}", self.node_id, self.port_name)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::Error;

    #[test]
    fn port_ref_parses_valid_string() {
        let port = PortRef::from_str("ds1.close").unwrap();
        assert_eq!(port.node_id, "ds1");
        assert_eq!(port.port_name, "close");
    }

    #[test]
    fn port_ref_new_validates() {
        let port = PortRef::new("sma20", "input").unwrap();
        assert_eq!(port.to_string(), "sma20.input");
    }

    #[test]
    fn port_ref_rejects_invalid_strings() {
        assert!(matches!(PortRef::from_str(""), Err(Error::InvalidFormat)));
        assert!(matches!(
            PortRef::from_str("noport"),
            Err(Error::InvalidFormat)
        ));
        assert!(matches!(PortRef::new("", "close"), Err(Error::Empty)));
        assert!(matches!(PortRef::new("ds1", ""), Err(Error::Empty)));
        assert!(matches!(
            PortRef::new("ds.1", "close"),
            Err(Error::ContainsDot)
        ));
        assert!(matches!(
            PortRef::new("ds1", "clo.se"),
            Err(Error::ContainsDot)
        ));
    }

    #[test]
    fn port_ref_display_and_string_conversion() {
        let port = PortRef::new("cross", "signal").unwrap();
        assert_eq!(port.to_string(), "cross.signal");
        assert_eq!(format!("{port}"), "cross.signal");
        assert_eq!(String::from(port.clone()), "cross.signal");
    }

    #[test]
    fn graph_spec_edge_to_finds_input_wire() {
        let spec: GraphSpec = serde_json::from_str(GOLDEN_CROSS_JSON).unwrap();
        let port = PortRef::new("sma20", "input").unwrap();

        let edge = spec.edge_to(&port).unwrap();
        assert_eq!(edge.from.to_string(), "ds1.close");
        assert_eq!(edge.to, port);
    }

    #[test]
    fn graph_spec_edge_to_missing_port() {
        let spec: GraphSpec = serde_json::from_str(GOLDEN_CROSS_JSON).unwrap();
        let port = PortRef::new("sma20", "missing").unwrap();

        let err = spec.edge_to(&port).unwrap_err();
        assert!(matches!(err, Error::PortNotFound(id) if id == "sma20.missing"));
    }

    #[test]
    fn edge_deserializes_port_refs_as_strings() {
        let edge: Edge =
            serde_json::from_str(r#"{"from":"ds1.close","to":"sma20.input"}"#).unwrap();

        assert_eq!(edge.from.node_id, "ds1");
        assert_eq!(edge.from.port_name, "close");
        assert_eq!(edge.to.node_id, "sma20");
        assert_eq!(edge.to.port_name, "input");
    }

    #[test]
    fn edge_serializes_port_refs_as_strings() {
        let edge = Edge {
            from: PortRef::new("ds1", "close").unwrap(),
            to: PortRef::new("sma20", "input").unwrap(),
        };

        let json = serde_json::to_string(&edge).unwrap();
        assert_eq!(json, r#"{"from":"ds1.close","to":"sma20.input"}"#);
    }

    #[test]
    fn graph_kind_serializes_lowercase() {
        let kind = GraphKind::Chart;
        assert_eq!(serde_json::to_string(&kind).unwrap(), r#""chart""#);
    }

    #[test]
    fn graph_kind_deserializes_lowercase() {
        let kind: GraphKind = serde_json::from_str(r#""chart""#).unwrap();
        assert_eq!(kind, GraphKind::Chart);
    }

    #[test]
    fn graph_spec_deserializes_golden_cross_example() {
        let spec: GraphSpec = serde_json::from_str(GOLDEN_CROSS_JSON).unwrap();

        assert_eq!(spec.id, "golden-cross-btc-1d");
        assert_eq!(spec.version, 1);
        assert_eq!(spec.kind, GraphKind::Chart);
        assert_eq!(spec.nodes.len(), 4);
        assert_eq!(spec.edges.len(), 4);

        let ds1 = &spec.nodes[0];
        assert_eq!(ds1.id, "ds1");
        assert_eq!(ds1.kind, "datasource.candles");
        assert_eq!(ds1.params["symbol"], "BTCUSDT");

        assert_eq!(spec.edges[0].from.to_string(), "ds1.close");
        assert_eq!(spec.edges[0].to.to_string(), "sma20.input");
    }

    #[test]
    fn graph_spec_roundtrip() {
        let spec: GraphSpec = serde_json::from_str(GOLDEN_CROSS_JSON).unwrap();
        let json = serde_json::to_string(&spec).unwrap();
        let restored: GraphSpec = serde_json::from_str(&json).unwrap();
        assert_eq!(restored.id, spec.id);
        assert_eq!(restored.version, spec.version);
        assert_eq!(restored.kind, spec.kind);
        assert_eq!(restored.nodes.len(), spec.nodes.len());
        assert_eq!(restored.edges.len(), spec.edges.len());
    }

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
    { "id": "cross", "kind": "logic.crossover", "params": {} }
  ],
  "edges": [
    { "from": "ds1.close", "to": "sma20.input" },
    { "from": "ds1.close", "to": "sma50.input" },
    { "from": "sma20.value", "to": "cross.fast" },
    { "from": "sma50.value", "to": "cross.slow" }
  ]
}
"#;
}
