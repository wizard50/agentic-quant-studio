use async_trait::async_trait;
use std::sync::Arc;

use crate::{
    error::Result,
    runtime::{
        candles::CandleQuery,
        context::ExecutionContext,
        node::{
            NodeCategory, NodeMeta, NodeOp, Param, ParamKind, Port, ResolvedInputs, ResolvedOutputs,
        },
        value::{Value, ValueKind},
    },
};

pub const KIND: &str = "datasource.candles";

pub const OUTPUT_TIMESTAMP: &str = "timestamp";
pub const OUTPUT_OPEN: &str = "open";
pub const OUTPUT_HIGH: &str = "high";
pub const OUTPUT_LOW: &str = "low";
pub const OUTPUT_CLOSE: &str = "close";
pub const OUTPUT_VOLUME: &str = "volume";

pub struct CandlesOp;

impl CandlesOp {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl NodeOp for CandlesOp {
    fn meta(&self) -> NodeMeta {
        NodeMeta {
            kind: KIND.to_string(),
            category: NodeCategory::DataSource,
            inputs: vec![],
            outputs: vec![
                Port {
                    name: OUTPUT_TIMESTAMP.to_string(),
                    kind: ValueKind::SeriesI64,
                },
                Port {
                    name: OUTPUT_OPEN.to_string(),
                    kind: ValueKind::SeriesF64,
                },
                Port {
                    name: OUTPUT_HIGH.to_string(),
                    kind: ValueKind::SeriesF64,
                },
                Port {
                    name: OUTPUT_LOW.to_string(),
                    kind: ValueKind::SeriesF64,
                },
                Port {
                    name: OUTPUT_CLOSE.to_string(),
                    kind: ValueKind::SeriesF64,
                },
                Port {
                    name: OUTPUT_VOLUME.to_string(),
                    kind: ValueKind::SeriesF64,
                },
            ],
            params: vec![
                Param {
                    name: "exchange".to_string(),
                    kind: ParamKind::String,
                },
                Param {
                    name: "category".to_string(),
                    kind: ParamKind::String,
                },
                Param {
                    name: "symbol".to_string(),
                    kind: ParamKind::String,
                },
                Param {
                    name: "interval".to_string(),
                    kind: ParamKind::String,
                },
            ],
        }
    }

    async fn execute(
        &self,
        ctx: &ExecutionContext,
        _inputs: ResolvedInputs,
        params: &serde_json::Value,
    ) -> Result<ResolvedOutputs> {
        let query = CandleQuery::from_params(params)?;
        let candles = ctx.candles().load_candles(&query).await?;
        let ohlcv = crate::runtime::candles::candles_to_series(&candles);

        let mut outputs = ResolvedOutputs::new();
        outputs.set(
            OUTPUT_TIMESTAMP,
            Value::SeriesI64(Arc::new(ohlcv.timestamp)),
        );
        outputs.set(OUTPUT_OPEN, Value::SeriesF64(Arc::new(ohlcv.open)));
        outputs.set(OUTPUT_HIGH, Value::SeriesF64(Arc::new(ohlcv.high)));
        outputs.set(OUTPUT_LOW, Value::SeriesF64(Arc::new(ohlcv.low)));
        outputs.set(OUTPUT_CLOSE, Value::SeriesF64(Arc::new(ohlcv.close)));
        outputs.set(OUTPUT_VOLUME, Value::SeriesF64(Arc::new(ohlcv.volume)));
        Ok(outputs)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::FakeCandleSource;
    use common::types::Candle;

    #[tokio::test]
    async fn loads_candles_from_context() {
        let candles = vec![Candle {
            timestamp: 1,
            open: 1.0,
            high: 2.0,
            low: 0.5,
            close: 1.5,
            volume: 10.0,
        }];
        let ctx = ExecutionContext::new(Arc::new(FakeCandleSource::new(candles.clone())));

        let outputs = CandlesOp::new()
            .execute(
                &ctx,
                ResolvedInputs::new(),
                &serde_json::json!({
                    "exchange": "bybit",
                    "category": "spot",
                    "symbol": "BTCUSDT",
                    "interval": "1d"
                }),
            )
            .await
            .unwrap();

        let timestamp = outputs.get(OUTPUT_TIMESTAMP).unwrap();
        let Value::SeriesI64(timestamp) = timestamp else {
            panic!("expected timestamp series");
        };
        assert_eq!(timestamp.values, vec![Some(1)]);

        let close = outputs.get(OUTPUT_CLOSE).unwrap();
        let Value::SeriesF64(close) = close else {
            panic!("expected close series");
        };
        assert_eq!(close.values, vec![Some(1.5)]);
    }
}
