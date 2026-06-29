pub use studio::catalog::IndicatorCatalog as IndicatorCatalogResponse;

#[cfg(test)]
mod tests {
    use super::*;
    use studio::registry::builtin_registry;

    fn indicator_entry<'a>(json: &'a serde_json::Value, kind: &str) -> &'a serde_json::Value {
        json["indicators"]
            .as_array()
            .unwrap_or_else(|| panic!("expected indicators array"))
            .iter()
            .find(|entry| entry["kind"] == kind)
            .unwrap_or_else(|| panic!("missing indicator kind: {kind}"))
    }

    #[test]
    fn serializes_normalized_indicator_catalog() {
        let registry = builtin_registry();
        let response = IndicatorCatalogResponse::from_registry(&registry);
        let json = serde_json::to_value(&response).unwrap();
        let indicators = json["indicators"].as_array().unwrap();

        assert_eq!(indicators.len(), 3);
        assert_eq!(indicators[0]["kind"], "indicator.ema");
        assert_eq!(indicators[1]["kind"], "indicator.rsi");
        assert_eq!(indicators[2]["kind"], "indicator.sma");

        let ema = indicator_entry(&json, "indicator.ema");
        assert_eq!(ema["inputs"][0]["type"], "number");
        assert_eq!(ema["inputs"][0]["series"], true);
        assert_eq!(ema["params"][0]["type"], "integer");
        assert_eq!(ema["params"][0]["default"], 20);
        assert_eq!(ema["params"][0]["min"], 1);

        let rsi = indicator_entry(&json, "indicator.rsi");
        assert_eq!(rsi["params"][0]["default"], 14);
        assert_eq!(rsi["chart_defaults"]["role"], "oscillator");
        assert_eq!(rsi["chart_defaults"]["value_range"]["max"], 100.0);
    }
}
