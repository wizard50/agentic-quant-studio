mod api;
pub mod bybit;
pub mod utils;

pub use api::*;

use common::types::{Exchange, MarketCategory};

pub trait ExchangeExt {
    fn client(&self, category: MarketCategory) -> Box<dyn ExchangeApi + Send + Sync>;
    fn max_candles_per_request(&self) -> usize;
}

impl ExchangeExt for Exchange {
    fn client(&self, category: MarketCategory) -> Box<dyn ExchangeApi + Send + Sync> {
        match self {
            Exchange::Bybit => Box::new(bybit::BybitRestClient::with_base_url(
                bybit::BASE_URL.to_string(),
                category,
            )),
        }
    }

    fn max_candles_per_request(&self) -> usize {
        match self {
            Exchange::Bybit => bybit::MAX_CANDLE_LIMIT as usize,
        }
    }
}
