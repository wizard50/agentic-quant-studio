use crate::{
    error::Result,
    runtime::node::{
        NodeCategory, NodeMeta, NodeOp, Param, ParamKind, Port, ResolvedInputs, ResolvedOutputs,
    },
    runtime::value::ValueKind,
};

pub struct OutputSignalOp;

impl OutputSignalOp {
    pub fn new() -> Self {
        Self
    }
}

impl NodeOp for OutputSignalOp {
    fn meta(&self) -> NodeMeta {
        NodeMeta {
            kind: "output.signal".to_string(),
            category: NodeCategory::Output,
            inputs: vec![Port {
                name: "signal".to_string(),
                kind: ValueKind::SeriesBool,
            }],
            outputs: vec![Port {
                name: "signal".to_string(),
                kind: ValueKind::SeriesBool,
            }],
            params: vec![Param {
                name: "label".to_string(),
                kind: ParamKind::String,
            }],
        }
    }

    fn execute(
        &self,
        inputs: ResolvedInputs,
        _params: &serde_json::Value,
    ) -> Result<ResolvedOutputs> {
        let value = inputs.get("signal")?.clone();
        let mut outputs = ResolvedOutputs::new();
        outputs.set("signal", value);
        Ok(outputs)
    }
}
