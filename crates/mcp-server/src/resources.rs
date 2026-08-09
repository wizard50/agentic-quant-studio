//! MCP resources: documentation, example graphs, and node-kind schemas.
//!
//! Static content lives under `crates/mcp-server/resources/` and is embedded at
//! compile time via [`include_str!`] (self-contained binary, normal file diffs).
//! URI scheme: `aqs://…`.

use std::sync::LazyLock;

use rmcp::model::{
    Annotations, CacheScope, ListResourceTemplatesResult, ListResourcesResult, ReadResourceResult,
    Resource, ResourceContents, ResourceTemplate, Role,
};
use serde_json::Value;
use studio::{
    catalog::NodeKindCatalog,
    registry::{NodeRegistry, builtin_registry},
};

/// Long TTL for static docs/schema (1 hour). Hosts may cache (SEP-2549).
const STATIC_TTL_MS: u64 = 3_600_000;

static REGISTRY: LazyLock<NodeRegistry> = LazyLock::new(builtin_registry);
static KIND_CATALOG: LazyLock<NodeKindCatalog> =
    LazyLock::new(|| NodeKindCatalog::from_registry(&REGISTRY));

// Paths are relative to this source file (`src/resources.rs`).
const OVERVIEW: &str = include_str!("../resources/docs/overview.md");
const GRAPH_SPEC: &str = include_str!("../resources/docs/graph-spec.md");
const PRESENTATION: &str = include_str!("../resources/docs/presentation-rules.md");
const EXAMPLE_SMA: &str = include_str!("../resources/examples/sma-overlay.json");
const EXAMPLE_GOLDEN_CROSS: &str = include_str!("../resources/examples/golden-cross.json");
const EXAMPLE_RSI_RECLAIM: &str = include_str!("../resources/examples/rsi-reclaim.json");

fn assistant_priority(priority: f32) -> Annotations {
    Annotations::default()
        .with_audience(vec![Role::Assistant])
        .with_priority(priority)
}

fn text_resource(uri: &str, name: &str, title: &str, description: &str, priority: f32) -> Resource {
    Resource::new(uri, name)
        .with_title(title)
        .with_description(description)
        .with_mime_type("text/markdown")
        .with_annotations(assistant_priority(priority))
}

fn json_resource(uri: &str, name: &str, title: &str, description: &str, priority: f32) -> Resource {
    Resource::new(uri, name)
        .with_title(title)
        .with_description(description)
        .with_mime_type("application/json")
        .with_annotations(assistant_priority(priority))
}

/// Static resource list (fixed URIs).
pub fn list_static_resources() -> ListResourcesResult {
    let resources = vec![
        text_resource(
            "aqs://docs/overview",
            "docs-overview",
            "Agent overview",
            "Policy, workflow, resources vs tools",
            1.0,
        ),
        text_resource(
            "aqs://docs/graph-spec",
            "docs-graph-spec",
            "GraphSpec guide",
            "Shape, edges, datasource params, common rules",
            0.9,
        ),
        text_resource(
            "aqs://docs/presentation-rules",
            "docs-presentation",
            "Presentation rules",
            "How the server maps graph nodes to chart panes/markers",
            0.7,
        ),
        json_resource(
            "aqs://docs/examples/sma-overlay",
            "example-sma",
            "Example: SMA overlay",
            "Candles + SMA GraphSpec JSON",
            0.8,
        ),
        json_resource(
            "aqs://docs/examples/golden-cross",
            "example-golden-cross",
            "Example: golden cross",
            "Dual SMA + logic.crossover GraphSpec JSON",
            0.85,
        ),
        json_resource(
            "aqs://docs/examples/rsi-reclaim",
            "example-rsi-reclaim",
            "Example: RSI reclaim",
            "RSI + literal level + crossover GraphSpec JSON",
            0.85,
        ),
        json_resource(
            "aqs://schema/node-kinds",
            "schema-node-kinds",
            "All node kinds",
            "Full ports/params/category for every registered kind",
            0.95,
        ),
    ];

    ListResourcesResult::with_all_items(resources)
        .with_ttl_ms(STATIC_TTL_MS)
        .with_cache_scope(CacheScope::Public)
}

pub fn list_templates() -> ListResourceTemplatesResult {
    let templates = vec![
        ResourceTemplate::new("aqs://schema/kinds/{kind}", "schema-kind")
            .with_title("Node kind schema")
            .with_description(
                "Ports and params for one kind, e.g. aqs://schema/kinds/logic.crossover",
            )
            .with_mime_type("application/json")
            .with_annotations(assistant_priority(0.9)),
    ];
    ListResourceTemplatesResult::with_all_items(templates)
        .with_ttl_ms(STATIC_TTL_MS)
        .with_cache_scope(CacheScope::Public)
}

