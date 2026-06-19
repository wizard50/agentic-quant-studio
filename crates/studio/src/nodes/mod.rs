pub mod indicator;
pub mod output;

use std::sync::Arc;

use crate::{
    nodes::{
        indicator::sma::SmaOp,
        output::{OutputSeriesOp, OutputSignalOp},
    },
    registry::NodeRegistry,
};

pub fn register_builtins(registry: &mut NodeRegistry) {
    registry.register(Arc::new(SmaOp::new()));
    registry.register(Arc::new(OutputSeriesOp::new()));
    registry.register(Arc::new(OutputSignalOp::new()));
}
