use serde::Serialize;

use crate::{
    registry::NodeRegistry,
    runtime::{
        node::{NodeMeta, Param, ParamKind},
        value::ValueKind,
    },
};

#[derive(Debug, Clone, Serialize)]
pub struct IndicatorCatalog {
    pub indicators: Vec<IndicatorEntry>,
}

#[derive(Debug, Clone, Serialize)]
pub struct IndicatorEntry {
    pub kind: String,
    pub inputs: Vec<CatalogPort>,
    pub outputs: Vec<CatalogPort>,
    pub params: Vec<CatalogParam>,
}

/// A wired port on the graph. `type` is the element type; `series` marks a time series.
#[derive(Debug, Clone, Serialize)]
pub struct CatalogPort {
    pub name: String,
    #[serde(rename = "type")]
    pub element_type: CatalogType,
    pub series: bool,
}

/// A node configuration parameter. Always scalar — no `series` flag.
#[derive(Debug, Clone, Serialize)]
pub struct CatalogParam {
    pub name: String,
    #[serde(rename = "type")]
    pub element_type: CatalogType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CatalogType {
    Integer,
    Number,
    String,
    Boolean,
}

impl IndicatorCatalog {
    pub fn from_registry(registry: &NodeRegistry) -> Self {
        Self {
            indicators: registry
                .indicator_metas()
                .into_iter()
                .map(IndicatorEntry::from_meta)
                .collect(),
        }
    }
}

impl IndicatorEntry {
    fn from_meta(meta: NodeMeta) -> Self {
        Self {
            kind: meta.kind,
            inputs: meta.inputs.iter().map(CatalogPort::from_port).collect(),
            outputs: meta.outputs.iter().map(CatalogPort::from_port).collect(),
            params: meta.params.iter().map(CatalogParam::from_param).collect(),
        }
    }
}

impl CatalogPort {
    fn from_port(port: &crate::runtime::node::Port) -> Self {
        let (series, element_type) = map_port_kind(port.kind);
        Self {
            name: port.name.clone(),
            element_type,
            series,
        }
    }
}

impl CatalogParam {
    fn from_param(param: &Param) -> Self {
        Self {
            name: param.name.clone(),
            element_type: map_param_kind(param.kind),
            default: param.default.clone(),
            min: param.min.and_then(|value| bound_json(param.kind, value)),
            max: param.max.and_then(|value| bound_json(param.kind, value)),
        }
    }
}

fn map_param_kind(kind: ParamKind) -> CatalogType {
    match kind {
        ParamKind::U32 => CatalogType::Integer,
        ParamKind::F64 => CatalogType::Number,
        ParamKind::String => CatalogType::String,
        ParamKind::Bool => CatalogType::Boolean,
    }
}

fn map_port_kind(kind: ValueKind) -> (bool, CatalogType) {
    match kind {
        ValueKind::SeriesF64 => (true, CatalogType::Number),
        ValueKind::SeriesI64 => (true, CatalogType::Integer),
        ValueKind::SeriesBool => (true, CatalogType::Boolean),
        ValueKind::F64 => (false, CatalogType::Number),
        ValueKind::Bool => (false, CatalogType::Boolean),
    }
}

fn bound_json(kind: ParamKind, value: f64) -> Option<serde_json::Value> {
    match kind {
        ParamKind::U32 => Some(serde_json::json!(value.round() as u64)),
        ParamKind::Bool => Some(serde_json::Value::Bool(value != 0.0)),
        ParamKind::F64 => serde_json::Number::from_f64(value).map(serde_json::Value::Number),
        ParamKind::String => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::registry::builtin_registry;

    fn indicator_entry<'a>(json: &'a serde_json::Value, kind: &str) -> &'a serde_json::Value {
        json["indicators"]
            .as_array()
            .unwrap_or_else(|| panic!("expected indicators array"))
            .iter()
            .find(|entry| entry["kind"] == kind)
            .unwrap_or_else(|| panic!("missing indicator kind: {kind}"))
    }

    fn assert_period_line_indicator(entry: &serde_json::Value, default_period: u64) {
        assert_eq!(entry["inputs"][0]["name"], "input");
        assert_eq!(entry["inputs"][0]["type"], "number");
        assert_eq!(entry["inputs"][0]["series"], true);
        assert_eq!(entry["outputs"][0]["name"], "value");
        assert_eq!(entry["outputs"][0]["type"], "number");
        assert_eq!(entry["outputs"][0]["series"], true);
        assert_eq!(entry["params"][0]["name"], "period");
        assert_eq!(entry["params"][0]["type"], "integer");
        assert_eq!(entry["params"][0]["default"], default_period);
        assert_eq!(entry["params"][0]["min"], 1);
    }

    #[test]
    fn serializes_normalized_indicator_catalog() {
        let registry = builtin_registry();
        let catalog = IndicatorCatalog::from_registry(&registry);
        let json = serde_json::to_value(&catalog).unwrap();
        let indicators = json["indicators"].as_array().unwrap();

        assert_eq!(indicators.len(), 3);
        assert_eq!(indicators[0]["kind"], "indicator.ema");
        assert_eq!(indicators[1]["kind"], "indicator.rsi");
        assert_eq!(indicators[2]["kind"], "indicator.sma");

        assert_period_line_indicator(indicator_entry(&json, "indicator.ema"), 20);
        assert_period_line_indicator(indicator_entry(&json, "indicator.sma"), 20);
        assert_period_line_indicator(indicator_entry(&json, "indicator.rsi"), 14);
    }
}
