use serde::Deserialize;
use std::path::PathBuf;

#[derive(Debug, Deserialize, Clone)]
pub struct Config {
    pub server: ServerConfig,
    pub paths: PathsConfig,
    pub cors: CorsConfig,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Deserialize, Clone)]
pub struct PathsConfig {
    pub parquet_base_dir: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct CorsConfig {
    pub allowed_origins: Vec<String>,
}

impl Config {
    pub fn load() -> anyhow::Result<Self> {
        // Default config
        let mut builder = config::Config::builder().add_source(config::File::from(
            std::path::Path::new("config/defaults.toml"),
        ));

        // User config (optional)
        if let Some(config_dir) = dirs::config_dir() {
            let user_config = config_dir.join("agentic-quant-studio/config.toml");
            builder = builder.add_source(config::File::from(user_config).required(false));
        }

        // Env vars (highest prio)
        builder = builder.add_source(
            config::Environment::with_prefix("AGENTIC_QUANT_STUDIO")
                .separator("__")
                .try_parsing(true),
        );

        let config = builder.build()?.try_deserialize()?;
        Ok(config)
    }

    pub fn parquet_base_dir(&self) -> PathBuf {
        PathBuf::from(shellexpand::tilde(&self.paths.parquet_base_dir).into_owned())
    }
}
