use super::api::{CandlesRequest, ExchangeApi};
use crate::error::{Error, Result};
use crate::exchanges::utils::execute_with_retry;
use async_trait::async_trait;
use common::types::{Candle, Interval, MarketCategory};
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use serde_json::Value;

pub const BASE_URL: &str = "https://api.bybit.com";
pub const MAX_CANDLE_LIMIT: u32 = 1000;

pub struct BybitRestClient {
    base_url: String,
    client: reqwest::Client,
    category: MarketCategory,
}

impl BybitRestClient {
    pub fn new() -> Self {
        Self::with_base_url(BASE_URL.into(), MarketCategory::Spot)
    }

    pub fn with_base_url(base_url: String, category: MarketCategory) -> Self {
        BybitRestClient {
            base_url,
            client: reqwest::Client::new(),
            category,
        }
    }

    fn category_str(&self) -> &'static str {
        match self.category {
            MarketCategory::Spot => "spot",
            MarketCategory::Option => "option",
            cat if cat.is_linear() => "linear",
            cat if cat.is_inverse() => "inverse",
            _ => "linear",
        }
    }

    async fn get_json<T: DeserializeOwned>(
        &self,
        path: &str,
        params: Option<&impl serde::Serialize>,
    ) -> Result<T> {
        execute_with_retry(|| {
            let mut req = self.client.get(format!(
                "{}/{}",
                self.base_url,
                path.trim_start_matches('/')
            ));
            if let Some(p) = params {
                req = req.query(p);
            }
            req.send()
        })
        .await
    }
}

#[async_trait]
impl ExchangeApi for BybitRestClient {
    async fn get_candles(&self, request: CandlesRequest) -> Result<Vec<Candle>> {
        let params = KlineParams {
            category: Some(self.category_str().to_string()),
            symbol: request.symbol,
            interval: interval_to_bybit(request.interval)?,
            start: request.start_time,
            end: request.end_time,
            limit: request.limit,
        };

        let bybit_response: BybitResponse = self.get_json("v5/market/kline", Some(&params)).await?;

        bybit_response
            .into_result::<KlineResponse>()?
            .into_candles()
    }
}

// Request types

#[derive(Debug, Serialize)]
pub struct KlineParams {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>, // Product type: spot, linear, inverse (linear by default)
    pub symbol: String,   // Symbol name, like BTCUSDT, uppercase only
    pub interval: String, // Kline interval: 1,3,5,15,30,60,120,240,360,720,D,W,M
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start: Option<i64>, // The start timestamp (ms)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end: Option<i64>, // The end timestamp (ms)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<u32>, // Limit for data size per page. [1, 1000]. Default: 200
}

fn interval_to_bybit(interval: Interval) -> Result<String> {
    Ok(match interval {
        Interval::Minute(n) if [1, 3, 5, 15, 30].contains(&n) => n.to_string(),
        Interval::Hour(n) if [1, 2, 4, 6, 12].contains(&n) => (n * 60).to_string(), // 1h → "60", 2h → "120", etc.
        Interval::Day(_) => "D".to_string(),
        Interval::Week(_) => "W".to_string(),
        Interval::Month(_) => "M".to_string(),
        _ => return Err(Error::InvalidInterval(interval)),
    })
}

// Response types

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BybitResponse {
    pub ret_code: i32,
    pub ret_msg: String,
    pub result: Value,

    _ret_ext_info: Value,
    _time: i64,
}

impl BybitResponse {
    pub fn into_result<T: serde::de::DeserializeOwned>(self) -> Result<T> {
        if self.ret_code == 0 {
            Ok(serde_json::from_value(self.result)?)
        } else {
            Err(Error::BybitApi {
                code: self.ret_code,
                message: self.ret_msg,
            })
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct KlineResponse {
    pub symbol: String,
    pub category: Option<String>,
    pub list: Vec<[String; 7]>,
}

impl KlineResponse {
    pub fn into_candles(self) -> Result<Vec<Candle>> {
        self.list
            .into_iter()
            .map(BybitKline::try_from)
            .map(|res| res.map(Candle::from))
            .collect()
    }
}

// Domain model

#[derive(Debug, Copy, Clone)]
pub(crate) struct BybitKline {
    pub timestamp: i64,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
    #[allow(dead_code)]
    pub turnover: f64,
}

impl TryFrom<[String; 7]> for BybitKline {
    type Error = Error;

    fn try_from(arr: [String; 7]) -> std::result::Result<Self, Self::Error> {
        let [ts, open, high, low, close, volume, turnover] = arr;

        Ok(BybitKline {
            timestamp: ts.parse()?,
            open: open.parse()?,
            high: high.parse()?,
            low: low.parse()?,
            close: close.parse()?,
            volume: volume.parse()?,
            turnover: turnover.parse()?,
        })
    }
}

impl From<BybitKline> for Candle {
    fn from(kline: BybitKline) -> Candle {
        Candle {
            timestamp: kline.timestamp,
            open: kline.open,
            high: kline.high,
            low: kline.low,
            close: kline.close,
            volume: kline.volume,
        }
    }
}

// Tests

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_bybit_get_candles() -> Result<()> {
        let client = BybitRestClient::new();

        let candles: Vec<Candle> = client
            .get_candles(CandlesRequest {
                symbol: "BTCUSDT".into(),
                interval: Interval::Minute(1),
                start_time: None,
                end_time: None,
                limit: Some(3),
            })
            .await?;

        println!("{candles:#?}");
        assert_eq!(candles.len(), 3);

        Ok(())
    }
}
