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

    fn sample_candles() -> Vec<Candle> {
        vec![
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
        ]
    }

    async fn execute_close_to_indicator(kind: &str, node_id: &str) {
        let ctx = ExecutionContext::new(Arc::new(FakeCandleSource::new(sample_candles())));

        let graph = GraphSpec {
            id: format!("ds-{node_id}"),
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
                    id: node_id.to_string(),
                    kind: kind.to_string(),
                    params: serde_json::json!({ "period": 2 }),
                },
            ],
            edges: vec![Edge {
                from: PortRef::new("ds1", "close").unwrap(),
                to: PortRef::new(node_id, "input").unwrap(),
            }],
        };

        let store = execute(&graph, &builtin_registry(), &ctx).await.unwrap();
        let value = store.get(&PortRef::new(node_id, "value").unwrap()).unwrap();
        assert!(matches!(value.as_ref(), Value::SeriesF64(_)));
    }

    #[tokio::test]
    async fn execute_datasource_wires_close_to_sma() {
        execute_close_to_indicator("indicator.sma", "sma20").await;
    }

    #[tokio::test]
    async fn execute_datasource_wires_close_to_ema() {
        execute_close_to_indicator("indicator.ema", "ema20").await;
    }

    #[tokio::test]
    async fn execute_datasource_wires_close_to_rsi() {
        execute_close_to_indicator("indicator.rsi", "rsi14").await;
    }

    fn golden_cross_candles() -> Vec<Candle> {
        (0..6)
            .map(|index| {
                let close = match index {
                    0..=3 => 10.0,
                    4 => 20.0,
                    _ => 25.0,
                };

                Candle {
                    timestamp: index as i64 + 1,
                    open: close,
                    high: close + 1.0,
                    low: close - 1.0,
                    close,
                    volume: 10.0 + index as f64,
                }
            })
            .collect()
    }

    #[tokio::test]
    async fn execute_golden_cross_emits_crossover_signal() {
        let ctx = ExecutionContext::new(Arc::new(FakeCandleSource::new(golden_cross_candles())));

        let graph = GraphSpec {
            id: "golden-cross-test".to_string(),
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
                    id: "sma_fast".to_string(),
                    kind: "indicator.sma".to_string(),
                    params: serde_json::json!({ "period": 2 }),
                },
                NodeSpec {
                    id: "sma_slow".to_string(),
                    kind: "indicator.sma".to_string(),
                    params: serde_json::json!({ "period": 3 }),
                },
                NodeSpec {
                    id: "cross".to_string(),
                    kind: "logic.crossover".to_string(),
                    params: serde_json::json!({}),
                },
            ],
            edges: vec![
                Edge {
                    from: PortRef::new("ds1", "close").unwrap(),
                    to: PortRef::new("sma_fast", "input").unwrap(),
                },
                Edge {
                    from: PortRef::new("ds1", "close").unwrap(),
                    to: PortRef::new("sma_slow", "input").unwrap(),
                },
                Edge {
                    from: PortRef::new("sma_fast", "value").unwrap(),
                    to: PortRef::new("cross", "fast").unwrap(),
                },
                Edge {
                    from: PortRef::new("sma_slow", "value").unwrap(),
                    to: PortRef::new("cross", "slow").unwrap(),
                },
            ],
        };

        let store = execute(&graph, &builtin_registry(), &ctx).await.unwrap();
        let signal = store
            .get(&PortRef::new("cross", "signal").unwrap())
            .unwrap();

        let Value::SeriesBool(series) = signal.as_ref() else {
            panic!("expected series_bool output");
        };

        assert_eq!(series.values.len(), 6);
        assert_eq!(series.values[4], Some(true));
        assert!(
            series
                .values
                .iter()
                .filter(|value| **value == Some(true))
                .count()
                == 1
        );
    }

    fn death_cross_candles() -> Vec<Candle> {
        (0..7)
            .map(|index| {
                let close = match index {
                    0..=4 => 25.0,
                    5 => 10.0,
                    _ => 5.0,
                };

                Candle {
                    timestamp: index as i64 + 1,
                    open: close,
                    high: close + 1.0,
                    low: close - 1.0,
                    close,
                    volume: 10.0 + index as f64,
                }
            })
            .collect()
    }

    #[tokio::test]
    async fn execute_death_cross_emits_crossunder_signal() {
        let ctx = ExecutionContext::new(Arc::new(FakeCandleSource::new(death_cross_candles())));

        let graph = GraphSpec {
            id: "death-cross-test".to_string(),
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
                    id: "sma_fast".to_string(),
                    kind: "indicator.sma".to_string(),
                    params: serde_json::json!({ "period": 2 }),
                },
                NodeSpec {
                    id: "sma_slow".to_string(),
                    kind: "indicator.sma".to_string(),
                    params: serde_json::json!({ "period": 3 }),
                },
                NodeSpec {
                    id: "cross".to_string(),
                    kind: "logic.crossunder".to_string(),
                    params: serde_json::json!({}),
                },
            ],
            edges: vec![
                Edge {
                    from: PortRef::new("ds1", "close").unwrap(),
                    to: PortRef::new("sma_fast", "input").unwrap(),
                },
                Edge {
                    from: PortRef::new("ds1", "close").unwrap(),
                    to: PortRef::new("sma_slow", "input").unwrap(),
                },
                Edge {
                    from: PortRef::new("sma_fast", "value").unwrap(),
                    to: PortRef::new("cross", "fast").unwrap(),
                },
                Edge {
                    from: PortRef::new("sma_slow", "value").unwrap(),
                    to: PortRef::new("cross", "slow").unwrap(),
                },
            ],
        };

        let store = execute(&graph, &builtin_registry(), &ctx).await.unwrap();
        let signal = store
            .get(&PortRef::new("cross", "signal").unwrap())
            .unwrap();

        let Value::SeriesBool(series) = signal.as_ref() else {
            panic!("expected series_bool output");
        };

        assert_eq!(series.values.len(), 7);
        assert_eq!(series.values[5], Some(true));
        assert!(
            series
                .values
                .iter()
                .filter(|value| **value == Some(true))
                .count()
                == 1
        );
    }

    #[tokio::test]
    async fn execute_gt_compares_indicator_series() {
        let ctx = ExecutionContext::new(Arc::new(FakeCandleSource::new(golden_cross_candles())));

        let graph = GraphSpec {
            id: "gt-test".to_string(),
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
                    id: "sma_fast".to_string(),
                    kind: "indicator.sma".to_string(),
                    params: serde_json::json!({ "period": 2 }),
                },
                NodeSpec {
                    id: "sma_slow".to_string(),
                    kind: "indicator.sma".to_string(),
                    params: serde_json::json!({ "period": 3 }),
                },
                NodeSpec {
                    id: "gt".to_string(),
                    kind: "logic.gt".to_string(),
                    params: serde_json::json!({}),
                },
            ],
            edges: vec![
                Edge {
                    from: PortRef::new("ds1", "close").unwrap(),
                    to: PortRef::new("sma_fast", "input").unwrap(),
                },
                Edge {
                    from: PortRef::new("ds1", "close").unwrap(),
                    to: PortRef::new("sma_slow", "input").unwrap(),
                },
                Edge {
                    from: PortRef::new("sma_fast", "value").unwrap(),
                    to: PortRef::new("gt", "left").unwrap(),
                },
                Edge {
                    from: PortRef::new("sma_slow", "value").unwrap(),
                    to: PortRef::new("gt", "right").unwrap(),
                },
            ],
        };

        let store = execute(&graph, &builtin_registry(), &ctx).await.unwrap();
        let signal = store.get(&PortRef::new("gt", "signal").unwrap()).unwrap();

        let Value::SeriesBool(series) = signal.as_ref() else {
            panic!("expected series_bool output");
        };

        assert_eq!(series.values[3], Some(false));
        assert_eq!(series.values[4], Some(true));
        assert_eq!(series.values[5], Some(true));
    }

    #[tokio::test]
    async fn execute_and_combines_cross_signals() {
        let ctx = ExecutionContext::new(Arc::new(FakeCandleSource::new(golden_cross_candles())));

        let graph = GraphSpec {
            id: "and-test".to_string(),
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
                    id: "sma_fast".to_string(),
                    kind: "indicator.sma".to_string(),
                    params: serde_json::json!({ "period": 2 }),
                },
                NodeSpec {
                    id: "sma_slow".to_string(),
                    kind: "indicator.sma".to_string(),
                    params: serde_json::json!({ "period": 3 }),
                },
                NodeSpec {
                    id: "crossover".to_string(),
                    kind: "logic.crossover".to_string(),
                    params: serde_json::json!({}),
                },
                NodeSpec {
                    id: "gt".to_string(),
                    kind: "logic.gt".to_string(),
                    params: serde_json::json!({}),
                },
                NodeSpec {
                    id: "and".to_string(),
                    kind: "logic.and".to_string(),
                    params: serde_json::json!({}),
                },
            ],
            edges: vec![
                Edge {
                    from: PortRef::new("ds1", "close").unwrap(),
                    to: PortRef::new("sma_fast", "input").unwrap(),
                },
                Edge {
                    from: PortRef::new("ds1", "close").unwrap(),
                    to: PortRef::new("sma_slow", "input").unwrap(),
                },
                Edge {
                    from: PortRef::new("sma_fast", "value").unwrap(),
                    to: PortRef::new("crossover", "fast").unwrap(),
                },
                Edge {
                    from: PortRef::new("sma_slow", "value").unwrap(),
                    to: PortRef::new("crossover", "slow").unwrap(),
                },
                Edge {
                    from: PortRef::new("sma_fast", "value").unwrap(),
                    to: PortRef::new("gt", "left").unwrap(),
                },
                Edge {
                    from: PortRef::new("sma_slow", "value").unwrap(),
                    to: PortRef::new("gt", "right").unwrap(),
                },
                Edge {
                    from: PortRef::new("crossover", "signal").unwrap(),
                    to: PortRef::new("and", "left").unwrap(),
                },
                Edge {
                    from: PortRef::new("gt", "signal").unwrap(),
                    to: PortRef::new("and", "right").unwrap(),
                },
            ],
        };

        let store = execute(&graph, &builtin_registry(), &ctx).await.unwrap();
        let signal = store.get(&PortRef::new("and", "signal").unwrap()).unwrap();

        let Value::SeriesBool(series) = signal.as_ref() else {
            panic!("expected series_bool output");
        };

        assert_eq!(series.values[4], Some(true));
        assert_eq!(series.values[5], Some(false));
        assert!(
            series
                .values
                .iter()
                .filter(|value| **value == Some(true))
                .count()
                == 1
        );
    }

    fn threshold_compare_candles() -> Vec<Candle> {
        [25.0, 35.0, 25.0, 40.0]
            .into_iter()
            .enumerate()
            .map(|(index, close)| Candle {
                timestamp: index as i64 + 1,
                open: close,
                high: close + 1.0,
                low: close - 1.0,
                close,
                volume: 10.0 + index as f64,
            })
            .collect()
    }

    #[tokio::test]
    async fn execute_literal_number_broadcasts_for_threshold_compare() {
        let ctx =
            ExecutionContext::new(Arc::new(FakeCandleSource::new(threshold_compare_candles())));

        let graph = GraphSpec {
            id: "literal-lt-test".to_string(),
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
                    id: "threshold".to_string(),
                    kind: "literal.number".to_string(),
                    params: serde_json::json!({ "value": 30.0 }),
                },
                NodeSpec {
                    id: "lt".to_string(),
                    kind: "logic.lt".to_string(),
                    params: serde_json::json!({}),
                },
            ],
            edges: vec![
                Edge {
                    from: PortRef::new("ds1", "timestamp").unwrap(),
                    to: PortRef::new("threshold", "reference").unwrap(),
                },
                Edge {
                    from: PortRef::new("ds1", "close").unwrap(),
                    to: PortRef::new("lt", "left").unwrap(),
                },
                Edge {
                    from: PortRef::new("threshold", "value").unwrap(),
                    to: PortRef::new("lt", "right").unwrap(),
                },
            ],
        };

        let store = execute(&graph, &builtin_registry(), &ctx).await.unwrap();

        let literal = store
            .get(&PortRef::new("threshold", "value").unwrap())
            .unwrap();
        let Value::SeriesF64(literal_series) = literal.as_ref() else {
            panic!("expected literal series_f64 output");
        };
        assert_eq!(
            literal_series.values,
            vec![Some(30.0), Some(30.0), Some(30.0), Some(30.0)]
        );

        let signal = store.get(&PortRef::new("lt", "signal").unwrap()).unwrap();
        let Value::SeriesBool(series) = signal.as_ref() else {
            panic!("expected series_bool output");
        };
        assert_eq!(
            series.values,
            vec![Some(true), Some(false), Some(true), Some(false)]
        );
    }
}