fn text_contents(uri: &str, mime: &str, text: impl Into<String>) -> ResourceContents {
    ResourceContents::TextResourceContents {
        uri: uri.into(),
        mime_type: Some(mime.into()),
        text: text.into(),
        meta: None,
    }
}

fn ok_read(contents: ResourceContents) -> ReadResourceResult {
    ReadResourceResult::new(vec![contents])
        .with_ttl_ms(STATIC_TTL_MS)
        .with_cache_scope(CacheScope::Public)
}

/// Resolve resource body by URI. Returns `None` if unknown.
pub fn read_uri(uri: &str) -> Option<ReadResourceResult> {
    match uri {
        "aqs://docs/overview" => Some(ok_read(text_contents(uri, "text/markdown", OVERVIEW))),
        "aqs://docs/graph-spec" => Some(ok_read(text_contents(uri, "text/markdown", GRAPH_SPEC))),
        "aqs://docs/presentation-rules" => {
            Some(ok_read(text_contents(uri, "text/markdown", PRESENTATION)))
        }
        "aqs://docs/examples/sma-overlay" => {
            Some(ok_read(text_contents(uri, "application/json", EXAMPLE_SMA)))
        }
        "aqs://docs/examples/golden-cross" => Some(ok_read(text_contents(
            uri,
            "application/json",
            EXAMPLE_GOLDEN_CROSS,
        ))),
        "aqs://docs/examples/rsi-reclaim" => Some(ok_read(text_contents(
            uri,
            "application/json",
            EXAMPLE_RSI_RECLAIM,
        ))),
        "aqs://schema/node-kinds" => {
            let json = serde_json::to_string_pretty(&*KIND_CATALOG).ok()?;
            Some(ok_read(text_contents(uri, "application/json", json)))
        }
        other if other.starts_with("aqs://schema/kinds/") => {
            let kind = other.trim_start_matches("aqs://schema/kinds/");
            if kind.is_empty() || kind.contains('/') {
                return None;
            }
            let entry = KIND_CATALOG.get(kind)?;
            let json = serde_json::to_string_pretty(entry).ok()?;
            Some(ok_read(text_contents(other, "application/json", json)))
        }
        _ => None,
    }
}

/// JSON value of the full kind catalog (for tools that mirror schema).
pub fn node_kinds_value() -> Value {
    serde_json::to_value(&*KIND_CATALOG).unwrap_or(Value::Null)
}

fn parse_embedded_json(raw: &'static str) -> Option<Value> {
    serde_json::from_str(raw).ok()
}

/// Embedded example graphs (for prompts / tests). `None` if the shipped file is not valid JSON.
pub fn example_sma_json() -> Option<Value> {
    parse_embedded_json(EXAMPLE_SMA)
}

pub fn example_golden_cross_json() -> Option<Value> {
    parse_embedded_json(EXAMPLE_GOLDEN_CROSS)
}

pub fn example_rsi_reclaim_json() -> Option<Value> {
    parse_embedded_json(EXAMPLE_RSI_RECLAIM)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_core_resources() {
        let list = list_static_resources();
        assert!(list.resources.len() >= 7);
        assert!(
            list.resources
                .iter()
                .any(|r| r.uri == "aqs://docs/overview")
        );
        assert!(
            list.resources
                .iter()
                .any(|r| r.uri == "aqs://schema/node-kinds")
        );
    }

    #[test]
    fn reads_overview_and_kind_template() {
        let overview = read_uri("aqs://docs/overview").expect("overview");
        match &overview.contents[0] {
            ResourceContents::TextResourceContents { text, .. } => {
                assert!(text.contains("GraphSpec"));
            }
            other => panic!("expected text, got {other:?}"),
        }

        let cross = read_uri("aqs://schema/kinds/logic.crossover").expect("crossover");
        match &cross.contents[0] {
            ResourceContents::TextResourceContents { text, .. } => {
                assert!(text.contains("fast"));
                assert!(text.contains("signal"));
            }
            other => panic!("expected text, got {other:?}"),
        }

        assert!(read_uri("aqs://schema/kinds/nope").is_none());
        assert!(read_uri("aqs://unknown").is_none());
    }

    #[test]
    fn examples_are_valid_json_objects() {
        let sma = example_sma_json().expect("sma-overlay.json must parse");
        assert!(sma.is_object());

        let golden = example_golden_cross_json().expect("golden-cross.json must parse");
        assert!(golden["nodes"].is_array());

        let rsi = example_rsi_reclaim_json().expect("rsi-reclaim.json must parse");
        assert_eq!(rsi["nodes"].as_array().map(|a| a.len()), Some(5));
    }
}
