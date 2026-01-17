use std::sync::Arc;
use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use tower_http::cors::{Any, CorsLayer};

use crate::auth::AuthManager;
use crate::config::DaemonConfig;
use crate::controllers::{
    FileController, InputController, ProcessController, ScreenController, WindowController,
};
use crate::controllers::input::{ButtonAction, KeyAction, MouseButton};

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<DaemonConfig>,
    pub auth: Arc<AuthManager>,
    pub screen: Arc<RwLock<ScreenController>>,
    pub input: Arc<RwLock<InputController>>,
    pub window: Arc<RwLock<WindowController>>,
    pub file: Arc<RwLock<FileController>>,
    pub process: Arc<RwLock<ProcessController>>,
}

#[derive(Deserialize)]
pub struct Capability {
    pub token: String,
    pub scopes: Vec<String>,
    pub expires_at: i64,
    pub session_id: String,
    pub user_id: String,
}

#[derive(Serialize)]
pub struct StatusResponse {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
}

#[derive(Deserialize)]
pub struct TokenRequest {
    pub user_id: String,
    pub session_id: String,
    pub scopes: Vec<String>,
}

#[derive(Serialize)]
pub struct TokenResponse {
    pub token: String,
    pub scopes: Vec<String>,
    pub expires_at: i64,
    pub session_id: String,
    pub user_id: String,
}

#[derive(Deserialize)]
pub struct ScreenshotRequest {
    pub cap: Capability,
    #[serde(default)]
    pub display_id: Option<i32>,
    #[serde(default)]
    pub region: Option<RegionDto>,
    #[serde(default)]
    pub format: Option<String>,
    #[serde(default)]
    pub quality: Option<i32>,
}

#[derive(Deserialize)]
pub struct RegionDto {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Serialize)]
pub struct ScreenshotResponse {
    pub image_data: String,
    pub timestamp_ms: i64,
}

#[derive(Deserialize)]
pub struct MouseMoveRequest {
    pub cap: Capability,
    pub x: i32,
    pub y: i32,
    #[serde(default)]
    pub display_id: Option<i32>,
    #[serde(default)]
    pub relative: Option<bool>,
    #[serde(default)]
    pub duration_ms: Option<i32>,
}

#[derive(Deserialize)]
pub struct MouseButtonRequest {
    pub cap: Capability,
    #[serde(default)]
    pub button: Option<String>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub position: Option<PointDto>,
    #[serde(default)]
    pub display_id: Option<i32>,
}

#[derive(Deserialize)]
pub struct PointDto {
    pub x: i32,
    pub y: i32,
}

#[derive(Deserialize)]
pub struct MouseScrollRequest {
    pub cap: Capability,
    #[serde(default)]
    pub delta_x: i32,
    #[serde(default)]
    pub delta_y: i32,
    #[serde(default)]
    pub position: Option<PointDto>,
    #[serde(default)]
    pub display_id: Option<i32>,
}

#[derive(Deserialize)]
pub struct KeyboardKeyRequest {
    pub cap: Capability,
    pub key: String,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub modifiers: Option<Vec<String>>,
}

#[derive(Deserialize)]
pub struct KeyboardTypeRequest {
    pub cap: Capability,
    pub text: String,
    #[serde(default)]
    pub delay_ms: Option<i32>,
}

#[derive(Deserialize)]
pub struct ListWindowsRequest {
    pub cap: Capability,
    #[serde(default)]
    pub include_minimized: Option<bool>,
    #[serde(default)]
    pub include_hidden: Option<bool>,
    #[serde(default)]
    pub filter_app: Option<String>,
}

#[derive(Serialize)]
pub struct WindowDto {
    pub id: String,
    pub title: String,
    pub app_name: String,
    pub process_name: String,
    pub pid: i32,
    pub bounds: BoundsDto,
    pub focused: bool,
    pub minimized: bool,
    pub maximized: bool,
    pub display_id: i32,
}

#[derive(Serialize)]
pub struct BoundsDto {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Serialize)]
pub struct ListWindowsResponse {
    pub windows: Vec<WindowDto>,
}

