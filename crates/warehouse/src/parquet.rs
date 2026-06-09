use crate::error::{Error, Result};
use common::types::{Candle, Interval};
use polars::prelude::*;
use polars_utils::pl_path::PlRefPath;
use std::fs;
use std::path::Path;

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

    let glob_pattern = symbol_path
        .join("year=*")
        .join("month=*")
        .join("day=*")
        .join("data.parquet");

    let glob_str = glob_pattern.to_str().ok_or(Error::InvalidGlob)?;

    let mut lf = LazyFrame::scan_parquet(PlRefPath::new(glob_str), Default::default())?;

    if let Some(st) = start_time {
        lf = lf.filter(col("timestamp").gt_eq(lit(st)));
    }
    if let Some(et) = end_time {
        lf = lf.filter(col("timestamp").lt_eq(lit(et)));
    }

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

    let glob_pattern = symbol_path
        .join("year=*")
        .join("month=*")
        .join("day=*")
        .join("data.parquet");

    let glob_str = glob_pattern.to_str().ok_or(Error::InvalidGlob)?;

    let lf = LazyFrame::scan_parquet(PlRefPath::new(glob_str), Default::default())?;

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

    let glob_pattern = symbol_path
        .join("year=*")
        .join("month=*")
        .join("day=*")
        .join("data.parquet");

    let glob_str = glob_pattern.to_str().ok_or(Error::InvalidGlob)?;

    // This is the exact type Polars expects
    let lf = LazyFrame::scan_parquet(PlRefPath::new(glob_str), Default::default())?;

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
    let df_1min = {
        let base = base_dir.as_ref();
        let symbol_path = base.join(exchange).join(category).join(symbol).join("1min"); // we always read the 1min folder

        if !symbol_path.exists() {
            return Err(Error::DatasetNotFound);
        }

        let glob_pattern = symbol_path
            .join("year=*")
            .join("month=*")
            .join("day=*")
            .join("data.parquet");

        let glob_str = glob_pattern.to_str().ok_or(Error::InvalidGlob)?;

        let mut lf = LazyFrame::scan_parquet(PlRefPath::new(glob_str), Default::default())?;

        if let Some(st) = start_time {
            lf = lf.filter(col("timestamp").gt_eq(lit(st)));
        }
        if let Some(et) = end_time {
            lf = lf.filter(col("timestamp").lt_eq(lit(et)));
        }

        lf.collect()?
    };

    let mut df_resampled = resample_candles(df_1min, target_interval)?;

    if let Some(lim) = limit {
        df_resampled = df_resampled.tail(Some(lim));
    }

    dataframe_to_candles(df_resampled)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

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
