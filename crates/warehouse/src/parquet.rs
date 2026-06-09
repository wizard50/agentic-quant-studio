use crate::error::{Error, Result};
use chrono::{DateTime, Datelike, NaiveDate, Utc};
use common::types::{Candle, Interval};
use polars::prelude::*;
use polars_buffer::Buffer;
use polars_utils::pl_path::PlRefPath;
use std::fs;
use std::path::{Path, PathBuf};

/// Extra calendar days included on each side when mapping a time range to day partitions.
const PARTITION_DAY_BUFFER: i64 = 1;

/// Writes a batch of candles to Hive-partitioned Parquet files:
/// `base_dir/{exchange}/{category}/{symbol}/{interval}/year=YYYY/month=MM/day=DD/data.parquet`
pub fn write_candles_partitioned(
    candles: &[Candle],
    exchange: &str,
    category: &str,
    symbol: &str,
    interval: &str,
    base_dir: &Path,
) -> Result<()> {
    if candles.is_empty() {
        return Ok(());
    }

    let df = candles_to_dataframe(candles)?;

    let base_path = base_dir
        .join(exchange)
        .join(category)
        .join(symbol)
        .join(interval);

    write_hive_partitioned_parquet(df, &base_path)?;

    Ok(())
}

fn candles_to_dataframe(candles: &[Candle]) -> Result<DataFrame> {
    if candles.is_empty() {
        return Ok(DataFrame::empty());
    }

    let timestamps: Vec<i64> = candles.iter().map(|c| c.timestamp).collect();
    let opens: Vec<f64> = candles.iter().map(|c| c.open).collect();
    let highs: Vec<f64> = candles.iter().map(|c| c.high).collect();
    let lows: Vec<f64> = candles.iter().map(|c| c.low).collect();
    let closes: Vec<f64> = candles.iter().map(|c| c.close).collect();
    let volumes: Vec<f64> = candles.iter().map(|c| c.volume).collect();

    let df = df![
        "timestamp" => timestamps,
        "open"      => opens,
        "high"      => highs,
        "low"       => lows,
        "close"     => closes,
        "volume"    => volumes,
    ]?;

    Ok(df)
}

fn build_partitions(df: DataFrame) -> Result<Vec<DataFrame>> {
    // Convert timestamp (ms) → Datetime so we can extract year/month/day
    let df_with_part = df
        .lazy()
        .with_column(
            col("timestamp")
                .cast(DataType::Datetime(TimeUnit::Milliseconds, None))
                .alias("datetime"),
        )
        .with_columns([
            col("datetime")
                .dt()
                .year()
                .cast(DataType::Int32)
                .alias("year"),
            col("datetime")
                .dt()
                .month()
                .cast(DataType::UInt32)
                .alias("month"),
            col("datetime")
                .dt()
                .day()
                .cast(DataType::UInt32)
                .alias("day"),
        ])
        .collect()?;

    let partitions = df_with_part.partition_by(["year", "month", "day"], true)?;

    Ok(partitions)
}

/// Core Hive partitioning logic
fn write_hive_partitioned_parquet(df: DataFrame, base_path: &Path) -> Result<()> {
    let partitions = build_partitions(df)?;

    for part_df in partitions {
        if part_df.height() == 0 {
            continue;
        }

        let year = part_df.column("year")?.i32()?.get(0).unwrap_or(0);
        let month = part_df.column("month")?.u32()?.get(0).unwrap_or(0);
        let day = part_df.column("day")?.u32()?.get(0).unwrap_or(0);

        let partition_dir = base_path
            .join(format!("year={:04}", year))
            .join(format!("month={:02}", month))
            .join(format!("day={:02}", day));

        fs::create_dir_all(&partition_dir)?;

        let file_path = partition_dir.join("data.parquet");

        let mut final_df = part_df.drop_many(["year", "month", "day", "datetime"]);

        let mut file = std::fs::File::create(file_path)?;
        ParquetWriter::new(&mut file)
            .with_compression(ParquetCompression::Zstd(None))
            .with_statistics(StatisticsOptions::full())
            .finish(&mut final_df)?;
    }

    Ok(())
}

