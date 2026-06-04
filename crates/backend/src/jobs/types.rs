use chrono::{DateTime, Utc};
use common::types::{Exchange, MarketCategory};
use serde::{Deserialize, Serialize};
use std::fmt;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload", rename_all = "snake_case")]
pub enum Job {
    IngestCandles(IngestCandlesPayload),
}

impl Job {
    pub fn kind(&self) -> &'static str {
        match self {
            Job::IngestCandles(_) => "ingest_candles",
        }
    }

    pub fn signature(&self) -> String {
        match self {
            Job::IngestCandles(payload) => {
                format!("{}:{}", self.kind(), payload.signature())
            }
        }
    }
}

#[derive(Debug, Clone)]
pub struct JobRecord {
    pub id: Uuid,
    pub status: JobStatus,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub finished_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
    pub job: Job,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

impl fmt::Display for JobStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            JobStatus::Pending => "pending",
            JobStatus::Running => "running",
            JobStatus::Completed => "completed",
            JobStatus::Failed => "failed",
            JobStatus::Cancelled => "cancelled",
        };
        write!(f, "{}", s)
    }
}

// Payloads

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngestCandlesPayload {
    pub exchange: Exchange,
    pub category: MarketCategory,
    pub symbol: String,
}

impl IngestCandlesPayload {
    pub fn signature(&self) -> String {
        format!(
            "{}:{}:{}",
            self.exchange.as_str(),
            self.category.as_str(),
            self.symbol.to_uppercase()
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserialize_ingest_candles_snake_case() {
        let json = r#"{"type":"ingest_candles","payload":{"exchange":"bybit","category":"spot","symbol":"BTCUSDT"}}"#;
        let job: Job = serde_json::from_str(json).expect("should deserialize");
        match job {
            Job::IngestCandles(p) => {
                assert_eq!(p.exchange, Exchange::Bybit);
                assert_eq!(p.symbol, "BTCUSDT");
            }
        }
    }

    #[test]
    fn serialize_roundtrip_uses_snake_case() {
        let job = Job::IngestCandles(IngestCandlesPayload {
            exchange: Exchange::Bybit,
            category: MarketCategory::Spot,
            symbol: "ETHUSDT".to_string(),
        });
        let s = serde_json::to_string(&job).unwrap();
        assert!(s.contains(r#""type":"ingest_candles""#));
        assert!(s.contains(r#""payload":{"#));
        let back: Job = serde_json::from_str(&s).unwrap();
        assert!(matches!(back, Job::IngestCandles(_)));
    }
}
