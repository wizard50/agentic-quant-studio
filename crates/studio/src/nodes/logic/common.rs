use std::sync::Arc;

use crate::{
    error::{Error, Result},
    runtime::{
        node::{NodeCategory, NodeMeta, Port, ResolvedInputs, ResolvedOutputs},
        value::{SeriesBool, Value, ValueKind},
    },
};

pub fn cross_signal_meta(kind: &str) -> NodeMeta {
    NodeMeta {
        kind: kind.to_string(),
        category: NodeCategory::Logic,
        inputs: vec![
            Port {
                name: "fast".to_string(),
                kind: ValueKind::SeriesF64,
            },
            Port {
                name: "slow".to_string(),
                kind: ValueKind::SeriesF64,
            },
        ],
        outputs: vec![Port {
            name: "signal".to_string(),
            kind: ValueKind::SeriesBool,
        }],
        params: vec![],
        chart_defaults: None,
    }
}

fn compute_cross_signal<F>(fast: &[Option<f64>], slow: &[Option<f64>], detect: F) -> SeriesBool
where
    F: Fn(f64, f64, f64, f64) -> bool,
{
    let len = fast.len().min(slow.len());
    let mut values = Vec::with_capacity(len);

    for index in 0..len {
        if index == 0 {
            values.push(None);
            continue;
        }

        let signal = match (fast[index - 1], slow[index - 1], fast[index], slow[index]) {
            (Some(fast_prev), Some(slow_prev), Some(fast_curr), Some(slow_curr)) => {
                Some(detect(fast_prev, slow_prev, fast_curr, slow_curr))
            }
            _ => None,
        };

        values.push(signal);
    }

    SeriesBool { values }
}

pub fn compute_crossover(fast: &[Option<f64>], slow: &[Option<f64>]) -> SeriesBool {
    compute_cross_signal(fast, slow, |fast_prev, slow_prev, fast_curr, slow_curr| {
        fast_prev <= slow_prev && fast_curr > slow_curr
    })
}

pub fn compute_crossunder(fast: &[Option<f64>], slow: &[Option<f64>]) -> SeriesBool {
    compute_cross_signal(fast, slow, |fast_prev, slow_prev, fast_curr, slow_curr| {
        fast_prev >= slow_prev && fast_curr < slow_curr
    })
}

fn execute_cross_signal<F>(inputs: ResolvedInputs, compute: F) -> Result<ResolvedOutputs>
where
    F: FnOnce(&[Option<f64>], &[Option<f64>]) -> SeriesBool,
{
    let fast = inputs.series_f64("fast")?;
    let slow = inputs.series_f64("slow")?;

    if fast.values.len() != slow.values.len() {
        return Err(Error::InvalidParameter(format!(
            "fast and slow series must have the same length (got {} and {})",
            fast.values.len(),
            slow.values.len()
        )));
    }

    let signal = compute(&fast.values, &slow.values);
    let mut outputs = ResolvedOutputs::new();
    outputs.set("signal", Value::SeriesBool(Arc::new(signal)));
    Ok(outputs)
}

pub fn execute_crossover(inputs: ResolvedInputs) -> Result<ResolvedOutputs> {
    execute_cross_signal(inputs, compute_crossover)
}

pub fn execute_crossunder(inputs: ResolvedInputs) -> Result<ResolvedOutputs> {
    execute_cross_signal(inputs, compute_crossunder)
}

pub fn compare_signal_meta(kind: &str) -> NodeMeta {
    NodeMeta {
        kind: kind.to_string(),
        category: NodeCategory::Logic,
        inputs: vec![
            Port {
                name: "left".to_string(),
                kind: ValueKind::SeriesF64,
            },
            Port {
                name: "right".to_string(),
                kind: ValueKind::SeriesF64,
            },
        ],
        outputs: vec![Port {
            name: "signal".to_string(),
            kind: ValueKind::SeriesBool,
        }],
        params: vec![],
        chart_defaults: None,
    }
}