/// Returns existing Hive day-partition Parquet files overlapping a millisecond range.
pub fn partition_files_for_range(dataset_root: &Path, start_ms: i64, end_ms: i64) -> Vec<PathBuf> {
    let Some(start_date) = utc_date_from_millis(start_ms) else {
        return Vec::new();
    };
    let Some(end_date) = utc_date_from_millis(end_ms) else {
        return Vec::new();
    };

    let (range_start, range_end) = if start_date <= end_date {
        (start_date, end_date)
    } else {
        (end_date, start_date)
    };

    let buffered_start = range_start - chrono::Duration::days(PARTITION_DAY_BUFFER);
    let buffered_end = range_end + chrono::Duration::days(PARTITION_DAY_BUFFER);

    let mut paths = Vec::new();
    let mut current = buffered_start;

    while current <= buffered_end {
        let path = partition_file_path(dataset_root, current);
        if path.is_file() {
            paths.push(path);
        }
        current += chrono::Duration::days(1);
    }

    paths
}

fn utc_date_from_millis(timestamp_ms: i64) -> Option<NaiveDate> {
    DateTime::<Utc>::from_timestamp_millis(timestamp_ms).map(|dt| dt.date_naive())
}

fn partition_file_path(dataset_root: &Path, date: NaiveDate) -> PathBuf {
    dataset_root
        .join(format!("year={:04}", date.year()))
        .join(format!("month={:02}", date.month()))
        .join(format!("day={:02}", date.day()))
        .join("data.parquet")
}

fn dataset_glob_pattern(dataset_root: &Path) -> Result<String> {
    dataset_root
        .join("year=*")
        .join("month=*")
        .join("day=*")
        .join("data.parquet")
        .to_str()
        .map(str::to_string)
        .ok_or(Error::InvalidGlob)
}

fn scan_dataset_parquet(
    dataset_root: &Path,
    start_time: Option<i64>,
    end_time: Option<i64>,
) -> Result<LazyFrame> {
    match (start_time, end_time) {
        (Some(start), Some(end)) => {
            let paths = partition_files_for_range(dataset_root, start, end);
            scan_parquet_paths(&paths)
        }
        _ => {
            let glob = dataset_glob_pattern(dataset_root)?;
            Ok(LazyFrame::scan_parquet(
                PlRefPath::new(glob.as_str()),
                Default::default(),
            )?)
        }
    }
}

fn scan_parquet_paths(paths: &[PathBuf]) -> Result<LazyFrame> {
    if paths.is_empty() {
        return Ok(DataFrame::empty().lazy());
    }

    if paths.len() == 1 {
        let path = PlRefPath::try_from_path(&paths[0]).map_err(Error::Polars)?;
        return Ok(LazyFrame::scan_parquet(path, Default::default())?);
    }

    let refs = paths
        .iter()
        .map(|path| PlRefPath::try_from_path(path))
        .collect::<std::result::Result<Buffer<_>, _>>()
        .map_err(Error::Polars)?;

    Ok(LazyFrame::scan_parquet_files(refs, Default::default())?)
}

fn apply_time_filters(
    mut lf: LazyFrame,
    start_time: Option<i64>,
    end_time: Option<i64>,
) -> LazyFrame {
    if let Some(st) = start_time {
        lf = lf.filter(col("timestamp").gt_eq(lit(st)));
    }
    if let Some(et) = end_time {
        lf = lf.filter(col("timestamp").lt_eq(lit(et)));
    }
    lf
}

