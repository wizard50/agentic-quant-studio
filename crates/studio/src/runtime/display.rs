use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ChartRole {
    Overlay,
    Oscillator,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValueRange {
    pub min: f64,
    pub max: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChartDefaults {
    pub role: ChartRole,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value_range: Option<ValueRange>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warmup_bars: Option<u32>,
}
