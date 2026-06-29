pub mod and;
pub mod common;
pub mod crossover;
pub mod crossunder;
pub mod gt;
pub mod lt;
pub mod or;

#[cfg(test)]
mod tests {
    use super::common::{
        compute_and, compute_crossover, compute_crossunder, compute_gt, compute_lt, compute_or,
    };

    #[test]
    fn crossover_true_only_when_fast_crosses_above_slow() {
        let fast = vec![
            None,
            Some(10.0),
            Some(10.0),
            Some(10.0),
            Some(15.0),
            Some(22.5),
        ];
        let slow = vec![
            None,
            None,
            Some(10.0),
            Some(10.0),
            Some(13.333_333_333_333_334),
            Some(18.333_333_333_333_332),
        ];

        let signal = compute_crossover(&fast, &slow);

        assert_eq!(signal.values.len(), 6);
        assert_eq!(signal.values[0], None);
        assert_eq!(signal.values[1], None);
        assert_eq!(signal.values[2], None);
        assert_eq!(signal.values[3], Some(false));
        assert_eq!(signal.values[4], Some(true));
        assert_eq!(signal.values[5], Some(false));
    }

    #[test]
    fn crossunder_true_only_when_fast_crosses_below_slow() {
        let fast = vec![
            None,
            Some(25.0),
            Some(25.0),
            Some(25.0),
            Some(25.0),
            Some(17.5),
            Some(7.5),
        ];
        let slow = vec![
            None,
            None,
            Some(25.0),
            Some(25.0),
            Some(25.0),
            Some(20.0),
            Some(13.333_333_333_333_334),
        ];

        let signal = compute_crossunder(&fast, &slow);

        assert_eq!(signal.values.len(), 7);
        assert_eq!(signal.values[0], None);
        assert_eq!(signal.values[1], None);
        assert_eq!(signal.values[2], None);
        assert_eq!(signal.values[3], Some(false));
        assert_eq!(signal.values[4], Some(false));
        assert_eq!(signal.values[5], Some(true));
        assert_eq!(signal.values[6], Some(false));
    }

    #[test]
    fn crossover_ignores_missing_values() {
        let fast = vec![None, Some(1.0), None, Some(3.0)];
        let slow = vec![None, Some(2.0), Some(2.0), Some(2.0)];

        let signal = compute_crossover(&fast, &slow);

        assert_eq!(signal.values, vec![None, None, None, None]);
    }

    #[test]
    fn gt_compares_series_elementwise() {
        let left = vec![None, Some(3.0), Some(2.0), Some(5.0)];
        let right = vec![None, Some(2.0), Some(2.0), Some(5.0)];

        let signal = compute_gt(&left, &right);

        assert_eq!(
            signal.values,
            vec![None, Some(true), Some(false), Some(false)]
        );
    }

    #[test]
    fn lt_compares_series_elementwise() {
        let left = vec![None, Some(1.0), Some(2.0), Some(5.0)];
        let right = vec![None, Some(2.0), Some(2.0), Some(5.0)];

        let signal = compute_lt(&left, &right);

        assert_eq!(
            signal.values,
            vec![None, Some(true), Some(false), Some(false)]
        );
    }

    #[test]
    fn and_combines_bool_series_elementwise() {
        let left = vec![None, Some(true), Some(true), Some(false)];
        let right = vec![None, Some(false), Some(true), Some(false)];

        let signal = compute_and(&left, &right);

        assert_eq!(
            signal.values,
            vec![None, Some(false), Some(true), Some(false)]
        );
    }

    #[test]
    fn or_combines_bool_series_elementwise() {
        let left = vec![None, Some(true), Some(false), Some(false)];
        let right = vec![None, Some(false), Some(true), Some(false)];

        let signal = compute_or(&left, &right);

        assert_eq!(
            signal.values,
            vec![None, Some(true), Some(true), Some(false)]
        );
    }
}
