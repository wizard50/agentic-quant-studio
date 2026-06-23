use crate::{
    error::{Error, Result},
    registry::NodeRegistry,
    runtime::{
        context::ExecutionContext, node::ResolvedInputs, plan::topo_sort, validate::validate,
        value::Value,
    },
    spec::{PortRef, graph::GraphSpec},
};
use std::{collections::HashMap, sync::Arc};

pub struct PortStore {
    values: HashMap<PortRef, Arc<Value>>,
}

impl PortStore {
    pub fn insert(&mut self, port: PortRef, value: Value) {
        self.values.insert(port, Arc::new(value));
    }

    pub fn get(&self, port: &PortRef) -> Result<Arc<Value>> {
        self.values
            .get(port)
            .cloned()
            .ok_or_else(|| Error::PortNotFound(port.to_string()))
    }

    pub fn iter(&self) -> impl Iterator<Item = (&PortRef, &Arc<Value>)> {
        self.values.iter()
    }
}

impl Default for PortStore {
    fn default() -> Self {
        Self {
            values: HashMap::new(),
        }
    }
}

pub async fn execute(
    graph: &GraphSpec,
    registry: &NodeRegistry,
    ctx: &ExecutionContext,
) -> Result<PortStore> {
    validate(graph, registry)?;
    let order = topo_sort(graph)?;
    let mut store = PortStore::default();

    for node_id in order {
        let node_spec = graph.node(&node_id)?;

        let op = registry
            .get(&node_spec.kind)
            .ok_or_else(|| Error::UnknownKind(node_spec.kind.clone()))?;

        let meta = op.meta();
        let mut inputs = ResolvedInputs::new();
        for input in &meta.inputs {
            let wire_to = PortRef::new(&node_id, &input.name)?;
            let wire = graph.edge_to(&wire_to)?;

            inputs.insert(&input.name, store.get(&wire.from)?);
        }

        let outputs = op.execute(ctx, inputs, &node_spec.params).await?;
        for output in &meta.outputs {
            let value = outputs
                .get(&output.name)
                .ok_or_else(|| Error::PortNotFound(output.name.clone()))?;
            store.insert(PortRef::new(&node_id, &output.name)?, value.clone());
        }
    }

    Ok(store)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        registry::builtin_registry,
        runtime::{FakeCandleSource, value::Value},
        spec::{
            GraphKind, NodeSpec,
            graph::{Edge, GraphSpec},
        },
    };
    use common::types::Candle;

    #[tokio::test]
    async fn execute_datasource_wires_close_to_sma() {
        let candles = vec![
            Candle {
                timestamp: 1,
                open: 1.0,
                high: 2.0,
                low: 0.5,
                close: 1.0,
                volume: 10.0,
            },
            Candle {
                timestamp: 2,
                open: 1.0,
                high: 2.0,
                low: 0.5,
                close: 2.0,
                volume: 11.0,
            },
            Candle {
                timestamp: 3,
                open: 2.0,
                high: 3.0,
                low: 1.5,
                close: 3.0,
                volume: 12.0,
            },
        ];
        let ctx = ExecutionContext::new(Arc::new(FakeCandleSource::new(candles)));

        let graph = GraphSpec {
            id: "ds-sma".to_string(),
            version: 1,
            kind: GraphKind::Chart,
            nodes: vec![
                NodeSpec {
                    id: "ds1".to_string(),
                    kind: "datasource.candles".to_string(),
                    params: serde_json::json!({
                        "exchange": "bybit",
                        "category": "spot",
                        "symbol": "BTCUSDT",
                        "interval": "1d"
                    }),
                },
                NodeSpec {
                    id: "sma20".to_string(),
                    kind: "indicator.sma".to_string(),
                    params: serde_json::json!({ "period": 2 }),
                },
            ],
            edges: vec![Edge {
                from: PortRef::new("ds1", "close").unwrap(),
                to: PortRef::new("sma20", "input").unwrap(),
            }],
        };

        let store = execute(&graph, &builtin_registry(), &ctx).await.unwrap();
        let value = store.get(&PortRef::new("sma20", "value").unwrap()).unwrap();
        assert!(matches!(value.as_ref(), Value::SeriesF64(_)));
    }
}
