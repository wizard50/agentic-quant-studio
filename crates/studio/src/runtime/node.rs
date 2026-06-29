use crate::error::{Error, Result};
use crate::runtime::context::ExecutionContext;
use crate::runtime::display::ChartDefaults;
use crate::runtime::value::{SeriesF64, SeriesI64, Value, ValueKind};
use async_trait::async_trait;
use std::{collections::HashMap, sync::Arc};

#[derive(Debug, Clone)]
pub struct NodeMeta {
    pub kind: String,
    pub category: NodeCategory,
    pub inputs: Vec<Port>,
    pub outputs: Vec<Port>,
    pub params: Vec<Param>,
    pub chart_defaults: Option<ChartDefaults>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NodeCategory {
    DataSource,
    Indicator,
}

#[derive(Debug, Clone)]
pub struct Port {
    pub name: String,
    pub kind: ValueKind,
}

impl Port {
    pub fn type_match(&self, other: &Port) -> bool {
        self.kind == other.kind
    }
}

#[derive(Debug, Clone)]
pub struct Param {
    pub name: String,
    pub kind: ParamKind,
    pub default: Option<serde_json::Value>,
    pub min: Option<f64>,
    pub max: Option<f64>,
}

impl Param {
    pub fn new(name: impl Into<String>, kind: ParamKind) -> Self {
        Self {
            name: name.into(),
            kind,
            default: None,
            min: None,
            max: None,
        }
    }

    pub fn with_default(mut self, default: serde_json::Value) -> Self {
        self.default = Some(default);
        self
    }

    pub fn with_min(mut self, min: f64) -> Self {
        self.min = Some(min);
        self
    }

    pub fn with_max(mut self, max: f64) -> Self {
        self.max = Some(max);
        self
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ParamKind {
    F64,
    U32,
    String,
    Bool,
}

#[async_trait]
pub trait NodeOp: Send + Sync {
    fn meta(&self) -> NodeMeta;

    async fn execute(
        &self,
        ctx: &ExecutionContext,
        inputs: ResolvedInputs,
        params: &serde_json::Value,
    ) -> Result<ResolvedOutputs>;
}

pub struct ResolvedInputs {
    inner: HashMap<String, Arc<Value>>,
}

impl ResolvedInputs {
    pub fn new() -> Self {
        Self {
            inner: HashMap::new(),
        }
    }

    pub fn insert(&mut self, port: impl Into<String>, value: Arc<Value>) {
        self.inner.insert(port.into(), value);
    }

    pub fn get(&self, port: &str) -> Result<&Value> {
        self.inner
            .get(port)
            .map(|value| value.as_ref())
            .ok_or_else(|| Error::PortNotFound(port.to_string()))
    }

    pub fn series_i64(&self, port: &str) -> Result<&SeriesI64> {
        match self.get(port)? {
            Value::SeriesI64(series) => Ok(series.as_ref()),
            other => Err(Error::TypeMismatch {
                port: port.to_string(),
                expected: ValueKind::SeriesI64,
                got: other.kind(),
            }),
        }
    }

    pub fn series_f64(&self, port: &str) -> Result<&SeriesF64> {
        match self.get(port)? {
            Value::SeriesF64(series) => Ok(series.as_ref()),
            other => Err(Error::TypeMismatch {
                port: port.to_string(),
                expected: ValueKind::SeriesF64,
                got: other.kind(),
            }),
        }
    }
}

impl Default for ResolvedInputs {
    fn default() -> Self {
        Self::new()
    }
}

pub struct ResolvedOutputs {
    inner: HashMap<String, Value>,
}

impl ResolvedOutputs {
    pub fn new() -> Self {
        Self {
            inner: HashMap::new(),
        }
    }

    pub fn set(&mut self, port: impl Into<String>, value: Value) {
        self.inner.insert(port.into(), value);
    }

    pub fn get(&self, port: &str) -> Option<&Value> {
        self.inner.get(port)
    }
}
