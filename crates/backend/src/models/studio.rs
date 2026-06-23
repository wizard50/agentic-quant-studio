use std::{
    collections::{HashMap, HashSet},
    str::FromStr,
};

use serde::{Deserialize, Serialize};
use studio::{
    error::Error,
    runtime::{PortStore, Value},
    spec::PortRef,
};

#[derive(Debug, Deserialize)]
pub struct StudioRunRequest {
    pub graph: studio::spec::GraphSpec,
    pub outputs: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct StudioRunResponse {
    pub outputs: HashMap<String, Value>,
    pub meta: StudioRunMeta,
}

#[derive(Debug, Serialize)]
pub struct StudioRunMeta {
    pub graph_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub length: Option<usize>,
}

impl StudioRunRequest {
    pub fn validate_outputs(&self) -> Result<(), Error> {
        if self.outputs.is_empty() {
            return Err(Error::InvalidParameter(
                "outputs must contain at least one port".to_string(),
            ));
        }

        let mut seen = HashSet::new();
        for port in &self.outputs {
            if !seen.insert(port) {
                return Err(Error::InvalidParameter(format!(
                    "duplicate output port: {port}"
                )));
            }
            PortRef::from_str(port)?;
        }

        Ok(())
    }
}

impl StudioRunResponse {
    pub fn from_store(
        store: &PortStore,
        requested: &[String],
        graph_id: &str,
    ) -> Result<Self, Error> {
        let mut outputs = HashMap::new();
        let mut length = None;

        for port_str in requested {
            let port = PortRef::from_str(port_str)?;
            let value = store.get(&port)?;
            if length.is_none() {
                length = series_length(value.as_ref());
            }
            outputs.insert(port_str.clone(), value.as_ref().clone());
        }

        Ok(Self {
            outputs,
            meta: StudioRunMeta {
                graph_id: graph_id.to_string(),
                length,
            },
        })
    }
}

fn series_length(value: &Value) -> Option<usize> {
    match value {
        Value::SeriesI64(series) => Some(series.values.len()),
        Value::SeriesF64(series) => Some(series.values.len()),
        Value::SeriesBool(series) => Some(series.values.len()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use studio::runtime::value::SeriesF64;

    #[test]
    fn request_deserializes_port_list() {
        let body: StudioRunRequest = serde_json::from_str(
            r#"{
            "graph": {
              "id": "ds-sma",
              "version": 1,
              "kind": "chart",
              "nodes": [],
              "edges": []
            },
            "outputs": ["ds1.close", "sma20.value"]
          }"#,
        )
        .unwrap();

        assert_eq!(body.outputs, vec!["ds1.close", "sma20.value"]);
    }

    #[test]
    fn request_rejects_empty_outputs() {
        let request = StudioRunRequest {
            graph: studio::spec::GraphSpec {
                id: "test".to_string(),
                version: 1,
                kind: studio::spec::GraphKind::Chart,
                nodes: vec![],
                edges: vec![],
            },
            outputs: vec![],
        };

        let err = request.validate_outputs().unwrap_err();
        assert!(matches!(err, Error::InvalidParameter(_)));
    }

    #[test]
    fn from_store_returns_requested_ports_only() {
        let mut store = PortStore::default();
        store.insert(
            PortRef::new("ds1", "close").unwrap(),
            Value::SeriesF64(Arc::new(SeriesF64 {
                values: vec![Some(1.0), Some(2.0)],
            })),
        );
        store.insert(
            PortRef::new("ds1", "open").unwrap(),
            Value::SeriesF64(Arc::new(SeriesF64 {
                values: vec![Some(3.0)],
            })),
        );

        let response =
            StudioRunResponse::from_store(&store, &["ds1.close".to_string()], "ds-sma").unwrap();

        assert_eq!(response.outputs.len(), 1);
        assert!(response.outputs.contains_key("ds1.close"));
        assert!(!response.outputs.contains_key("ds1.open"));
        assert_eq!(response.meta.graph_id, "ds-sma");
        assert_eq!(response.meta.length, Some(2));

        let json = serde_json::to_value(&response.outputs["ds1.close"]).unwrap();
        assert_eq!(json["kind"], "series_f64");
        assert!(json.get("label").is_none());
    }

    #[test]
    fn from_store_missing_port_returns_error() {
        let store = PortStore::default();
        let err = StudioRunResponse::from_store(&store, &["missing.port".to_string()], "test")
            .unwrap_err();

        assert!(matches!(err, Error::PortNotFound(_)));
    }
}
