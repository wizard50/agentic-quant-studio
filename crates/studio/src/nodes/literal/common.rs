use std::sync::Arc;

use crate::{
    error::{Error, Result},
    runtime::{
        node::{NodeCategory, NodeMeta, Param, ParamKind, Port, ResolvedInputs, ResolvedOutputs},
        value::{SeriesBool, SeriesF64, SeriesI64, Value, ValueKind},
    },
};

pub fn number_meta(kind: &str) -> NodeMeta {
    literal_meta(
        kind,
        ValueKind::SeriesF64,
        vec![Param::new("value", ParamKind::F64).with_default(serde_json::json!(0.0))],
    )
}

pub fn bool_meta(kind: &str) -> NodeMeta {
    literal_meta(
        kind,
        ValueKind::SeriesBool,
        vec![Param::new("value", ParamKind::Bool).with_default(serde_json::json!(false))],
    )
}

fn literal_meta(kind: &str, output_kind: ValueKind, params: Vec<Param>) -> NodeMeta {
    NodeMeta {
        kind: kind.to_string(),
        category: NodeCategory::Literal,
        inputs: vec![Port {
            name: "reference".to_string(),
            kind: ValueKind::SeriesI64,
        }],
        outputs: vec![Port {
            name: "value".to_string(),
            kind: output_kind,
        }],
        params,
        chart_defaults: None,
    }
}

pub fn parse_f64_param(params: &serde_json::Value, name: &str) -> Result<f64> {
    params
        .get(name)
        .and_then(|value| value.as_f64())
        .ok_or_else(|| Error::ParamNotFound(name.to_string()))
}

pub fn parse_bool_param(params: &serde_json::Value, name: &str) -> Result<bool> {
    params
        .get(name)
        .and_then(|value| value.as_bool())
        .ok_or_else(|| Error::ParamNotFound(name.to_string()))
}

pub fn broadcast_f64(reference: &SeriesI64, value: f64) -> SeriesF64 {
    SeriesF64 {
        values: vec![Some(value); reference.values.len()],
    }
}

pub fn broadcast_bool(reference: &SeriesI64, value: bool) -> SeriesBool {
    SeriesBool {
        values: vec![Some(value); reference.values.len()],
    }
}

pub fn execute_number_literal(
    inputs: ResolvedInputs,
    params: &serde_json::Value,
) -> Result<ResolvedOutputs> {
    let reference = inputs.series_i64("reference")?;
    let value = parse_f64_param(params, "value")?;
    let series = broadcast_f64(reference, value);

    let mut outputs = ResolvedOutputs::new();
    outputs.set("value", Value::SeriesF64(Arc::new(series)));
    Ok(outputs)
}

pub fn execute_bool_literal(
    inputs: ResolvedInputs,
    params: &serde_json::Value,
) -> Result<ResolvedOutputs> {
    let reference = inputs.series_i64("reference")?;
    let value = parse_bool_param(params, "value")?;
    let series = broadcast_bool(reference, value);

    let mut outputs = ResolvedOutputs::new();
    outputs.set("value", Value::SeriesBool(Arc::new(series)));
    Ok(outputs)
}
