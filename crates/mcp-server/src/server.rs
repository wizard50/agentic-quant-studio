//! MCP tool handlers for Agentic Quant Studio.

use rmcp::{
    ErrorData as McpError, ServerHandler,
    handler::server::{router::tool::ToolRouter, wrapper::Parameters},
    model::{ServerCapabilities, ServerInfo},
    schemars::JsonSchema,
    tool, tool_handler, tool_router,
};
use serde::Deserialize;
use serde_json::Value;

use crate::client::BackendClient;

/// Static kinds registered in the studio runtime but not always in GET /catalog/indicators.
const OTHER_NODE_KINDS: &[&str] = &[
    "datasource.candles",
    "literal.number",
    "literal.bool",
    "logic.crossover",
    "logic.crossunder",
    "logic.gt",
    "logic.lt",
    "logic.and",
    "logic.or",
];

#[derive(Clone)]
pub struct AqsMcpServer {
    client: BackendClient,
    tool_router: ToolRouter<Self>,
}

impl AqsMcpServer {
    pub fn new(client: BackendClient) -> Self {
        Self {
            client,
            tool_router: Self::tool_router(),
        }
    }
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct ValidateGraphArgs {
    /// GraphSpec JSON object (id, version, kind, nodes, edges).
    pub graph: Value,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct CreateStudyArgs {
    /// GraphSpec JSON object to store as a draft.
    pub graph: Value,
    /// Optional human-readable title for the draft.
    #[serde(default)]
    pub title: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct ListStudiesArgs {
    /// Optional status filter, e.g. `draft`, `applied`, or `draft,applied`.
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct GetStudyArgs {
    /// Study id returned by create_study or list_studies.
    pub id: String,
}

fn tool_err(err: impl std::fmt::Display) -> McpError {
    McpError::internal_error(err.to_string(), None)
}

fn json_text(value: &Value) -> String {
    serde_json::to_string_pretty(value).unwrap_or_else(|_| value.to_string())
}

#[tool_router]
impl AqsMcpServer {
    /// List indicator kinds from the backend catalog (params, ports, chart_defaults).
    #[tool(
        name = "list_indicators",
        description = "List indicator node kinds from GET /catalog/indicators (params, ports, chart_defaults)."
    )]
    async fn list_indicators(&self) -> Result<String, McpError> {
        let value = self
            .client
            .get_json(&self.client.indicators_url())
            .await
            .map_err(tool_err)?;
        Ok(json_text(&value))
    }

    /// List available candle datasets from the warehouse catalog.
    #[tool(
        name = "list_candle_datasets",
        description = "List available candle datasets from GET /catalog/candles (exchange, category, symbol, interval)."
    )]
    async fn list_candle_datasets(&self) -> Result<String, McpError> {
        let value = self
            .client
            .get_json(&self.client.candles_catalog_url())
            .await
            .map_err(tool_err)?;
        Ok(json_text(&value))
    }

    /// List node kinds: indicators from catalog plus built-in datasource/logic/literal kinds.
    #[tool(
        name = "list_node_kinds",
        description = "List discoverable node kinds: indicator catalog plus datasource, logic, and literal builtins."
    )]
    async fn list_node_kinds(&self) -> Result<String, McpError> {
        let indicators = self
            .client
            .get_json(&self.client.indicators_url())
            .await
            .map_err(tool_err)?;
        let body = serde_json::json!({
            "indicators": indicators,
            "other_kinds": OTHER_NODE_KINDS,
            "note": "Port refs use node_id.port_name; node ids must not contain '.'."
        });
        Ok(json_text(&body))
    }

    /// Validate a GraphSpec without persisting (POST /studio/validate).
    #[tool(
        name = "validate_graph",
        description = "Validate a GraphSpec without saving (POST /studio/validate). Returns ok or a validation error."
    )]
    async fn validate_graph(
        &self,
        Parameters(args): Parameters<ValidateGraphArgs>,
    ) -> Result<String, McpError> {
        let body = serde_json::json!({ "graph": args.graph });
        let value = self
            .client
            .post_json(&self.client.validate_url(), &body)
            .await
            .map_err(tool_err)?;
        Ok(json_text(&value))
    }

    /// Create a study draft on the backend (POST /studies). Always sets created_by=agent.
    #[tool(
        name = "create_study",
        description = "Create a draft study (POST /studies) with created_by=agent. User accepts in the Market Research UI."
    )]
    async fn create_study(
        &self,
        Parameters(args): Parameters<CreateStudyArgs>,
    ) -> Result<String, McpError> {
        let body = BackendClient::create_study_body(args.graph, args.title);
        let value = self
            .client
            .post_json(&self.client.studies_url(), &body)
            .await
            .map_err(tool_err)?;
        Ok(json_text(&value))
    }

    /// List studies (drafts and applied by default).
    #[tool(
        name = "list_studies",
        description = "List studies from GET /studies. Optional status filter: draft, applied, archived, or comma-separated."
    )]
    async fn list_studies(
        &self,
        Parameters(args): Parameters<ListStudiesArgs>,
    ) -> Result<String, McpError> {
        let url = self.client.studies_list_url(args.status.as_deref());
        let value = self.client.get_json(&url).await.map_err(tool_err)?;
        Ok(json_text(&value))
    }

    /// Get one study by id including its GraphSpec.
    #[tool(
        name = "get_study",
        description = "Get a single study by id (GET /studies/{id}), including graph."
    )]
    async fn get_study(
        &self,
        Parameters(args): Parameters<GetStudyArgs>,
    ) -> Result<String, McpError> {
        let value = self
            .client
            .get_json(&self.client.study_url(&args.id))
            .await
            .map_err(tool_err)?;
        Ok(json_text(&value))
    }
}

#[tool_handler(router = self.tool_router)]
impl ServerHandler for AqsMcpServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(ServerCapabilities::builder().enable_tools().build())
            .with_instructions(
                "Agentic Quant Studio MCP: discover node kinds and candle datasets, \
                 validate GraphSpec, create draft studies, list/get studies. \
                 Backend must be running (AQS_BACKEND_URL, default http://127.0.0.1:3000). \
                 Always create drafts only; the user accepts in the Market Research UI. \
                 Port refs use node_id.port_name; node ids must not contain dots.",
            )
    }
}
