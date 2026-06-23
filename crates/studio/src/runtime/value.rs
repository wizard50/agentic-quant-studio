use serde::Serialize;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize)]
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

#[derive(Debug, Clone, Serialize)]
pub struct SeriesI64 {
    pub values: Vec<Option<i64>>,
}

#[derive(Debug, Clone, Serialize)]
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

impl Serialize for Value {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeMap;

        let mut map = serializer.serialize_map(Some(2))?;
        match self {
            Value::SeriesI64(series) => {
                map.serialize_entry("kind", "series_i64")?;
                map.serialize_entry("values", &series.values)?;
            }
            Value::SeriesF64(series) => {
                map.serialize_entry("kind", "series_f64")?;
                map.serialize_entry("values", &series.values)?;
            }
            Value::SeriesBool(series) => {
                map.serialize_entry("kind", "series_bool")?;
                map.serialize_entry("values", &series.values)?;
            }
            Value::F64(value) => {
                map.serialize_entry("kind", "f64")?;
                map.serialize_entry("value", value)?;
            }
            Value::Bool(value) => {
                map.serialize_entry("kind", "bool")?;
                map.serialize_entry("value", value)?;
            }
        }
        map.end()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    #[test]
    fn value_serializes_with_kind_tag() {
        let value = Value::SeriesF64(Arc::new(SeriesF64 {
            values: vec![Some(1.0), None],
        }));

        let json = serde_json::to_value(&value).unwrap();
        assert_eq!(json["kind"], "series_f64");
        assert_eq!(json["values"][0], 1.0);
        assert!(json["values"][1].is_null());
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
