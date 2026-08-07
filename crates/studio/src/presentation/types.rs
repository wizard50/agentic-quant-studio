use std::collections::BTreeMap;

use serde::{Deserialize, Deserializer, Serialize, Serializer};

use crate::runtime::display::ValueRange;

pub const PRESENTATION_VERSION: u32 = 1;
pub const MAIN_PANE_ID: &str = "main";
/// Market candlestick layer id (matches frontend `MARKET_LAYER_ID`).
pub const MARKET_LAYER_ID: &str = "candles";
pub const DEFAULT_SUBCHART_PANE_HEIGHT: u32 = 144;

/// Derived chart layout for a graph (no embedded `GraphSpec`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PresentationSpec {
    pub version: u32,
    pub panes: Vec<PaneSpec>,
    /// Sorted unique port refs (`node_id.port_name`) for studio runs.
    pub outputs: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PaneSpec {
    pub id: String,
    pub role: PaneRole,
    pub height: PaneHeight,
    pub layers: Vec<LayerSpec>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PaneRole {
    Main,
    Subchart,
}

/// Pane height: JSON `"flex"` or a pixel number (matches frontend).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PaneHeight {
    Flex,
    Fixed(u32),
}

impl Serialize for PaneHeight {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match self {
            Self::Flex => serializer.serialize_str("flex"),
            Self::Fixed(n) => serializer.serialize_u32(*n),
        }
    }
}

impl<'de> Deserialize<'de> for PaneHeight {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct PaneHeightVisitor;

        impl<'de> serde::de::Visitor<'de> for PaneHeightVisitor {
            type Value = PaneHeight;

            fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
                f.write_str("\"flex\" or a non-negative integer")
            }

            fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                if v == "flex" {
                    Ok(PaneHeight::Flex)
                } else {
                    Err(E::unknown_variant(v, &["flex"]))
                }
            }

            fn visit_u64<E>(self, v: u64) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                u32::try_from(v)
                    .map(PaneHeight::Fixed)
                    .map_err(|_| E::custom("pane height out of range"))
            }

            fn visit_i64<E>(self, v: i64) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                if v < 0 {
                    return Err(E::custom("pane height must be non-negative"));
                }
                self.visit_u64(v as u64)
            }
        }

        deserializer.deserialize_any(PaneHeightVisitor)
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LayerSpec {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    pub visual: LayerVisual,
    pub ports: BTreeMap<String, String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub style: Option<LayerStyle>,
    #[serde(default = "default_visible")]
    pub visible: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value_range: Option<ValueRange>,
}

fn default_visible() -> bool {
    true
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LayerVisual {
    Candlestick,
    Bar,
    Histogram,
    Line,
    Area,
    Markers,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LayerStyle {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(
        default,
        rename = "lineWidth",
        skip_serializing_if = "Option::is_none"
    )]
    pub line_width: Option<u8>,
    #[serde(
        default,
        rename = "markerShape",
        skip_serializing_if = "Option::is_none"
    )]
    pub marker_shape: Option<MarkerShape>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MarkerShape {
    ArrowUp,
    ArrowDown,
    Circle,
    Square,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pane_height_serde_flex_and_fixed() {
        assert_eq!(
            serde_json::to_string(&PaneHeight::Flex).unwrap(),
            "\"flex\""
        );
        assert_eq!(
            serde_json::to_string(&PaneHeight::Fixed(144)).unwrap(),
            "144"
        );
        assert_eq!(
            serde_json::from_str::<PaneHeight>("\"flex\"").unwrap(),
            PaneHeight::Flex
        );
        assert_eq!(
            serde_json::from_str::<PaneHeight>("144").unwrap(),
            PaneHeight::Fixed(144)
        );
    }

    #[test]
    fn layer_style_uses_fe_field_names() {
        let style = LayerStyle {
            color: Some("#22c55e".into()),
            line_width: Some(2),
            marker_shape: Some(MarkerShape::ArrowUp),
        };
        let json = serde_json::to_value(&style).unwrap();
        assert_eq!(json["lineWidth"], 2);
        assert_eq!(json["markerShape"], "arrowUp");
        assert_eq!(json["color"], "#22c55e");
    }
}
