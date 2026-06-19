use std::{collections::HashMap, sync::Arc};

use crate::{
    error::{Error, Result},
    registry::NodeRegistry,
    runtime::{node::ResolvedInputs, plan::topo_sort, validate::validate, value::Value},
    spec::{PortRef, graph::GraphSpec},
};

pub struct PortStore {
    values: HashMap<PortRef, Arc<Value>>,
}

impl PortStore {
    pub fn insert(&mut self, port: PortRef, value: Value) {
        self.values.insert(port, Arc::new(value));
    }

    pub fn get(&self, port: &PortRef) -> Result<Arc<Value>> {
        self.values
            .get(port)
            .cloned()
            .ok_or_else(|| Error::PortNotFound(port.to_string()))
    }
}

impl Default for PortStore {
    fn default() -> Self {
        Self {
            values: HashMap::new(),
        }
    }
}

pub fn execute(graph: &GraphSpec, registry: &NodeRegistry) -> Result<PortStore> {
    validate(graph, registry)?;
    let order = topo_sort(graph)?;
    let mut store = PortStore::default();

    for node_id in order {
        let node_spec = graph.node(&node_id)?;

        let op = registry
            .get(&node_spec.kind)
            .ok_or_else(|| Error::UnknownKind(node_spec.kind.clone()))?;

        let meta = op.meta();
        let mut inputs = ResolvedInputs::new();
        for input in &meta.inputs {
            let wire_to = PortRef::new(&node_id, &input.name)?;
            let wire = graph.edge_to(&wire_to)?;

            inputs.insert(&input.name, store.get(&wire.from)?);
        }

        let outputs = op.execute(inputs, &node_spec.params)?;
        for output in &meta.outputs {
            let value = outputs
                .get(&output.name)
                .ok_or_else(|| Error::PortNotFound(output.name.clone()))?;
            store.insert(PortRef::new(&node_id, &output.name)?, value.clone());
        }
    }

    Ok(store)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        registry::builtin_registry,
        runtime::value::{SeriesF64, Value},
    };

    #[test]
    fn execute_sma_over_constant_series() {
        let registry = builtin_registry();
        let mut store = PortStore::default();
        store.insert(
            PortRef::new("sma20", "input").unwrap(),
            Value::SeriesF64(Arc::new(SeriesF64 {
                values: vec![Some(1.0), Some(2.0), Some(3.0), Some(4.0), Some(5.0)],
            })),
        );

        let op = registry.get("indicator.sma").unwrap();
        let mut inputs = ResolvedInputs::new();
        inputs.insert(
            "input",
            store.get(&PortRef::new("sma20", "input").unwrap()).unwrap(),
        );
        let outputs = op
            .execute(inputs, &serde_json::json!({ "period": 3 }))
            .unwrap();
        let series = outputs.get("value").unwrap();
        assert!(matches!(series, Value::SeriesF64(_)));
    }
}
