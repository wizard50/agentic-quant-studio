use std::fmt;
use std::str::FromStr;

#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[cfg_attr(feature = "serde", serde(rename_all = "lowercase"))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Exchange {
    Bybit,
}

impl Exchange {
    pub fn as_str(&self) -> &'static str {
        match self {
            Exchange::Bybit => "bybit",
        }
    }
}

impl fmt::Display for Exchange {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for Exchange {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let s = s.trim().to_lowercase();
        match s.as_str() {
            "bybit" => Ok(Exchange::Bybit),
            other => Err(format!("Unknown exchange: {}", other)),
        }
    }
}

#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[derive(Debug, Clone, Copy)]
pub struct Candle {
    pub timestamp: i64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[cfg_attr(feature = "serde", serde(into = "String", try_from = "String"))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Interval {
    Second(u32),
    Minute(u32),
    Hour(u32),
    Day(u32),
    Week(u32),
    Month(u32),
    Year(u32),
}

impl Interval {
    pub fn to_string(&self) -> String {
        match self {
            Interval::Second(n) => format!("{}s", n),
            Interval::Minute(n) => format!("{}m", n),
            Interval::Hour(n) => format!("{}h", n),
            Interval::Day(n) => format!("{}d", n),
            Interval::Week(n) => format!("{}w", n),
            Interval::Month(n) => format!("{}M", n),
            Interval::Year(n) => format!("{}y", n),
        }
    }
}

impl fmt::Display for Interval {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.to_string())
    }
}

impl FromStr for Interval {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let s = s.trim();

        if s.is_empty() {
            return Err("Empty interval string".to_string());
        }

        // Try to split number and unit
        let (num_str, unit) = if let Some(pos) = s.find(|c: char| !c.is_ascii_digit()) {
            (&s[..pos], &s[pos..])
        } else {
            return Err(format!("Invalid interval format (no unit): {}", s));
        };

        let n: u32 = num_str
            .parse()
            .map_err(|_| format!("Invalid number in interval: {}", num_str))?;

        if n == 0 {
            return Err("Interval value cannot be zero".to_string());
        }

        match unit.to_lowercase().as_str() {
            "s" | "sec" | "second" | "seconds" => Ok(Interval::Second(n)),
            "m" | "min" | "minute" | "minutes" => Ok(Interval::Minute(n)),
            "h" | "hr" | "hour" | "hours" => Ok(Interval::Hour(n)),
            "d" | "day" | "days" => Ok(Interval::Day(n)),
            "w" | "wk" | "week" | "weeks" => Ok(Interval::Week(n)),
            "mo" | "M" | "month" | "months" => Ok(Interval::Month(n)),
            "y" | "yr" | "year" | "years" => Ok(Interval::Year(n)),
            _ => Err(format!("Unknown interval unit: {}", unit)),
        }
    }
}

#[cfg(feature = "serde")]
impl From<Interval> for String {
    fn from(value: Interval) -> String {
        value.to_string()
    }
}

#[cfg(feature = "serde")]
impl TryFrom<String> for Interval {
    type Error = String;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        Interval::from_str(&value)
    }
}

#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[cfg_attr(feature = "serde", serde(into = "String", try_from = "String"))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum MarketCategory {
    Spot,
    Perpetual(Settlement),
    Futures(Settlement),
    Option,
}

impl MarketCategory {
    pub fn is_linear(&self) -> bool {
        matches!(
            self,
            Self::Perpetual(Settlement::Linear) | Self::Futures(Settlement::Linear)
        )
    }

    pub fn is_inverse(&self) -> bool {
        matches!(
            self,
            Self::Perpetual(Settlement::Inverse) | Self::Futures(Settlement::Inverse)
        )
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            MarketCategory::Spot => "spot",
            MarketCategory::Perpetual(Settlement::Linear) => "perpetual_linear",
            MarketCategory::Perpetual(Settlement::Inverse) => "perpetual_inverse",
            MarketCategory::Futures(Settlement::Linear) => "futures_linear",
            MarketCategory::Futures(Settlement::Inverse) => "futures_inverse",
            MarketCategory::Option => "option",
        }
    }
}

impl fmt::Display for MarketCategory {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for MarketCategory {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "spot" => Ok(MarketCategory::Spot),
            "perpetual_linear" => Ok(MarketCategory::Perpetual(Settlement::Linear)),
            "perpetual_inverse" => Ok(MarketCategory::Perpetual(Settlement::Inverse)),
            "futures_linear" => Ok(MarketCategory::Futures(Settlement::Linear)),
            "futures_inverse" => Ok(MarketCategory::Futures(Settlement::Inverse)),
            "option" => Ok(MarketCategory::Option),
            other => Err(format!("Unknown MarketCategory: {}", other)),
        }
    }
}

#[cfg(feature = "serde")]
impl From<MarketCategory> for String {
    fn from(value: MarketCategory) -> String {
        value.as_str().to_string()
    }
}

#[cfg(feature = "serde")]
impl TryFrom<String> for MarketCategory {
    type Error = String;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        MarketCategory::from_str(&value)
    }
}

#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Settlement {
    Linear,
    Inverse,
}
