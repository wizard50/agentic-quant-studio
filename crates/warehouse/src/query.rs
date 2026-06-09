//! Candle query window resolution.
//!
//! Converts partial API parameters (`limit`, optional `start`/`end`) into a bounded
//! millisecond window so Polars reads only the relevant slice of data.

use crate::error::{Error, Result};
use chrono::{DateTime, Months, Utc};
use common::types::Interval;

/// Default number of candles when the client sends no query parameters.
pub const DEFAULT_CANDLE_LIMIT: u32 = 1000;

/// Extra candles included in the derived time window before trimming to `limit`.
/// Covers occasional gaps in the stored series without using a fixed day-based buffer.
pub const WINDOW_BUFFER_CANDLES: u32 = 50;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DatasetBounds {
    pub from: i64,
    pub to: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ResolvedCandleWindow {
    pub start_ms: i64,
    pub end_ms: i64,
    pub limit: Option<u32>,
}

/// Resolve partial candle query parameters into a bounded `[start_ms, end_ms]` window.
pub fn resolve_candle_window(
    start_ms: Option<i64>,
    end_ms: Option<i64>,
    limit: Option<u32>,
    interval: Interval,
    dataset_bounds: Option<DatasetBounds>,
) -> Result<ResolvedCandleWindow> {
    if let (Some(start), Some(end)) = (start_ms, end_ms) {
        if start > end {
            return Err(Error::InvalidCandleQuery(
                "start must be less than or equal to end".to_string(),
            ));
        }
    }

    let has_explicit_range = start_ms.is_some() && end_ms.is_some();
    let effective_limit = match limit {
        Some(value) => Some(value),
        None if has_explicit_range => None,
        None => Some(DEFAULT_CANDLE_LIMIT),
    };

    let dataset_to = dataset_bounds.map(|b| b.to);
    let dataset_from = dataset_bounds.map(|b| b.from);

    let end = match end_ms {
        Some(value) => value,
        None => match (start_ms, effective_limit, dataset_to) {
            (Some(start), Some(lim), _) => {
                add_candles_to_timestamp(start, interval, lim + WINDOW_BUFFER_CANDLES)
            }
            (None, Some(_), Some(to)) => to,
            (None, Some(_), None) => {
                return Err(Error::InvalidCandleQuery(
                    "cannot resolve latest candles without dataset bounds".to_string(),
                ));
            }
            (Some(_), None, _) | (None, None, _) => {
                return Err(Error::InvalidCandleQuery(
                    "end time is required when limit is not set".to_string(),
                ));
            }
        },
    };

    let start = match start_ms {
        Some(value) => value,
        None => {
            let lim = effective_limit.ok_or_else(|| {
                Error::InvalidCandleQuery(
                    "start time is required when limit is not set".to_string(),
                )
            })?;
            subtract_candles_from_timestamp(end, interval, lim + WINDOW_BUFFER_CANDLES)
        }
    };

    let start = dataset_from.map(|from| start.max(from)).unwrap_or(start);
    let end = dataset_to.map(|to| end.min(to)).unwrap_or(end);

    if start > end {
        return Err(Error::InvalidCandleQuery(
            "resolved start is after end for the requested window".to_string(),
        ));
    }

    Ok(ResolvedCandleWindow {
        start_ms: start,
        end_ms: end,
        limit: effective_limit,
    })
}

fn subtract_candles_from_timestamp(end_ms: i64, interval: Interval, candle_count: u32) -> i64 {
    let Some(end) = DateTime::<Utc>::from_timestamp_millis(end_ms) else {
        return end_ms;
    };

    let start = match interval {
        Interval::Second(n) => end - chrono::Duration::seconds((n as i64) * (candle_count as i64)),
        Interval::Minute(n) => end - chrono::Duration::minutes((n as i64) * (candle_count as i64)),
        Interval::Hour(n) => end - chrono::Duration::hours((n as i64) * (candle_count as i64)),
        Interval::Day(n) => end - chrono::Duration::days((n as i64) * (candle_count as i64)),
        Interval::Week(n) => end - chrono::Duration::weeks((n as i64) * (candle_count as i64)),
        Interval::Month(n) => {
            let total_months = (n as u32).saturating_mul(candle_count);
            end.checked_sub_months(Months::new(total_months))
                .unwrap_or(end)
        }
        Interval::Year(n) => {
            let total_months = (n as u32).saturating_mul(12).saturating_mul(candle_count);
            end.checked_sub_months(Months::new(total_months))
                .unwrap_or(end)
        }
    };

    start.timestamp_millis()
}

fn add_candles_to_timestamp(start_ms: i64, interval: Interval, candle_count: u32) -> i64 {
    let Some(start) = DateTime::<Utc>::from_timestamp_millis(start_ms) else {
        return start_ms;
    };

    let end = match interval {
        Interval::Second(n) => {
            start + chrono::Duration::seconds((n as i64) * (candle_count as i64))
        }
        Interval::Minute(n) => {
            start + chrono::Duration::minutes((n as i64) * (candle_count as i64))
        }
        Interval::Hour(n) => start + chrono::Duration::hours((n as i64) * (candle_count as i64)),
        Interval::Day(n) => start + chrono::Duration::days((n as i64) * (candle_count as i64)),
        Interval::Week(n) => start + chrono::Duration::weeks((n as i64) * (candle_count as i64)),
        Interval::Month(n) => {
            let total_months = (n as u32).saturating_mul(candle_count);
            start
                .checked_add_months(Months::new(total_months))
                .unwrap_or(start)
        }
        Interval::Year(n) => {
            let total_months = (n as u32).saturating_mul(12).saturating_mul(candle_count);
            start
                .checked_add_months(Months::new(total_months))
                .unwrap_or(start)
        }
    };

    end.timestamp_millis()
}

#[cfg(test)]
mod tests {
    use super::*;

    const HOUR_MS: i64 = 3_600_000;
    const MINUTE_MS: i64 = 60_000;

    fn bounds(from: i64, to: i64) -> DatasetBounds {
        DatasetBounds { from, to }
    }

    #[test]
    fn limit_only_uses_catalog_to_and_derives_start() {
        let to = 1_700_000_000_000_i64;
        let from = to - (1_000 * MINUTE_MS);
        let window = resolve_candle_window(
            None,
            None,
            Some(500),
            Interval::Minute(1),
            Some(bounds(from, to)),
        )
        .unwrap();

        assert_eq!(window.end_ms, to);
        assert_eq!(window.limit, Some(500));
        assert_eq!(window.start_ms, to - (550 * MINUTE_MS));
    }

    #[test]
    fn unbounded_query_defaults_to_latest_1000() {
        let to = 1_700_000_000_000_i64;
        let from = to - ((DEFAULT_CANDLE_LIMIT + WINDOW_BUFFER_CANDLES) as i64 * MINUTE_MS);
        let window = resolve_candle_window(
            None,
            None,
            None,
            Interval::Minute(1),
            Some(bounds(from, to)),
        )
        .unwrap();

        assert_eq!(window.limit, Some(DEFAULT_CANDLE_LIMIT));
        assert_eq!(window.end_ms, to);
        assert_eq!(
            window.start_ms,
            to - ((DEFAULT_CANDLE_LIMIT + WINDOW_BUFFER_CANDLES) as i64 * MINUTE_MS)
        );
    }

    #[test]
    fn end_and_limit_derives_start_without_catalog_to() {
        let end = 1_700_000_000_000_i64;
        let from = end - (1_000 * HOUR_MS);
        let window = resolve_candle_window(
            None,
            Some(end),
            Some(500),
            Interval::Hour(1),
            Some(bounds(from, end + HOUR_MS)),
        )
        .unwrap();

        assert_eq!(window.end_ms, end);
        assert_eq!(window.start_ms, end - (550 * HOUR_MS));
    }

    #[test]
    fn explicit_start_and_end_passes_through_without_default_limit() {
        let window =
            resolve_candle_window(Some(1_000), Some(2_000), None, Interval::Minute(1), None)
                .unwrap();

        assert_eq!(window.start_ms, 1_000);
        assert_eq!(window.end_ms, 2_000);
        assert_eq!(window.limit, None);
    }

    #[test]
    fn explicit_range_with_limit_keeps_bounds() {
        let window = resolve_candle_window(
            Some(1_000),
            Some(2_000),
            Some(100),
            Interval::Minute(1),
            None,
        )
        .unwrap();

        assert_eq!(window.start_ms, 1_000);
        assert_eq!(window.end_ms, 2_000);
        assert_eq!(window.limit, Some(100));
    }

    #[test]
    fn clamps_resolved_window_to_dataset_bounds() {
        let to = 1_000_000_i64;
        let window = resolve_candle_window(
            None,
            None,
            Some(500),
            Interval::Minute(1),
            Some(bounds(to - 100 * MINUTE_MS, to)),
        )
        .unwrap();

        assert_eq!(window.end_ms, to);
        assert_eq!(window.start_ms, to - 100 * MINUTE_MS);
    }

    #[test]
    fn rejects_start_after_end() {
        let err = resolve_candle_window(
            Some(2_000),
            Some(1_000),
            Some(100),
            Interval::Minute(1),
            None,
        )
        .unwrap_err();

        assert!(matches!(err, Error::InvalidCandleQuery(_)));
    }
}
