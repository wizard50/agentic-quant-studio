use async_trait::async_trait;

use crate::{
    error::Result,
    runtime::{
        context::ExecutionContext,
        node::{NodeMeta, NodeOp, ResolvedInputs, ResolvedOutputs},
    },
};

use super::common::{compare_signal_meta, execute_gt};

pub struct GtOp;

impl GtOp {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl NodeOp for GtOp {
    fn meta(&self) -> NodeMeta {
        compare_signal_meta("logic.gt")
    }

    async fn execute(
        &self,
        _ctx: &ExecutionContext,
        inputs: ResolvedInputs,
        _params: &serde_json::Value,
    ) -> Result<ResolvedOutputs> {
        execute_gt(inputs)
    }
}