/// Loads 1min candles from the Hive-partitioned Parquet files.
///
/// - If the directory doesn't exist → returns `Error::DatasetNotFound`
/// - Supports optional time range filter (predicate push-down + Parquet statistics)
/// - Returns candles **sorted by timestamp**
pub fn load_candles(
    base_dir: impl AsRef<Path>,
    exchange: &str,
    category: &str,
    symbol: &str,
    interval: &str,
    start_time: Option<i64>,
    end_time: Option<i64>,
    limit: Option<usize>,
) -> Result<Vec<Candle>> {
    let base = base_dir.as_ref();

    let symbol_path = base
        .join(exchange)
        .join(category)
        .join(symbol)
        .join(interval);

    if !symbol_path.exists() {
        return Err(Error::DatasetNotFound);
    }

    let mut lf = scan_dataset_parquet(&symbol_path, start_time, end_time)?;
    lf = apply_time_filters(lf, start_time, end_time);

    lf = lf.sort(
        ["timestamp"],
        SortMultipleOptions::default().with_order_descending(false),
    );

    if let Some(lim) = limit {
        lf = lf.tail(lim as u32);
    }

    let df = lf.collect()?;

    dataframe_to_candles(df)
}

fn dataframe_to_candles(df: DataFrame) -> Result<Vec<Candle>> {
    if df.height() == 0 {
        return Ok(vec![]);
    }

    // check for null values
    let null_counts = df.null_count();

    for name in null_counts.get_column_names() {
        let series = null_counts.column(name)?;
        let count: u32 = series.u32()?.get(0).unwrap_or(0);

        if count > 0 {
            return Err(Error::NullValues {
                name: name.to_string(),
                count,
            });
        }
    }

    // into_no_null_iter() is safe here
    let timestamps: Vec<i64> = df
        .column("timestamp")?
        .cast(&DataType::Int64)?
        .i64()?
        .into_no_null_iter()
        .collect();
    let opens: Vec<f64> = df.column("open")?.f64()?.into_no_null_iter().collect();
    let highs: Vec<f64> = df.column("high")?.f64()?.into_no_null_iter().collect();
    let lows: Vec<f64> = df.column("low")?.f64()?.into_no_null_iter().collect();
    let closes: Vec<f64> = df.column("close")?.f64()?.into_no_null_iter().collect();
    let volumes: Vec<f64> = df.column("volume")?.f64()?.into_no_null_iter().collect();

    let mut candles = Vec::with_capacity(df.height());

    for i in 0..df.height() {
        candles.push(Candle {
            timestamp: timestamps[i],
            open: opens[i],
            high: highs[i],
            low: lows[i],
            close: closes[i],
            volume: volumes[i],
        });
    }

    Ok(candles)
}

/// Returns the earliest and latest timestamps (milliseconds) stored for a dataset.
///
/// Returns `None` if the directory doesn't exist or contains no rows.
pub fn dataset_time_bounds(
    base_dir: impl AsRef<Path>,
    exchange: &str,
    category: &str,
    symbol: &str,
    interval: &str,
) -> Result<Option<(i64, i64)>> {
    let base = base_dir.as_ref();

    let symbol_path = base
        .join(exchange)
        .join(category)
        .join(symbol)
        .join(interval);

    if !symbol_path.exists() {
        return Ok(None);
    }

    let glob = dataset_glob_pattern(&symbol_path)?;
    let lf = LazyFrame::scan_parquet(PlRefPath::new(glob.as_str()), Default::default())?;

    let stats_df = lf
        .select([
            col("timestamp").min().alias("from"),
            col("timestamp").max().alias("to"),
        ])
        .collect()?;

    let from = stats_df.column("from")?.i64()?.get(0);
    let to = stats_df.column("to")?.i64()?.get(0);

    match (from, to) {
        (Some(from), Some(to)) => Ok(Some((from, to))),
        _ => Ok(None),
    }
}

/// Returns the timestamp (in milliseconds) of the **most recent** candle
/// already stored in the Hive-partitioned Parquet files for this symbol.
///
/// Returns `None` if the directory doesn't exist yet (first download).
pub fn last_candle_timestamp_in_parquet(
    base_dir: impl AsRef<Path>,
    exchange: &str,
    category: &str,
    symbol: &str,
    interval: &str,
) -> Result<Option<i64>> {
    let base = base_dir.as_ref();

    let symbol_path = base
        .join(exchange)
        .join(category)
        .join(symbol)
        .join(interval);

    if !symbol_path.exists() {
        return Ok(None);
    }

    let glob = dataset_glob_pattern(&symbol_path)?;

    // This is the exact type Polars expects
    let lf = LazyFrame::scan_parquet(PlRefPath::new(glob.as_str()), Default::default())?;

    let df = lf
        .select([col("timestamp").max().alias("max_ts")])
        .collect()?;

    let max_ts = df.column("max_ts")?.i64()?.get(0);

    Ok(max_ts)
}