#[derive(Deserialize)]
pub struct FocusWindowRequest {
    pub cap: Capability,
    pub window_id: String,
}

#[derive(Deserialize)]
pub struct ShellExecRequest {
    pub cap: Capability,
    pub command: String,
    #[serde(default)]
    pub working_dir: Option<String>,
    #[serde(default)]
    pub env: Option<std::collections::HashMap<String, String>>,
    #[serde(default)]
    pub timeout_seconds: Option<u32>,
}

#[derive(Serialize)]
pub struct ShellExecResponse {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: i64,
}

#[derive(Deserialize)]
pub struct StartProcessRequest {
    pub cap: Capability,
    pub command: String,
    #[serde(default)]
    pub args: Option<Vec<String>>,
    #[serde(default)]
    pub working_dir: Option<String>,
    #[serde(default)]
    pub env: Option<std::collections::HashMap<String, String>>,
    #[serde(default)]
    pub detached: Option<bool>,
}

#[derive(Serialize)]
pub struct StartProcessResponse {
    pub pid: i32,
}

#[derive(Deserialize)]
pub struct ListProcessesRequest {
    pub cap: Capability,
    #[serde(default)]
    pub filter_name: Option<String>,
    #[serde(default)]
    pub filter_user: Option<String>,
}

#[derive(Serialize)]
pub struct ProcessDto {
    pub pid: i32,
    pub ppid: i32,
    pub name: String,
    pub cmdline: String,
    pub user: String,
    pub cpu_percent: f32,
    pub memory_bytes: i64,
    pub started_ms: i64,
    pub status: String,
}

#[derive(Serialize)]
pub struct ListProcessesResponse {
    pub processes: Vec<ProcessDto>,
}

#[derive(Serialize)]
pub struct DisplayDto {
    pub id: i32,
    pub name: String,
    pub width: i32,
    pub height: i32,
    pub scale: f32,
    pub primary: bool,
}

#[derive(Serialize)]
pub struct ListDisplaysResponse {
    pub displays: Vec<DisplayDto>,
}

#[derive(Deserialize)]
pub struct ListDisplaysRequest {
    pub cap: Capability,
}

#[derive(Deserialize)]
pub struct GetClipboardRequest {
    pub cap: Capability,
}

#[derive(Serialize)]
pub struct GetClipboardResponse {
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub image: Option<String>,
    pub mime_type: String,
}

#[derive(Deserialize)]
pub struct SetClipboardRequest {
    pub cap: Capability,
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub image: Option<String>,
}

pub fn create_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/health", get(health))
        .route("/auth/token", post(create_token))
        .route("/screen/list", post(list_displays))
        .route("/screen/screenshot", post(screenshot))
        .route("/input/mouse/move", post(mouse_move))
        .route("/input/mouse/button", post(mouse_button))
        .route("/input/mouse/scroll", post(mouse_scroll))
        .route("/input/keyboard/key", post(keyboard_key))
        .route("/input/keyboard/type", post(keyboard_type))
        .route("/window/list", post(list_windows))
        .route("/window/focus", post(focus_window))
        .route("/process/shell", post(shell_exec))
        .route("/process/start", post(start_process))
        .route("/process/list", post(list_processes))
        .route("/clipboard/get", post(get_clipboard))
        .route("/clipboard/set", post(set_clipboard))
        .layer(cors)
        .with_state(state)
}

async fn health() -> &'static str {
    "OK"
}

async fn create_token(
    State(state): State<AppState>,
    Json(req): Json<TokenRequest>,
) -> Json<TokenResponse> {
    let token = state.auth.create_token(&req.user_id, &req.session_id, &req.scopes);
    let expires_at = chrono::Utc::now().timestamp_millis() + 3600_000;
    Json(TokenResponse {
        token,
        scopes: req.scopes,
        expires_at,
        session_id: req.session_id,
        user_id: req.user_id,
    })
}

fn verify_cap(state: &AppState, cap: &Capability) -> Result<(), (StatusCode, String)> {
    state.auth.verify(&cap.token)
        .map_err(|e| (StatusCode::UNAUTHORIZED, e.to_string()))
}

