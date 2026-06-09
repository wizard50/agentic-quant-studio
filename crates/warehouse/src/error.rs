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

    #[error("catalog error: {0}")]
    Catalog(String),

    #[error("failed to read or write catalog.json: {0}")]
    CatalogPersistence(String),

    #[error("candle dataset not found")]
    DatasetNotFound,

    #[error("invalid candle query: {0}")]
    InvalidCandleQuery(String),
}

pub type Result<T> = std::result::Result<T, Error>;
