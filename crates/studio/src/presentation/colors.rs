/// Ten hues spaced for legibility on a dark chart background (matches frontend pool).
pub const INDICATOR_COLOR_POOL: &[&str] = &[
    "#f59e0b",
    "#3b82f6",
    "#22c55e",
    "#ec4899",
    "#06b6d4",
    "#a855f7",
    "#f97316",
    "#eab308",
    "#14b8a6",
    "#f43f5e",
];

pub const LITERAL_LINE_COLOR: &str = "#a1a1aa";
pub const MARKER_COLOR_CROSSOVER: &str = "#22c55e";
pub const MARKER_COLOR_CROSSUNDER: &str = "#ef4444";
pub const MARKER_COLOR_DEFAULT: &str = "#a855f7";

pub fn indicator_color(index: usize) -> &'static str {
    INDICATOR_COLOR_POOL[index % INDICATOR_COLOR_POOL.len()]
}
