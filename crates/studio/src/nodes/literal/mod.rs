pub mod bool;
pub mod common;
pub mod number;

#[cfg(test)]
mod tests {
    use super::common::{broadcast_bool, broadcast_f64};

    #[test]
    fn broadcast_f64_matches_reference_length() {
        let reference = crate::runtime::value::SeriesI64 {
            values: vec![Some(1), Some(2), None],
        };

        let series = broadcast_f64(&reference, 30.0);

        assert_eq!(series.values, vec![Some(30.0), Some(30.0), Some(30.0)]);
    }

    #[test]
    fn broadcast_bool_matches_reference_length() {
        let reference = crate::runtime::value::SeriesI64 {
            values: vec![Some(1), None],
        };

        let series = broadcast_bool(&reference, true);

        assert_eq!(series.values, vec![Some(true), Some(true)]);
    }
}
