use async_trait::async_trait;
use talib_rs::overlap::sma;

use crate::{
    error::Result,
    runtime::{
        context::ExecutionContext,
        node::{NodeMeta, NodeOp, ResolvedInputs, ResolvedOutputs},
    },
};

use super::common::{execute_period_overlay, overlay_chart_defaults, single_series_value_meta};

pub struct SmaOp;

impl SmaOp {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl NodeOp for SmaOp {
    fn meta(&self) -> NodeMeta {
        single_series_value_meta("indicator.sma", 20, overlay_chart_defaults(20))
    }

    async fn execute(
        &self,
        _ctx: &ExecutionContext,
        inputs: ResolvedInputs,
        params: &serde_json::Value,
    ) -> Result<ResolvedOutputs> {
        execute_period_overlay(inputs, params, sma)
    }
}