fn interval_to_polars_duration(interval: Interval) -> Duration {
    match interval {
        Interval::Second(n) => Duration::parse(&format!("{}s", n)),
        Interval::Minute(n) => Duration::parse(&format!("{}m", n)),
        Interval::Hour(n) => Duration::parse(&format!("{}h", n)),
        Interval::Day(n) => Duration::parse(&format!("{}d", n)),
        Interval::Week(n) => Duration::parse(&format!("{}w", n)),
        Interval::Month(n) => Duration::parse(&format!("{}mo", n)),
        Interval::Year(n) => Duration::parse(&format!("{}y", n)),
    }
}

/// Downsamples 1-minute candles to any target timeframe using your `Interval` enum.
pub fn resample_candles(df: DataFrame, target_interval: Interval) -> Result<DataFrame> {
    if df.height() == 0 {
        return Ok(df);
    }

    let every = interval_to_polars_duration(target_interval);

    let resampled = df
        .lazy()
        .sort(
            ["timestamp"],
            SortMultipleOptions::default().with_order_descending(false),
        )
        .with_column(
            col("timestamp")
                .cast(DataType::Datetime(TimeUnit::Milliseconds, None))
                .alias("datetime"),
        )
        .group_by_dynamic(
            col("datetime"),
            vec![], // no extra group keys
            DynamicGroupOptions {
                every,
                period: every,
                offset: Duration::parse("0ns"),
                label: Label::Left,
                include_boundaries: false,
                closed_window: ClosedWindow::Left,
                start_by: StartBy::WindowBound,
                ..Default::default()
            },
        )
        .agg([
            col("open").first().alias("open"),
            col("high").max().alias("high"),
            col("low").min().alias("low"),
            col("close").last().alias("close"),
            col("volume").sum().alias("volume"),
        ])
        .with_column(col("datetime").cast(DataType::Int64).alias("timestamp"))
        .select([
            col("timestamp"),
            col("open"),
            col("high"),
            col("low"),
            col("close"),
            col("volume"),
        ])
        .sort(
            vec!["timestamp"],
            SortMultipleOptions::default().with_order_descending(false),
        )
        .collect()?;

    Ok(resampled)
}