async fn list_displays(
    State(state): State<AppState>,
    Json(req): Json<ListDisplaysRequest>,
) -> Result<Json<ListDisplaysResponse>, (StatusCode, String)> {
    verify_cap(&state, &req.cap)?;
    let ctrl = state.screen.read().await;
    let displays = ctrl.list_displays()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(ListDisplaysResponse {
        displays: displays.into_iter().map(|d| DisplayDto {
            id: d.id,
            name: d.name,
            width: d.width,
            height: d.height,
            scale: d.scale,
            primary: d.primary,
        }).collect(),
    }))
}

async fn screenshot(
    State(state): State<AppState>,
    Json(req): Json<ScreenshotRequest>,
) -> Result<Json<ScreenshotResponse>, (StatusCode, String)> {
    verify_cap(&state, &req.cap)?;
    let ctrl = state.screen.read().await;
    let region = req.region.map(|r| crate::controllers::screen::Rect {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
    });
    let data = ctrl.screenshot(req.display_id.unwrap_or(0), region)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(ScreenshotResponse {
        image_data: base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &data),
        timestamp_ms: chrono::Utc::now().timestamp_millis(),
    }))
}

async fn mouse_move(
    State(state): State<AppState>,
    Json(req): Json<MouseMoveRequest>,
) -> Result<Json<StatusResponse>, (StatusCode, String)> {
    verify_cap(&state, &req.cap)?;
    let ctrl = state.input.read().await;
    ctrl.mouse_move(req.x, req.y, req.relative.unwrap_or(false))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(StatusResponse {
        success: true,
        message: "OK".to_string(),
        error_code: None,
    }))
}

async fn mouse_button(
    State(state): State<AppState>,
    Json(req): Json<MouseButtonRequest>,
) -> Result<Json<StatusResponse>, (StatusCode, String)> {
    verify_cap(&state, &req.cap)?;
    let button = match req.button.as_deref() {
        Some("right") => MouseButton::Right,
        Some("middle") => MouseButton::Middle,
        _ => MouseButton::Left,
    };
    let action = match req.action.as_deref() {
        Some("press") => ButtonAction::Press,
        Some("release") => ButtonAction::Release,
        Some("double_click") => ButtonAction::DoubleClick,
        _ => ButtonAction::Click,
    };
    let ctrl = state.input.read().await;
    ctrl.mouse_button(button, action)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(StatusResponse {
        success: true,
        message: "OK".to_string(),
        error_code: None,
    }))
}

async fn mouse_scroll(
    State(state): State<AppState>,
    Json(req): Json<MouseScrollRequest>,
) -> Result<Json<StatusResponse>, (StatusCode, String)> {
    verify_cap(&state, &req.cap)?;
    let ctrl = state.input.read().await;
    ctrl.mouse_scroll(req.delta_x, req.delta_y)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(StatusResponse {
        success: true,
        message: "OK".to_string(),
        error_code: None,
    }))
}

async fn keyboard_key(
    State(state): State<AppState>,
    Json(req): Json<KeyboardKeyRequest>,
) -> Result<Json<StatusResponse>, (StatusCode, String)> {
    verify_cap(&state, &req.cap)?;
    let action = match req.action.as_deref() {
        Some("press") => KeyAction::Press,
        Some("release") => KeyAction::Release,
        _ => KeyAction::Tap,
    };
    let ctrl = state.input.read().await;
    ctrl.keyboard_key(&req.key, action)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(StatusResponse {
        success: true,
        message: "OK".to_string(),
        error_code: None,
    }))
}

async fn keyboard_type(
    State(state): State<AppState>,
    Json(req): Json<KeyboardTypeRequest>,
) -> Result<Json<StatusResponse>, (StatusCode, String)> {
    verify_cap(&state, &req.cap)?;
    let ctrl = state.input.read().await;
    ctrl.keyboard_type(&req.text, req.delay_ms.unwrap_or(0))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(StatusResponse {
        success: true,
        message: "OK".to_string(),
        error_code: None,
    }))
}

