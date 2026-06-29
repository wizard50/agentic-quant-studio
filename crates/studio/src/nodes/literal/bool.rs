use async_trait::async_trait;

use crate::{
    error::Result,
    runtime::{
        context::ExecutionContext,
        node::{NodeMeta, NodeOp, ResolvedInputs, ResolvedOutputs},
    },
};

use super::common::{bool_meta, execute_bool_literal};

pub struct BoolOp;

impl BoolOp {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl NodeOp for BoolOp {
    fn meta(&self) -> NodeMeta {
        bool_meta("literal.bool")
    }

    async fn execute(
        &self,
        _ctx: &ExecutionContext,
        inputs: ResolvedInputs,
        params: &serde_json::Value,
    ) -> Result<ResolvedOutputs> {
        execute_bool_literal(inputs, params)
    }
}
