use async_trait::async_trait;
use talib_rs::momentum::rsi;

use crate::{
    error::Result,
    runtime::{
        context::ExecutionContext,
        node::{NodeMeta, NodeOp, ResolvedInputs, ResolvedOutputs},
    },
};

use super::common::{execute_period_overlay, oscillator_chart_defaults, single_series_value_meta};

pub struct RsiOp;

impl RsiOp {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl NodeOp for RsiOp {
    fn meta(&self) -> NodeMeta {
        single_series_value_meta(
            "indicator.rsi",
            14,
            oscillator_chart_defaults(14, 0.0, 100.0),
        )
    }

    async fn execute(
        &self,
        _ctx: &ExecutionContext,
        inputs: ResolvedInputs,
        params: &serde_json::Value,
    ) -> Result<ResolvedOutputs> {
        execute_period_overlay(inputs, params, rsi)
    }
}