async fn list_windows(
    State(state): State<AppState>,
    Json(req): Json<ListWindowsRequest>,
) -> Result<Json<ListWindowsResponse>, (StatusCode, String)> {
    verify_cap(&state, &req.cap)?;
    let ctrl = state.window.read().await;
    let windows = ctrl.list_windows(req.include_minimized.unwrap_or(false))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(ListWindowsResponse {
        windows: windows.into_iter().map(|w| WindowDto {
            id: w.id,
            title: w.title,
            app_name: w.app_name,
            process_name: w.process_name,
            pid: w.pid,
            bounds: BoundsDto {
                x: w.x,
                y: w.y,
                width: w.width,
                height: w.height,
            },
            focused: w.focused,
            minimized: w.minimized,
            maximized: w.maximized,
            display_id: w.display_id,
        }).collect(),
    }))
}

async fn focus_window(
    State(state): State<AppState>,
    Json(req): Json<FocusWindowRequest>,
) -> Result<Json<StatusResponse>, (StatusCode, String)> {
    verify_cap(&state, &req.cap)?;
    let ctrl = state.window.read().await;
    ctrl.focus_window(&req.window_id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(StatusResponse {
        success: true,
        message: "OK".to_string(),
        error_code: None,
    }))
}

async fn shell_exec(
    State(state): State<AppState>,
    Json(req): Json<ShellExecRequest>,
) -> Result<Json<ShellExecResponse>, (StatusCode, String)> {
    verify_cap(&state, &req.cap)?;
    let ctrl = state.process.read().await;
    let result = ctrl.shell_exec(
        &req.command,
        req.working_dir.as_deref(),
        &req.env.unwrap_or_default(),
        req.timeout_seconds.unwrap_or(60),
    ).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(ShellExecResponse {
        exit_code: result.exit_code,
        stdout: String::from_utf8_lossy(&result.stdout).to_string(),
        stderr: String::from_utf8_lossy(&result.stderr).to_string(),
        duration_ms: result.duration_ms,
    }))
}

async fn start_process(
    State(state): State<AppState>,
    Json(req): Json<StartProcessRequest>,
) -> Result<Json<StartProcessResponse>, (StatusCode, String)> {
    verify_cap(&state, &req.cap)?;
    let ctrl = state.process.read().await;
    let pid = ctrl.start_process(
        &req.command,
        &req.args.unwrap_or_default(),
        req.working_dir.as_deref(),
        &req.env.unwrap_or_default(),
        req.detached.unwrap_or(false),
    ).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(StartProcessResponse { pid }))
}

async fn list_processes(
    State(state): State<AppState>,
    Json(req): Json<ListProcessesRequest>,
) -> Result<Json<ListProcessesResponse>, (StatusCode, String)> {
    verify_cap(&state, &req.cap)?;
    let ctrl = state.process.read().await;
    let processes = ctrl.list_processes()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(ListProcessesResponse {
        processes: processes.into_iter().map(|p| ProcessDto {
            pid: p.pid,
            ppid: p.ppid,
            name: p.name,
            cmdline: p.cmdline,
            user: p.user,
            cpu_percent: p.cpu_percent,
            memory_bytes: p.memory_bytes,
            started_ms: p.started_ms,
            status: p.status,
        }).collect(),
    }))
}

async fn get_clipboard(
    State(state): State<AppState>,
    Json(req): Json<GetClipboardRequest>,
) -> Result<Json<GetClipboardResponse>, (StatusCode, String)> {
    verify_cap(&state, &req.cap)?;
    Ok(Json(GetClipboardResponse {
        text: String::new(),
        image: None,
        mime_type: String::new(),
    }))
}

async fn set_clipboard(
    State(state): State<AppState>,
    Json(req): Json<SetClipboardRequest>,
) -> Result<Json<StatusResponse>, (StatusCode, String)> {
    verify_cap(&state, &req.cap)?;
    Ok(Json(StatusResponse {
        success: true,
        message: "OK".to_string(),
        error_code: None,
    }))
}
