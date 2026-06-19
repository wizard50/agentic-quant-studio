use std::{collections::HashMap, sync::Arc};

use crate::runtime::node::{NodeMeta, NodeOp};

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
