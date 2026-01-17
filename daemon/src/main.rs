use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;
use tonic::transport::Server;
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

mod auth;
mod config;
mod controllers;
mod http;
mod service;

use config::DaemonConfig;
use service::DaemonService;

pub mod daemon_proto {
    tonic::include_proto!("jarvis.daemon.v1");
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .with_file(true)
        .with_line_number(true)
        .finish();
    tracing::subscriber::set_global_default(subscriber)?;

    let config = DaemonConfig::default();
    info!("Starting JARVIS Desktop Daemon v{}", env!("CARGO_PKG_VERSION"));

    let screen_controller = Arc::new(RwLock::new(controllers::ScreenController::new()));
    let input_controller = Arc::new(RwLock::new(controllers::InputController::new()));
    let window_controller = Arc::new(RwLock::new(controllers::WindowController::new()));
    let file_controller = Arc::new(RwLock::new(controllers::FileController::new()));
    let process_controller = Arc::new(RwLock::new(controllers::ProcessController::new()));
    let auth_manager = Arc::new(auth::AuthManager::new(&config.jwt_secret));

    let grpc_service = DaemonService {
        config: Arc::new(config.clone()),
        auth: auth_manager.clone(),
        screen: screen_controller.clone(),
        input: input_controller.clone(),
        window: window_controller.clone(),
        file: file_controller.clone(),
        process: process_controller.clone(),
    };

    let http_state = http::AppState {
        config: Arc::new(config.clone()),
        auth: auth_manager,
        screen: screen_controller,
        input: input_controller,
        window: window_controller,
        file: file_controller,
        process: process_controller,
    };

    let grpc_addr: SocketAddr = config.bind_address.parse()?;
    let http_addr: SocketAddr = config.http_address.parse()?;

    info!("gRPC server binding to {}", grpc_addr);
    info!("HTTP server binding to {}", http_addr);

    let grpc_server = Server::builder()
        .add_service(daemon_proto::desktop_daemon_server::DesktopDaemonServer::new(grpc_service))
        .serve(grpc_addr);

    let http_router = http::create_router(http_state);
    let http_server = axum::serve(
        tokio::net::TcpListener::bind(http_addr).await?,
        http_router,
    );

    tokio::select! {
        res = grpc_server => {
            if let Err(e) = res {
                tracing::error!("gRPC server error: {}", e);
            }
        }
        res = http_server => {
            if let Err(e) = res {
                tracing::error!("HTTP server error: {}", e);
            }
        }
    }

    Ok(())
}
