use std::{collections::HashMap, sync::Arc};

use crate::runtime::node::{NodeCategory, NodeMeta, NodeOp};

pub struct NodeRegistry {
    ops: HashMap<String, Arc<dyn NodeOp>>,
    meta: HashMap<String, NodeMeta>,
}

impl NodeRegistry {
    pub fn new() -> Self {
        Self {
            ops: HashMap::new(),
            meta: HashMap::new(),
        }
    }

    pub fn register(&mut self, op: Arc<dyn NodeOp>) {
        let meta = op.meta();
        let kind = meta.kind.clone();
        self.meta.insert(kind.clone(), meta);
        self.ops.insert(kind, op);
    }

    pub fn get(&self, kind: &str) -> Option<&dyn NodeOp> {
        self.ops.get(kind).map(|op| op.as_ref())
    }

    pub fn meta(&self, kind: &str) -> Option<&NodeMeta> {
        self.meta.get(kind)
    }

    pub fn kinds(&self) -> impl Iterator<Item = &str> {
        self.ops.keys().map(String::as_str)
    }

    pub fn indicator_metas(&self) -> Vec<NodeMeta> {
        let mut metas: Vec<NodeMeta> = self
            .meta
            .values()
            .filter(|meta| meta.category == NodeCategory::Indicator)
            .cloned()
            .collect();
        metas.sort_by(|left, right| left.kind.cmp(&right.kind));
        metas
    }
}

impl Default for NodeRegistry {
    fn default() -> Self {
        Self::new()
    }
}

pub fn builtin_registry() -> NodeRegistry {
    let mut registry = NodeRegistry::new();
    crate::nodes::register_builtins(&mut registry);
    registry
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime::node::ParamKind;

    #[test]
    fn builtin_registry_includes_logic_nodes() {
        let registry = builtin_registry();

        for kind in [
            "literal.number",
            "literal.bool",
            "logic.crossover",
            "logic.crossunder",
            "logic.gt",
            "logic.lt",
            "logic.and",
            "logic.or",
        ] {
            assert!(registry.get(kind).is_some(), "missing builtin node: {kind}");
        }
    }

    #[test]
    fn literal_metas_are_not_included_in_indicator_catalog() {
        let registry = builtin_registry();
        let indicators = registry.indicator_metas();

        assert!(!indicators.iter().any(|meta| meta.kind.starts_with("literal.")));
    }

    #[test]
    fn indicator_metas_returns_only_indicator_nodes() {
        let registry = builtin_registry();
        let indicators = registry.indicator_metas();

        assert_eq!(indicators.len(), 3);
        assert_eq!(indicators[0].kind, "indicator.ema");
        assert_eq!(indicators[1].kind, "indicator.rsi");
        assert_eq!(indicators[2].kind, "indicator.sma");

        for meta in &indicators {
            assert_eq!(meta.params[0].name, "period");
            assert_eq!(meta.params[0].kind, ParamKind::U32);
        }

        assert_eq!(indicators[1].params[0].default, Some(serde_json::json!(14)));
    }
}
