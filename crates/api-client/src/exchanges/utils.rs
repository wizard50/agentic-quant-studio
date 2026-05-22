use crate::error::{Error, Result};
use std::time::Duration;

pub async fn execute_with_retry<F, Fut, T>(call: F) -> Result<T>
where
    F: Fn() -> Fut,
    Fut: std::future::Future<Output = reqwest::Result<reqwest::Response>>,
    T: serde::de::DeserializeOwned,
{
    const MAX_ATTEMPTS: u32 = 5;
    let mut attempt = 0;

    loop {
        let resp = call().await?;

        if resp.status() == 429 {
            attempt += 1;
            if attempt >= MAX_ATTEMPTS {
                return Err(Error::RateLimitExceeded {
                    attempts: MAX_ATTEMPTS,
                });
            }

            // Prefer Retry-After header, otherwise exponential backoff
            let delay_ms = if let Some(retry_after) = resp.headers().get("retry-after") {
                retry_after
                    .to_str()
                    .unwrap_or("1")
                    .parse::<u64>()
                    .unwrap_or(1)
                    * 1000
            } else {
                2u64.pow(attempt) * 1000 // 2s, 4s, 8s …
            };

            // Small jitter
            let jitter = rand::random::<u64>() % 300;
            tokio::time::sleep(Duration::from_millis(delay_ms + jitter)).await;
            continue;
        }

        // Success or non-rate-limit error
        return match resp.error_for_status() {
            Ok(response) => Ok(response.json::<T>().await?),
            Err(http_err) => Err(Error::Http(http_err)),
        };
    }
}
