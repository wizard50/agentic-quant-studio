use std::sync::Arc;

use talib_rs::TaResult;

use crate::{
    error::{Error, Result},
    runtime::{
        node::{NodeCategory, NodeMeta, Param, ParamKind, Port, ResolvedInputs, ResolvedOutputs},
        value::{SeriesF64, Value, ValueKind},
    },
};

pub fn single_series_value_meta(kind: &str, default_period: u32) -> NodeMeta {
    NodeMeta {
        kind: kind.to_string(),
        category: NodeCategory::Indicator,
        inputs: vec![Port {
            name: "input".to_string(),
            kind: ValueKind::SeriesF64,
        }],
        outputs: vec![Port {
            name: "value".to_string(),
            kind: ValueKind::SeriesF64,
        }],
        params: vec![
            Param::new("period", ParamKind::U32)
                .with_default(serde_json::json!(default_period))
                .with_min(1.0),
        ],
    }
}

pub fn parse_period(params: &serde_json::Value) -> Result<usize> {
    let period = params
        .get("period")
        .and_then(|value| value.as_u64())
        .ok_or_else(|| Error::ParamNotFound("period".to_string()))?;

    if period == 0 {
        return Err(Error::InvalidParameter(
            "period must be greater than 0".to_string(),
        ));
    }

    Ok(period as usize)
}

pub fn execute_period_overlay(
    inputs: ResolvedInputs,
    params: &serde_json::Value,
    compute: impl FnOnce(&[f64], usize) -> TaResult<Vec<f64>>,
) -> Result<ResolvedOutputs> {
    let series = inputs.series_f64("input")?;
    let period = parse_period(params)?;
    let raw = series.to_talib_vec();
    let result = compute(&raw, period).map_err(|err| Error::Indicator(err.to_string()))?;
    let values = SeriesF64::from_talib_vec(result);

    let mut outputs = ResolvedOutputs::new();
    outputs.set("value", Value::SeriesF64(Arc::new(values)));
    Ok(outputs)
}
