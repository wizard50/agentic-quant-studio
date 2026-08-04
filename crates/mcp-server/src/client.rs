//! HTTP client for the Agentic Quant Studio backend.

use anyhow::{Context, Result, anyhow};
use reqwest::Client;
use serde_json::Value;

/// Default backend base URL (no trailing slash).
pub const DEFAULT_BACKEND_URL: &str = "http://127.0.0.1:3000";

#[derive(Clone, Debug)]
pub struct BackendClient {
    http: Client,
    base_url: String,
}

impl BackendClient {
    pub fn new(base_url: impl Into<String>) -> Self {
        let base_url = base_url.into().trim_end_matches('/').to_string();
        Self {
            http: Client::new(),
            base_url,
        }
    }

    /// Build from `AQS_BACKEND_URL` or [`DEFAULT_BACKEND_URL`].
    pub fn from_env() -> Self {
        let base = std::env::var("AQS_BACKEND_URL")
            .unwrap_or_else(|_| DEFAULT_BACKEND_URL.to_string());
        Self::new(base)
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    pub fn indicators_url(&self) -> String {
        format!("{}/api/v1/catalog/indicators", self.base_url)
    }

    pub fn candles_catalog_url(&self) -> String {
        format!("{}/api/v1/catalog/candles", self.base_url)
    }

    pub fn validate_url(&self) -> String {
        format!("{}/api/v1/studio/validate", self.base_url)
    }

    pub fn studies_url(&self) -> String {
        format!("{}/api/v1/studies", self.base_url)
    }

    pub fn study_url(&self, id: &str) -> String {
        format!("{}/api/v1/studies/{}", self.base_url, id)
    }

    pub fn studies_list_url(&self, status: Option<&str>) -> String {
        match status {
            Some(s) if !s.is_empty() => {
                format!("{}/api/v1/studies?status={}", self.base_url, s)
            }
            _ => self.studies_url(),
        }
    }

    pub async fn get_json(&self, url: &str) -> Result<Value> {
        let res = self
            .http
            .get(url)
            .send()
            .await
            .with_context(|| format!("GET {url}"))?;
        Self::json_or_error("GET", url, res).await
    }

    pub async fn post_json(&self, url: &str, body: &Value) -> Result<Value> {
        let res = self
            .http
            .post(url)
            .json(body)
            .send()
            .await
            .with_context(|| format!("POST {url}"))?;
        Self::json_or_error("POST", url, res).await
    }

    async fn json_or_error(
        method: &str,
        url: &str,
        res: reqwest::Response,
    ) -> Result<Value> {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(anyhow!(
                "{method} {url} failed: {status} — {text}"
            ));
        }
        if text.is_empty() {
            return Ok(Value::Null);
        }
        serde_json::from_str(&text)
            .with_context(|| format!("parse JSON from {method} {url}: {text}"))
    }

    /// Force `created_by: "agent"` on create-study bodies.
    pub fn create_study_body(graph: Value, title: Option<String>) -> Value {
        let mut map = serde_json::Map::new();
        map.insert("graph".into(), graph);
        map.insert("created_by".into(), Value::String("agent".into()));
        if let Some(title) = title {
            map.insert("title".into(), Value::String(title));
        }
        Value::Object(map)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn urls_strip_trailing_slash() {
        let c = BackendClient::new("http://127.0.0.1:3000/");
        assert_eq!(c.base_url(), "http://127.0.0.1:3000");
        assert_eq!(
            c.indicators_url(),
            "http://127.0.0.1:3000/api/v1/catalog/indicators"
        );
        assert_eq!(
            c.study_url("abc"),
            "http://127.0.0.1:3000/api/v1/studies/abc"
        );
        assert_eq!(
            c.studies_list_url(Some("draft")),
            "http://127.0.0.1:3000/api/v1/studies?status=draft"
        );
    }

    #[test]
    fn create_study_body_forces_agent() {
        let body = BackendClient::create_study_body(
            serde_json::json!({"id": "g", "version": 1, "kind": "chart", "nodes": [], "edges": []}),
            Some("demo".into()),
        );
        assert_eq!(body["created_by"], "agent");
        assert_eq!(body["title"], "demo");
        assert!(body["graph"].is_object());
    }
}
