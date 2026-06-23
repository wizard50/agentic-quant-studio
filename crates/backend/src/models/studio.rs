use std::collections::HashMap;

use serde::Serialize;
use studio::runtime::{PortStore, Value};

#[derive(Debug, Serialize)]
pub struct StudioRunResponse {
    pub outputs: HashMap<String, Value>,
}

impl StudioRunResponse {
    pub fn from_store(store: PortStore) -> Self {
        let outputs = store
            .iter()
            .map(|(port, value)| (port.to_string(), value.as_ref().clone()))
            .collect();

        Self { outputs }
    }
}
