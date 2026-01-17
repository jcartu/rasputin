use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DaemonConfig {
    pub bind_address: String,
    pub http_address: String,
    pub jwt_secret: String,
    pub allowed_paths: Vec<String>,
    pub blocked_paths: Vec<String>,
    pub max_file_size_mb: u64,
    pub rate_limit_per_second: u32,
}

impl Default for DaemonConfig {
    fn default() -> Self {
        Self {
            bind_address: std::env::var("JARVIS_DAEMON_GRPC_ADDR")
                .unwrap_or_else(|_| "127.0.0.1:50052".to_string()),
            http_address: std::env::var("JARVIS_DAEMON_HTTP_ADDR")
                .unwrap_or_else(|_| "127.0.0.1:50051".to_string()),
            jwt_secret: std::env::var("JARVIS_DAEMON_SECRET")
                .unwrap_or_else(|_| "change-me-in-production".to_string()),
            allowed_paths: vec![
                "/home".to_string(),
                "/tmp".to_string(),
                "/workspaces".to_string(),
            ],
            blocked_paths: vec![
                "/etc".to_string(),
                "/root".to_string(),
                "/sys".to_string(),
                "/proc".to_string(),
            ],
            max_file_size_mb: 100,
            rate_limit_per_second: 100,
        }
    }
}
