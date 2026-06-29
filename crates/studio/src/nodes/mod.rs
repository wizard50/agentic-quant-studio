pub mod datasource;
pub mod indicator;
pub mod literal;
pub mod logic;

use std::sync::Arc;

use crate::{
    nodes::{
        datasource::CandlesOp,
        indicator::{ema::EmaOp, rsi::RsiOp, sma::SmaOp},
        literal::{bool::BoolOp, number::NumberOp},
        logic::{
            and::AndOp, crossover::CrossoverOp, crossunder::CrossunderOp, gt::GtOp, lt::LtOp,
            or::OrOp,
        },
    },
    registry::NodeRegistry,
};

pub fn register_builtins(registry: &mut NodeRegistry) {
    registry.register(Arc::new(CandlesOp::new()));
    registry.register(Arc::new(SmaOp::new()));
    registry.register(Arc::new(EmaOp::new()));
    registry.register(Arc::new(RsiOp::new()));
    registry.register(Arc::new(NumberOp::new()));
    registry.register(Arc::new(BoolOp::new()));
    registry.register(Arc::new(CrossoverOp::new()));
    registry.register(Arc::new(CrossunderOp::new()));
    registry.register(Arc::new(GtOp::new()));
    registry.register(Arc::new(LtOp::new()));
    registry.register(Arc::new(AndOp::new()));
    registry.register(Arc::new(OrOp::new()));
}
