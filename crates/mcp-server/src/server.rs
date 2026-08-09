//! MCP tools, prompts, and resources for Agentic Quant Studio.

use rmcp::{
    ErrorData as McpError, RoleServer, ServerHandler,
    handler::server::{
        router::{prompt::PromptRouter, tool::ToolRouter},
        wrapper::Parameters,
    },
    model::{
        GetPromptResult, ListResourceTemplatesResult, ListResourcesResult, PaginatedRequestParams,
        PromptMessage, ReadResourceRequestParams, ReadResourceResponse, Role, ServerCapabilities,
        ServerInfo,
    },
    prompt, prompt_handler, prompt_router,
    service::RequestContext,
    tool, tool_handler, tool_router,
};
use schemars::JsonSchema;
use serde::Deserialize;
use serde_json::Value;

use crate::client::BackendClient;
use crate::resources;

const SERVER_INSTRUCTIONS: &str = "\
Agentic Quant Studio MCP — GraphSpec drafts for Market Research.\n\
\n\
Policy:\n\
- Create drafts only (create_study sets created_by=agent). User accepts in the UI.\n\
- Port refs: node_id.port_name. Node ids must not contain dots.\n\
- Author GraphSpec only; presentation is server-derived.\n\
- Backend must be running (AQS_BACKEND_URL, default http://127.0.0.1:3000).\n\
\n\
Start by reading resource aqs://docs/overview (and aqs://docs/graph-spec / examples as needed).\n\
Use aqs://schema/node-kinds or aqs://schema/kinds/{kind} for ports/params.\n\
Live tools: list_candle_datasets, list_indicators, list_node_kinds, validate_graph, \
create_study, list_studies, get_study.\n\
Workflow: discover → build graph → validate_graph → create_study with title.\n\
User-started recipes: prompts create_chart_study, create_golden_cross, revise_draft_study.\n\
";

#[derive(Clone)]
pub struct AqsMcpServer {
    client: BackendClient,
    tool_router: ToolRouter<Self>,
    prompt_router: PromptRouter<Self>,
}

impl AqsMcpServer {
    pub fn new(client: BackendClient) -> Self {
        Self {
            client,
            tool_router: Self::tool_router(),
            prompt_router: Self::prompt_router(),
        }
    }
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

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
        description = "List indicator node kinds from GET /catalog/indicators (params, ports, chart_defaults). For logic/literal/datasource ports, prefer resource aqs://schema/node-kinds or tool list_node_kinds."
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
        description = "List available candle datasets from GET /catalog/candles (exchange, category, symbol, interval). Use these params on datasource.candles."
    )]
    async fn list_candle_datasets(&self) -> Result<String, McpError> {
        let value = self
            .client
            .get_json(&self.client.candles_catalog_url())
            .await
            .map_err(tool_err)?;
        Ok(json_text(&value))
    }

    /// List all node kinds with ports/params (studio registry; includes logic/literal/datasource).
    #[tool(
        name = "list_node_kinds",
        description = "List all registered node kinds with category, inputs, outputs, and params (from studio registry). Same data as resource aqs://schema/node-kinds. Prefer this over inventing port names for logic.* / literal.*."
    )]
    async fn list_node_kinds(&self) -> Result<String, McpError> {
        let body = serde_json::json!({
            "kinds": resources::node_kinds_value()["kinds"],
            "note": "Port refs use node_id.port_name; node ids must not contain '.'. Also available as resource aqs://schema/node-kinds or aqs://schema/kinds/{kind}."
        });
        Ok(json_text(&body))
    }

    /// Validate a GraphSpec without persisting (POST /studio/validate).
    #[tool(
        name = "validate_graph",
        description = "Validate a GraphSpec without saving (POST /studio/validate). Always call before create_study. Returns ok or a validation error."
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
        description = "Create a draft study (POST /studies) with created_by=agent. User accepts in the Market Research UI. Prefer validate_graph first. See aqs://docs/overview."
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
        description = "Get a single study by id (GET /studies/{id}), including graph and presentation."
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

