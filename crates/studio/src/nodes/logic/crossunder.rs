use async_trait::async_trait;

use crate::{
    error::Result,
    runtime::{
        context::ExecutionContext,
        node::{NodeMeta, NodeOp, ResolvedInputs, ResolvedOutputs},
    },
};

use super::common::{cross_signal_meta, execute_crossunder};

pub struct CrossunderOp;

impl CrossunderOp {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl NodeOp for CrossunderOp {
    fn meta(&self) -> NodeMeta {
        cross_signal_meta("logic.crossunder")
    }

    async fn execute(
        &self,
        _ctx: &ExecutionContext,
        inputs: ResolvedInputs,
        _params: &serde_json::Value,
    ) -> Result<ResolvedOutputs> {
        execute_crossunder(inputs)
    }
}
