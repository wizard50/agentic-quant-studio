use common::types::Interval;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Bybit API error {code}: {message}")]
    BybitApi { code: i32, message: String },

    #[error("invalid candle interval: {0:?}")]
    InvalidInterval(Interval),

    #[error("rate limit exceeded after {attempts} attempts")]
    RateLimitExceeded { attempts: u32 },

    #[error("failed to parse integer: {0}")]
    ParseInt(#[from] std::num::ParseIntError),

    #[error("failed to parse float: {0}")]
    ParseFloat(#[from] std::num::ParseFloatError),
}

pub type Result<T> = std::result::Result<T, Error>;
