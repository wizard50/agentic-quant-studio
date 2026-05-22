use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Polars error: {0}")]
    Polars(#[from] polars::error::PolarsError),

    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("API client error: {0}")]
    ApiClient(#[from] api_client::Error),

    #[error("task join error: {0}")]
    Join(#[from] tokio::task::JoinError),

    #[error("glob pattern contains invalid unicode characters")]
    InvalidGlob,

    #[error("column '{name}' contains {count} null value(s)")]
    NullValues { name: String, count: u32 },

    #[error("no earliest candle found for {0}")]
    NoEarliestCandle(String),
}

pub type Result<T> = std::result::Result<T, Error>;