/// Load 1min candles from Hive-partitioned Parquet **and** resample to any target interval.
///
/// This reuses your existing Parquet scanning + filtering logic (just extract the DataFrame part
/// from `load_candles` into a small private helper if you want to avoid duplication).
pub fn load_resampled_candles(
    base_dir: impl AsRef<Path>,
    exchange: &str,
    category: &str,
    symbol: &str,
    target_interval: Interval, // ← your existing enum!
    start_time: Option<i64>,
    end_time: Option<i64>,
    limit: Option<usize>,
) -> Result<Vec<Candle>> {
    let base = base_dir.as_ref();
    let symbol_path = base.join(exchange).join(category).join(symbol).join("1min");

    if !symbol_path.exists() {
        return Err(Error::DatasetNotFound);
    }

    let mut lf = scan_dataset_parquet(&symbol_path, start_time, end_time)?;
    lf = apply_time_filters(lf, start_time, end_time);
    let df_1min = lf.collect()?;

    let mut df_resampled = resample_candles(df_1min, target_interval)?;

    if let Some(lim) = limit {
        df_resampled = df_resampled.tail(Some(lim));
    }

    dataframe_to_candles(df_resampled)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{TimeZone, Utc};
    use std::path::Path;
    use tempfile::TempDir;

    fn make_test_candles(n: usize, start_ts: i64) -> Vec<Candle> {
        (0..n)
            .map(|i| Candle {
                timestamp: start_ts + (i as i64 * 60_000),
                open: 100.0 + i as f64,
                high: 101.0 + i as f64,
                low: 99.0 + i as f64,
                close: 100.5 + i as f64,
                volume: 1_000.0,
            })
            .collect()
    }

    fn utc_ms(year: i32, month: u32, day: u32, hour: u32, minute: u32) -> i64 {
        Utc.with_ymd_and_hms(year, month, day, hour, minute, 0)
            .unwrap()
            .timestamp_millis()
    }

    #[test]
    fn partition_files_for_range_selects_only_overlapping_days() {
        let temp = TempDir::new().unwrap();
        let dataset_root = temp.path().join("bybit/spot/BTCUSDT/1min");

        let day_one_start = utc_ms(2024, 6, 8, 0, 0);
        let day_two_start = utc_ms(2024, 6, 9, 0, 0);
        let day_three_start = utc_ms(2024, 6, 10, 0, 0);

        write_candles_partitioned(
            &make_test_candles(10, day_one_start),
            "bybit",
            "spot",
            "BTCUSDT",
            "1min",
            temp.path(),
        )
        .unwrap();
        write_candles_partitioned(
            &make_test_candles(10, day_two_start),
            "bybit",
            "spot",
            "BTCUSDT",
            "1min",
            temp.path(),
        )
        .unwrap();
        write_candles_partitioned(
            &make_test_candles(10, day_three_start),
            "bybit",
            "spot",
            "BTCUSDT",
            "1min",
            temp.path(),
        )
        .unwrap();

        let paths = partition_files_for_range(
            &dataset_root,
            utc_ms(2024, 6, 9, 1, 0),
            utc_ms(2024, 6, 9, 2, 0),
        );

        assert_eq!(paths.len(), 3);
        let rendered: Vec<String> = paths
            .iter()
            .map(|path| path.to_string_lossy().into_owned())
            .collect();
        assert!(rendered.iter().any(|path| path.contains("day=08")));
        assert!(rendered.iter().any(|path| path.contains("day=09")));
        assert!(rendered.iter().any(|path| path.contains("day=10")));
    }

    #[test]
    fn load_candles_uses_partition_pruning_for_bounded_queries() {
        let temp = TempDir::new().unwrap();

        let day_one_start = utc_ms(2024, 6, 8, 0, 0);
        let day_two_start = utc_ms(2024, 6, 9, 0, 0);
        let day_three_start = utc_ms(2024, 6, 10, 0, 0);

        write_candles_partitioned(
            &make_test_candles(5, day_one_start),
            "bybit",
            "spot",
            "BTCUSDT",
            "1min",
            temp.path(),
        )
        .unwrap();
        write_candles_partitioned(
            &make_test_candles(5, day_two_start),
            "bybit",
            "spot",
            "BTCUSDT",
            "1min",
            temp.path(),
        )
        .unwrap();
        write_candles_partitioned(
            &make_test_candles(5, day_three_start),
            "bybit",
            "spot",
            "BTCUSDT",
            "1min",
            temp.path(),
        )
        .unwrap();

        let candles = load_candles(
            temp.path(),
            "bybit",
            "spot",
            "BTCUSDT",
            "1min",
            Some(day_two_start),
            Some(day_two_start + 4 * 60_000),
            None,
        )
        .unwrap();

        assert_eq!(candles.len(), 5);
        assert!(candles.iter().all(|c| c.timestamp >= day_two_start));
        assert!(
            candles
                .iter()
                .all(|c| c.timestamp <= day_two_start + 4 * 60_000)
        );
    }

    #[test]
    fn load_candles_returns_not_found_for_missing_dataset() {
        let err = load_candles(
            Path::new("/tmp/nonexistent-parquet-root"),
            "bybit",
            "spot",
            "NOPE",
            "1min",
            None,
            None,
            None,
        )
        .unwrap_err();

        assert!(matches!(err, Error::DatasetNotFound));
    }

    #[test]
    fn load_resampled_candles_returns_not_found_for_missing_dataset() {
        let err = load_resampled_candles(
            Path::new("/tmp/nonexistent-parquet-root"),
            "bybit",
            "spot",
            "NOPE",
            Interval::Hour(1),
            None,
            None,
            None,
        )
        .unwrap_err();

        assert!(matches!(err, Error::DatasetNotFound));
    }
}
