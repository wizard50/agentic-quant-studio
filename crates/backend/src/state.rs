use crate::config::Config;

/// Shared application state injected into every Axum handler
#[derive(Clone)]
pub struct AppState {
    pub config: Config,
}
