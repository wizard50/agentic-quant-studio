use async_trait::async_trait;

use crate::{
    error::Result,
    runtime::{
        context::ExecutionContext,
        node::{NodeMeta, NodeOp, ResolvedInputs, ResolvedOutputs},
    },
};

use super::common::{bool_signal_meta, execute_or};

pub struct OrOp;

impl OrOp {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl NodeOp for OrOp {
    fn meta(&self) -> NodeMeta {
        bool_signal_meta("logic.or")
    }

    async fn execute(
        &self,
        _ctx: &ExecutionContext,
        inputs: ResolvedInputs,
        _params: &serde_json::Value,
    ) -> Result<ResolvedOutputs> {
        execute_or(inputs)
    }
}
