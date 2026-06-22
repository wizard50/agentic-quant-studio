use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct SeriesF64 {
    pub values: Vec<Option<f64>>,
}

impl SeriesF64 {
    /// Convert to a f64 vector suitable for TA-Lib (None → NaN)
    pub fn to_talib_vec(&self) -> Vec<f64> {
        self.values.iter().map(|v| v.unwrap_or(f64::NAN)).collect()
    }

    /// Create a SeriesF64 from a TA-Lib result (NaN → None)
    pub fn from_talib_vec(data: Vec<f64>) -> Self {
        let values = data
            .into_iter()
            .map(|v| if v.is_nan() { None } else { Some(v) })
            .collect();

        Self { values }
    }
}

#[derive(Debug, Clone)]
pub struct SeriesI64 {
    pub values: Vec<Option<i64>>,
}

#[derive(Debug, Clone)]
pub struct SeriesBool {
    pub values: Vec<Option<bool>>,
}

#[derive(Debug, Clone)]
pub enum Value {
    SeriesI64(Arc<SeriesI64>),
    SeriesF64(Arc<SeriesF64>),
    SeriesBool(Arc<SeriesBool>),
    F64(f64),
    Bool(bool),
}

impl Value {
    pub fn kind(&self) -> ValueKind {
        match self {
            Value::SeriesI64(_) => ValueKind::SeriesI64,
            Value::SeriesF64(_) => ValueKind::SeriesF64,
            Value::SeriesBool(_) => ValueKind::SeriesBool,
            Value::F64(_) => ValueKind::F64,
            Value::Bool(_) => ValueKind::Bool,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ValueKind {
    SeriesI64,
    SeriesF64,
    SeriesBool,
    F64,
    Bool,
}
