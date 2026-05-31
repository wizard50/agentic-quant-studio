use chrono::{DateTime, Utc};
use common::types::{Exchange, Interval, MarketCategory};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct IngestCandlesJob {
    pub id: Uuid,
    pub exchange: Exchange,
    pub category: MarketCategory,
    pub symbol: String,
    pub interval: Interval,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
}

impl IngestCandlesJob {
    pub fn new(
        exchange: Exchange,
        category: MarketCategory,
        symbol: String,
        interval: Interval,
        start_time: Option<DateTime<Utc>>,
        end_time: Option<DateTime<Utc>>,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            exchange,
            category,
            symbol,
            interval,
            from: start_time,
            to: end_time,
        }
    }

    pub fn key(&self) -> JobKey {
        (
            self.exchange.clone(),
            self.category.clone(),
            self.symbol.clone(),
            self.interval.clone(),
            self.from,
            self.to,
        )
    }
}

pub type JobKey = (
    Exchange,
    MarketCategory,
    String,
    Interval,
    Option<DateTime<Utc>>,
    Option<DateTime<Utc>>,
);

#[derive(Clone, Debug)]
pub struct JobStatus {
    pub key: JobKey,
    pub status: Status,
    pub created_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
}

#[derive(Clone, Debug)]
pub enum Status {
    Pending,
    Running,
    Completed,
    Failed,
}

impl Status {
    /// Returns the canonical lowercase string representation used in the API.
    pub fn as_str(&self) -> &'static str {
        match self {
            Status::Pending => "pending",
            Status::Running => "running",
            Status::Completed => "completed",
            Status::Failed => "failed",
        }
    }
}

impl std::fmt::Display for Status {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}
