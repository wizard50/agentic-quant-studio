use crate::error::{Error, Result};
use crate::runtime::context::ExecutionContext;
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
}

#[derive(Debug, Clone)]
pub enum NodeCategory {
    DataSource,
    Indicator,
    Output,
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
