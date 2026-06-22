use crate::{
    error::Result,
    runtime::{
        context::ExecutionContext,
        node::{
            NodeCategory, NodeMeta, NodeOp, Param, ParamKind, Port, ResolvedInputs, ResolvedOutputs,
        },
        value::ValueKind,
    },
};
use async_trait::async_trait;

pub struct OutputSeriesOp;

impl OutputSeriesOp {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl NodeOp for OutputSeriesOp {
    fn meta(&self) -> NodeMeta {
        NodeMeta {
            kind: "output.series".to_string(),
            category: NodeCategory::Output,
            inputs: vec![Port {
                name: "series".to_string(),
                kind: ValueKind::SeriesF64,
            }],
            outputs: vec![Port {
                name: "series".to_string(),
                kind: ValueKind::SeriesF64,
            }],
            params: vec![Param {
                name: "label".to_string(),
                kind: ParamKind::String,
            }],
        }
    }

    async fn execute(
        &self,
        _ctx: &ExecutionContext,
        inputs: ResolvedInputs,
        _params: &serde_json::Value,
    ) -> Result<ResolvedOutputs> {
        let value = inputs.get("series")?.clone();
        let mut outputs = ResolvedOutputs::new();
        outputs.set("series", value);
        Ok(outputs)
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use super::*;
    use crate::runtime::{
        ExecutionContext, FakeCandleSource,
        value::{SeriesF64, Value},
    };

    #[tokio::test]
    async fn passes_through_series() {
        let op = OutputSeriesOp::new();
        let ctx = ExecutionContext::new(Arc::new(FakeCandleSource::new(vec![])));
        let mut inputs = ResolvedInputs::new();
        inputs.insert(
            "series",
            Arc::new(Value::SeriesF64(Arc::new(SeriesF64 {
                values: vec![Some(1.0), Some(2.0)],
            }))),
        );

        let outputs = op
            .execute(&ctx, inputs, &serde_json::json!({ "label": "SMA 20" }))
            .await
            .unwrap();

        assert!(matches!(outputs.get("series"), Some(Value::SeriesF64(_))));
    }
}
