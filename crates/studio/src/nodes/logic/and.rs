use async_trait::async_trait;

use crate::{
    error::Result,
    runtime::{
        context::ExecutionContext,
        node::{NodeMeta, NodeOp, ResolvedInputs, ResolvedOutputs},
    },
};

use super::common::{bool_signal_meta, execute_and};

pub struct AndOp;

impl AndOp {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl NodeOp for AndOp {
    fn meta(&self) -> NodeMeta {
        bool_signal_meta("logic.and")
    }

    async fn execute(
        &self,
        _ctx: &ExecutionContext,
        inputs: ResolvedInputs,
        _params: &serde_json::Value,
    ) -> Result<ResolvedOutputs> {
        execute_and(inputs)
    }
}