// ---------------------------------------------------------------------------
// Prompts (user-started workflows)
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize, JsonSchema)]
pub struct CreateChartStudyPromptArgs {
    /// Exchange id, e.g. bybit (must exist in candle catalog).
    pub exchange: String,
    /// Market category, e.g. spot.
    pub category: String,
    /// Symbol, e.g. BTCUSDT.
    pub symbol: String,
    /// Interval, e.g. 1d or 1h.
    pub interval: String,
    /// Optional study title.
    #[serde(default)]
    pub title: Option<String>,
    /// Optional style hint: sma | golden_cross | rsi_reclaim (default sma).
    #[serde(default)]
    pub style: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct CreateGoldenCrossPromptArgs {
    pub exchange: String,
    pub category: String,
    pub symbol: String,
    pub interval: String,
    #[serde(default)]
    pub title: Option<String>,
}

#[derive(Debug, Deserialize, JsonSchema)]
pub struct ReviseDraftStudyPromptArgs {
    /// Existing study id (from list_studies / get_study).
    pub study_id: String,
    /// What to change (natural language for the model).
    pub change_request: String,
}

fn market_into_graph(mut graph: Value, args: &CreateChartStudyPromptArgs) -> Value {
    if let Some(nodes) = graph.get_mut("nodes").and_then(|n| n.as_array_mut()) {
        for node in nodes {
            if node.get("kind").and_then(|k| k.as_str()) == Some("datasource.candles") {
                if let Some(params) = node.get_mut("params").and_then(|p| p.as_object_mut()) {
                    params.insert("exchange".into(), Value::String(args.exchange.clone()));
                    params.insert("category".into(), Value::String(args.category.clone()));
                    params.insert("symbol".into(), Value::String(args.symbol.clone()));
                    params.insert("interval".into(), Value::String(args.interval.clone()));
                }
            }
        }
    }
    graph
}

fn style_template(style: Option<&str>) -> (&'static str, Option<Value>, &'static str) {
    match style.map(|s| s.to_ascii_lowercase()).as_deref() {
        Some("golden_cross") | Some("golden-cross") => (
            "golden cross (dual SMA + crossover)",
            resources::example_golden_cross_json(),
            "aqs://docs/examples/golden-cross",
        ),
        Some("rsi_reclaim") | Some("rsi-reclaim") => (
            "RSI reclaim (RSI + level + crossover)",
            resources::example_rsi_reclaim_json(),
            "aqs://docs/examples/rsi-reclaim",
        ),
        _ => (
            "SMA overlay",
            resources::example_sma_json(),
            "aqs://docs/examples/sma-overlay",
        ),
    }
}

#[prompt_router]
impl AqsMcpServer {
    /// User recipe: create a chart study draft for a market.
    #[prompt(
        name = "create_chart_study",
        description = "Workflow: build and create a draft chart study for a market (SMA / golden_cross / rsi_reclaim)."
    )]
    async fn create_chart_study(
        &self,
        Parameters(args): Parameters<CreateChartStudyPromptArgs>,
    ) -> GetPromptResult {
        let (style_label, template, example_uri) = style_template(args.style.as_deref());
        let title = args.title.clone().unwrap_or_else(|| {
            format!(
                "{} {} {} {}",
                args.symbol, args.interval, style_label, "draft"
            )
        });
        let graph_step = match template {
            Some(template) => {
                let graph = market_into_graph(template, &args);
                let graph_pretty =
                    serde_json::to_string_pretty(&graph).unwrap_or_else(|_| graph.to_string());
                format!(
                    "2. Use this GraphSpec as a starting point (adjust if catalog differs):\n\
                     ```json\n{graph_pretty}\n```"
                )
            }
            None => format!(
                "2. Read resource `{example_uri}` for a GraphSpec template, then set \
                 datasource.candles params to this market."
            ),
        };

        GetPromptResult::new(vec![
            PromptMessage::new_text(
                Role::User,
                format!(
                    "Create an Agentic Quant Studio **draft study** ({style_label}) for \
                     {exchange}/{category}/{symbol}/{interval}.\n\n\
                     Follow MCP policy in resource aqs://docs/overview.\n\
                     1. Optionally list_candle_datasets to confirm the market exists.\n\
                     {graph_step}\n\
                     3. validate_graph\n\
                     4. create_study with title: {title:?}\n\
                     5. Do NOT accept/apply. Tell me the study id and that I should Reload + Accept in Market Research UI.",
                    exchange = args.exchange,
                    category = args.category,
                    symbol = args.symbol,
                    interval = args.interval,
                ),
            ),
            PromptMessage::new_text(
                Role::Assistant,
                "I'll validate the GraphSpec against the live backend, create a draft study with created_by=agent, and leave Accept to you in the UI.",
            ),
        ])
        .with_description("Create a draft chart study for a market")
    }

    /// User recipe: golden cross draft.
    #[prompt(
        name = "create_golden_cross",
        description = "Workflow: dual SMA + logic.crossover draft study for a market."
    )]
    async fn create_golden_cross(
        &self,
        Parameters(args): Parameters<CreateGoldenCrossPromptArgs>,
    ) -> GetPromptResult {
        let chart_args = CreateChartStudyPromptArgs {
            exchange: args.exchange,
            category: args.category,
            symbol: args.symbol,
            interval: args.interval,
            title: args.title,
            style: Some("golden_cross".into()),
        };
        self.create_chart_study(Parameters(chart_args)).await
    }

    /// User recipe: revise a draft (get → edit → create new draft; no update_study tool yet).
    #[prompt(
        name = "revise_draft_study",
        description = "Workflow: load an existing study graph, apply a change, validate, create a new draft (MCP has no update_study yet)."
    )]
    async fn revise_draft_study(
        &self,
        Parameters(args): Parameters<ReviseDraftStudyPromptArgs>,
    ) -> GetPromptResult {
        GetPromptResult::new(vec![
            PromptMessage::new_text(
                Role::User,
                format!(
                    "Revise Agentic Quant Studio study `{id}`.\n\
                     Change request: {change}\n\n\
                     Steps:\n\
                     1. get_study with id={id:?}\n\
                     2. Read aqs://docs/graph-spec / aqs://schema/node-kinds if you need ports\n\
                     3. Produce an updated GraphSpec (preserve market unless asked to change it)\n\
                     4. validate_graph\n\
                     5. create_study with a new title that mentions the revision (there is no update_study MCP tool yet — creating a new draft is intentional)\n\
                     6. Do not accept/apply. Report old id, new id, and summary of changes.",
                    id = args.study_id,
                    change = args.change_request,
                ),
            ),
            PromptMessage::new_text(
                Role::Assistant,
                "I'll load the study, apply your change to the GraphSpec, validate, and create a new draft (no in-place update tool yet).",
            ),
        ])
        .with_description("Revise a study by creating a new draft")
    }
}