pub fn bool_signal_meta(kind: &str) -> NodeMeta {
    NodeMeta {
        kind: kind.to_string(),
        category: NodeCategory::Logic,
        inputs: vec![
            Port {
                name: "left".to_string(),
                kind: ValueKind::SeriesBool,
            },
            Port {
                name: "right".to_string(),
                kind: ValueKind::SeriesBool,
            },
        ],
        outputs: vec![Port {
            name: "signal".to_string(),
            kind: ValueKind::SeriesBool,
        }],
        params: vec![],
        chart_defaults: None,
    }
}

fn ensure_matching_series_lengths(
    left_len: usize,
    right_len: usize,
    left_name: &str,
    right_name: &str,
) -> Result<()> {
    if left_len != right_len {
        return Err(Error::InvalidParameter(format!(
            "{left_name} and {right_name} series must have the same length (got {left_len} and {right_len})"
        )));
    }

    Ok(())
}

fn compute_binary_f64<F>(left: &[Option<f64>], right: &[Option<f64>], compare: F) -> SeriesBool
where
    F: Fn(f64, f64) -> bool,
{
    let len = left.len().min(right.len());
    let values = (0..len)
        .map(|index| match (left[index], right[index]) {
            (Some(left_value), Some(right_value)) => Some(compare(left_value, right_value)),
            _ => None,
        })
        .collect();

    SeriesBool { values }
}

fn compute_binary_bool<F>(left: &[Option<bool>], right: &[Option<bool>], combine: F) -> SeriesBool
where
    F: Fn(bool, bool) -> bool,
{
    let len = left.len().min(right.len());
    let values = (0..len)
        .map(|index| match (left[index], right[index]) {
            (Some(left_value), Some(right_value)) => Some(combine(left_value, right_value)),
            _ => None,
        })
        .collect();

    SeriesBool { values }
}

pub fn compute_gt(left: &[Option<f64>], right: &[Option<f64>]) -> SeriesBool {
    compute_binary_f64(left, right, |left_value, right_value| {
        left_value > right_value
    })
}

pub fn compute_lt(left: &[Option<f64>], right: &[Option<f64>]) -> SeriesBool {
    compute_binary_f64(left, right, |left_value, right_value| {
        left_value < right_value
    })
}

pub fn compute_and(left: &[Option<bool>], right: &[Option<bool>]) -> SeriesBool {
    compute_binary_bool(left, right, |left_value, right_value| {
        left_value && right_value
    })
}

pub fn compute_or(left: &[Option<bool>], right: &[Option<bool>]) -> SeriesBool {
    compute_binary_bool(left, right, |left_value, right_value| {
        left_value || right_value
    })
}

fn execute_compare_f64<F>(inputs: ResolvedInputs, compute: F) -> Result<ResolvedOutputs>
where
    F: FnOnce(&[Option<f64>], &[Option<f64>]) -> SeriesBool,
{
    let left = inputs.series_f64("left")?;
    let right = inputs.series_f64("right")?;
    ensure_matching_series_lengths(left.values.len(), right.values.len(), "left", "right")?;

    let signal = compute(&left.values, &right.values);
    let mut outputs = ResolvedOutputs::new();
    outputs.set("signal", Value::SeriesBool(Arc::new(signal)));
    Ok(outputs)
}

fn execute_bool_logic<F>(inputs: ResolvedInputs, compute: F) -> Result<ResolvedOutputs>
where
    F: FnOnce(&[Option<bool>], &[Option<bool>]) -> SeriesBool,
{
    let left = inputs.series_bool("left")?;
    let right = inputs.series_bool("right")?;
    ensure_matching_series_lengths(left.values.len(), right.values.len(), "left", "right")?;

    let signal = compute(&left.values, &right.values);
    let mut outputs = ResolvedOutputs::new();
    outputs.set("signal", Value::SeriesBool(Arc::new(signal)));
    Ok(outputs)
}

pub fn execute_gt(inputs: ResolvedInputs) -> Result<ResolvedOutputs> {
    execute_compare_f64(inputs, compute_gt)
}

pub fn execute_lt(inputs: ResolvedInputs) -> Result<ResolvedOutputs> {
    execute_compare_f64(inputs, compute_lt)
}

pub fn execute_and(inputs: ResolvedInputs) -> Result<ResolvedOutputs> {
    execute_bool_logic(inputs, compute_and)
}

pub fn execute_or(inputs: ResolvedInputs) -> Result<ResolvedOutputs> {
    execute_bool_logic(inputs, compute_or)
}
