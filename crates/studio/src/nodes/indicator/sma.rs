use std::sync::Arc;

use crate::{
    error::{Error, Result},
    runtime::{
        node::{
            NodeCategory, NodeMeta, NodeOp, Param, ParamKind, Port, ResolvedInputs, ResolvedOutputs,
        },
        value::{SeriesF64, Value, ValueKind},
    },
};
use talib_rs::overlap::sma;

pub struct SmaOp;

impl SmaOp {
    pub fn new() -> Self {
        Self
    }
}

impl NodeOp for SmaOp {
    fn meta(&self) -> NodeMeta {
        NodeMeta {
            kind: "indicator.sma".to_string(),
            category: NodeCategory::Indicator,
            inputs: vec![Port {
                name: "input".to_string(),
                kind: ValueKind::SeriesF64,
            }],
            outputs: vec![Port {
                name: "value".to_string(),
                kind: ValueKind::SeriesF64,
            }],
            params: vec![Param {
                name: "period".to_string(),
                kind: ParamKind::U32,
            }],
        }
    }

    fn execute(
        &self,
        inputs: ResolvedInputs,
        params: &serde_json::Value,
    ) -> Result<ResolvedOutputs> {
        let series = inputs.series_f64("input")?;
        let period = params
            .get("period")
            .and_then(|value| value.as_u64())
            .ok_or_else(|| Error::ParamNotFound("period".to_string()))?;

        if period == 0 {
            return Err(Error::InvalidParameter(
                "period must be greater than 0".to_string(),
            ));
        }

        let raw = series.to_talib_vec();

        let result = sma(&raw, period as usize).map_err(|err| Error::Indicator(err.to_string()))?;

        let values = SeriesF64::from_talib_vec(result);

        let mut outputs = ResolvedOutputs::new();
        outputs.set("value", Value::SeriesF64(Arc::new(values)));
        Ok(outputs)
    }
}