// ---------------------------------------------------------------------------
// ServerHandler: tools + prompts + resources
// ---------------------------------------------------------------------------

#[tool_handler(router = self.tool_router)]
#[prompt_handler(router = self.prompt_router)]
impl ServerHandler for AqsMcpServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(
            ServerCapabilities::builder()
                .enable_tools()
                .enable_prompts()
                .enable_resources()
                .build(),
        )
        .with_server_info(rmcp::model::Implementation::new(
            "agentic-quant-studio",
            env!("CARGO_PKG_VERSION"),
        ))
        .with_instructions(SERVER_INSTRUCTIONS.to_string())
    }

    async fn list_resources(
        &self,
        _request: Option<PaginatedRequestParams>,
        _context: RequestContext<RoleServer>,
    ) -> Result<ListResourcesResult, McpError> {
        Ok(resources::list_static_resources())
    }

    async fn list_resource_templates(
        &self,
        _request: Option<PaginatedRequestParams>,
        _context: RequestContext<RoleServer>,
    ) -> Result<ListResourceTemplatesResult, McpError> {
        Ok(resources::list_templates())
    }

    async fn read_resource(
        &self,
        request: ReadResourceRequestParams,
        _context: RequestContext<RoleServer>,
    ) -> Result<ReadResourceResponse, McpError> {
        match resources::read_uri(&request.uri) {
            Some(result) => Ok(result.into()),
            None => Err(McpError::resource_not_found(
                format!("Resource not found: {}", request.uri),
                Some(serde_json::json!({ "uri": request.uri })),
            )),
        }
    }
}
