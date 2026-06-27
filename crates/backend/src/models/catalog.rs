pub use studio::catalog::IndicatorCatalog as IndicatorCatalogResponse;

#[cfg(test)]
mod tests {
    use super::*;
    use studio::registry::builtin_registry;

    #[test]
    fn serializes_normalized_indicator_catalog() {
        let registry = builtin_registry();
        let response = IndicatorCatalogResponse::from_registry(&registry);
        let json = serde_json::to_value(&response).unwrap();

        assert_eq!(json["indicators"].as_array().unwrap().len(), 1);

        let sma = &json["indicators"][0];
        assert_eq!(sma["kind"], "indicator.sma");
        assert_eq!(sma["inputs"][0]["type"], "number");
        assert_eq!(sma["inputs"][0]["series"], true);
        assert_eq!(sma["params"][0]["type"], "integer");
        assert_eq!(sma["params"][0]["default"], 20);
        assert_eq!(sma["params"][0]["min"], 1);
    }
}
