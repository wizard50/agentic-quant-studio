use crate::{runtime::value::ValueKind, spec::PortRef};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("unknown node kind: {0}")]
    UnknownKind(String),

    #[error("duplicate node id: {0}")]
    DuplicateNodeId(String),

    #[error("node not found in graph: {0}")]
    NodeNotFound(String),

    #[error("port not found: {0}")]
    PortNotFound(String),

    #[error("parameter not found: {0}")]
    ParamNotFound(String),

    #[error("invalid parameter: {0}")]
    InvalidParameter(String),

    #[error("port type mismatch: {from} -> {to}")]
    PortTypeMismatch { from: PortRef, to: PortRef },

    #[error("type mismatch on port {port}: expected {expected:?}, got {got:?}")]
    TypeMismatch {
        port: String,
        expected: ValueKind,
        got: ValueKind,
    },

    #[error("graph has a cycle")]
    CycleDetected,

    #[error("multiple edges target the same input port: {0}")]
    DuplicateInputWire(String),

    #[error("indicator error: {0}")]
    Indicator(String),

    #[error("datasource error: {0}")]
    DataSource(String),

    #[error("expected format 'node_id.port_name'")]
    InvalidFormat,

    #[error("node_id and port_name must not be empty")]
    Empty,

    #[error("node_id and port_name must not contain '.'")]
    ContainsDot,
}

pub type Result<T> = std::result::Result<T, Error>;
