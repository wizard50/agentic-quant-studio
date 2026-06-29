use async_trait::async_trait;

use crate::{
    error::Result,
    runtime::{
        context::ExecutionContext,
        node::{NodeMeta, NodeOp, ResolvedInputs, ResolvedOutputs},
    },
};

use super::common::{cross_signal_meta, execute_crossover};

pub struct CrossoverOp;

impl CrossoverOp {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl NodeOp for CrossoverOp {
    fn meta(&self) -> NodeMeta {
        cross_signal_meta("logic.crossover")
    }

    async fn execute(
        &self,
        _ctx: &ExecutionContext,
        inputs: ResolvedInputs,
        _params: &serde_json::Value,
    ) -> Result<ResolvedOutputs> {
        execute_crossover(inputs)
    }
}
