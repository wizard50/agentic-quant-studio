pub mod datasource;
pub mod indicator;

use std::sync::Arc;

use crate::{
    nodes::{datasource::CandlesOp, indicator::sma::SmaOp},
    registry::NodeRegistry,
};

pub fn register_builtins(registry: &mut NodeRegistry) {
    registry.register(Arc::new(CandlesOp::new()));
    registry.register(Arc::new(SmaOp::new()));
}
