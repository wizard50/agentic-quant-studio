use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("expected format 'node_id.port_name'")]
    InvalidFormat,

    #[error("node_id and port_name must not be empty")]
    Empty,

    #[error("node_id and port_name must not contain '.'")]
    ContainsDot,
}

pub type Result<T> = std::result::Result<T, Error>;
