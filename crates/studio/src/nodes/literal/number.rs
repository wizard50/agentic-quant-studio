use async_trait::async_trait;

use crate::{
    error::Result,
    runtime::{
        context::ExecutionContext,
        node::{NodeMeta, NodeOp, ResolvedInputs, ResolvedOutputs},
    },
};

use super::common::{execute_number_literal, number_meta};

pub struct NumberOp;

impl NumberOp {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl NodeOp for NumberOp {
    fn meta(&self) -> NodeMeta {
        number_meta("literal.number")
    }

    async fn execute(
        &self,
        _ctx: &ExecutionContext,
        inputs: ResolvedInputs,
        params: &serde_json::Value,
    ) -> Result<ResolvedOutputs> {
        execute_number_literal(inputs, params)
    }
}
