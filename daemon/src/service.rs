use std::sync::Arc;
use tokio::sync::RwLock;
use tonic::{Request, Response, Status};

use crate::auth::AuthManager;
use crate::config::DaemonConfig;
use crate::controllers::{
    FileController, InputController, ProcessController, ScreenController, WindowController,
};
use crate::daemon_proto::{
    desktop_daemon_server::DesktopDaemon, Empty, FocusWindowRequest, GetClipboardRequest,
    GetClipboardResponse, KeyboardKeyRequest, KeyboardTypeRequest, KillProcessRequest,
    ListDisplaysRequest, ListDisplaysResponse, ListFilesRequest, ListFilesResponse,
    ListProcessesRequest, ListProcessesResponse, ListWindowsRequest, ListWindowsResponse,
    MouseButtonRequest, MouseMoveRequest, MouseScrollRequest, ReadFileRequest, ReadFileResponse,
    Screenshot, ScreenshotRequest, SetClipboardRequest, ShellExecRequest, ShellExecResponse,
    StartProcessRequest, StartProcessResponse, WriteFileRequest,
};
use crate::daemon_proto::{Display, FileInfo, ProcessInfo, Rect, Window};

pub struct DaemonService {
    pub config: Arc<DaemonConfig>,
    pub auth: Arc<AuthManager>,
    pub screen: Arc<RwLock<ScreenController>>,
    pub input: Arc<RwLock<InputController>>,
    pub window: Arc<RwLock<WindowController>>,
    pub file: Arc<RwLock<FileController>>,
    pub process: Arc<RwLock<ProcessController>>,
}

impl DaemonService {
    fn verify_cap(&self, cap: Option<&crate::daemon_proto::Capability>) -> Result<(), Status> {
        let cap = cap.ok_or_else(|| Status::unauthenticated("Missing capability token"))?;
        self.auth
            .verify(&cap.token)
            .map_err(|e| Status::unauthenticated(format!("Invalid token: {}", e)))?;
        Ok(())
    }
}

#[tonic::async_trait]
impl DesktopDaemon for DaemonService {
    async fn list_displays(
        &self,
        request: Request<ListDisplaysRequest>,
    ) -> Result<Response<ListDisplaysResponse>, Status> {
        let req = request.into_inner();
        self.verify_cap(req.cap.as_ref())?;

        let ctrl = self.screen.read().await;
        let displays = ctrl
            .list_displays()
            .map_err(|e| Status::internal(e.to_string()))?;

        let proto_displays: Vec<Display> = displays
            .into_iter()
            .map(|d| Display {
                id: d.id,
                name: d.name,
                width: d.width,
                height: d.height,
                scale: d.scale,
                primary: d.primary,
            })
            .collect();

        Ok(Response::new(ListDisplaysResponse {
            displays: proto_displays,
        }))
    }

    async fn screenshot(
        &self,
        request: Request<ScreenshotRequest>,
    ) -> Result<Response<Screenshot>, Status> {
        let req = request.into_inner();
        self.verify_cap(req.cap.as_ref())?;

        let ctrl = self.screen.read().await;
        let region = req.region.map(|r| crate::controllers::screen::Rect {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
        });

        let image_data = ctrl
            .screenshot(req.display_id, region)
            .map_err(|e| Status::internal(e.to_string()))?;

        Ok(Response::new(Screenshot {
            image_data,
            timestamp_ms: chrono::Utc::now().timestamp_millis(),
            display: None,
            captured_region: None,
        }))
    }

    async fn mouse_move(
        &self,
        request: Request<MouseMoveRequest>,
    ) -> Result<Response<crate::daemon_proto::Status>, Status> {
        let req = request.into_inner();
        self.verify_cap(req.cap.as_ref())?;

        let ctrl = self.input.read().await;
        ctrl.mouse_move(req.x, req.y, req.relative)
            .map_err(|e| Status::internal(e.to_string()))?;

        Ok(Response::new(crate::daemon_proto::Status {
            success: true,
            message: "OK".to_string(),
            error_code: String::new(),
        }))
    }

    async fn mouse_button(
        &self,
        request: Request<MouseButtonRequest>,
    ) -> Result<Response<crate::daemon_proto::Status>, Status> {
        let req = request.into_inner();
        self.verify_cap(req.cap.as_ref())?;

        use crate::daemon_proto::mouse_button_request::{Action as ProtoButtonAction, Button as ProtoButton};
        use crate::controllers::input::{ButtonAction, MouseButton};

        let button = match ProtoButton::try_from(req.button) {
            Ok(ProtoButton::Left) => MouseButton::Left,
            Ok(ProtoButton::Right) => MouseButton::Right,
            Ok(ProtoButton::Middle) => MouseButton::Middle,
            Err(_) => MouseButton::Left,
        };

        let action = match ProtoButtonAction::try_from(req.action) {
            Ok(ProtoButtonAction::Press) => ButtonAction::Press,
            Ok(ProtoButtonAction::Release) => ButtonAction::Release,
            Ok(ProtoButtonAction::Click) => ButtonAction::Click,
            Ok(ProtoButtonAction::DoubleClick) => ButtonAction::DoubleClick,
            Err(_) => ButtonAction::Click,
        };

        let ctrl = self.input.read().await;
        ctrl.mouse_button(button, action)
            .map_err(|e| Status::internal(e.to_string()))?;

        Ok(Response::new(crate::daemon_proto::Status {
            success: true,
            message: "OK".to_string(),
            error_code: String::new(),
        }))
    }

    async fn mouse_scroll(
        &self,
        request: Request<MouseScrollRequest>,
    ) -> Result<Response<crate::daemon_proto::Status>, Status> {
        let req = request.into_inner();
        self.verify_cap(req.cap.as_ref())?;

        let ctrl = self.input.read().await;
        ctrl.mouse_scroll(req.delta_x, req.delta_y)
            .map_err(|e| Status::internal(e.to_string()))?;

        Ok(Response::new(crate::daemon_proto::Status {
            success: true,
            message: "OK".to_string(),
            error_code: String::new(),
        }))
    }

    async fn keyboard_key(
        &self,
        request: Request<KeyboardKeyRequest>,
    ) -> Result<Response<crate::daemon_proto::Status>, Status> {
        let req = request.into_inner();
        self.verify_cap(req.cap.as_ref())?;

        use crate::daemon_proto::keyboard_key_request::Action as ProtoKeyAction;
        use crate::controllers::input::KeyAction;

        let action = match ProtoKeyAction::try_from(req.action) {
            Ok(ProtoKeyAction::Press) => KeyAction::Press,
            Ok(ProtoKeyAction::Release) => KeyAction::Release,
            Ok(ProtoKeyAction::Tap) => KeyAction::Tap,
            Err(_) => KeyAction::Tap,
        };

        let ctrl = self.input.read().await;
        ctrl.keyboard_key(&req.key, action)
            .map_err(|e| Status::internal(e.to_string()))?;

        Ok(Response::new(crate::daemon_proto::Status {
            success: true,
            message: "OK".to_string(),
            error_code: String::new(),
        }))
    }

    async fn keyboard_type(
        &self,
        request: Request<KeyboardTypeRequest>,
    ) -> Result<Response<crate::daemon_proto::Status>, Status> {
        let req = request.into_inner();
        self.verify_cap(req.cap.as_ref())?;

        let ctrl = self.input.read().await;
        ctrl.keyboard_type(&req.text, req.delay_ms)
            .map_err(|e| Status::internal(e.to_string()))?;

        Ok(Response::new(crate::daemon_proto::Status {
            success: true,
            message: "OK".to_string(),
            error_code: String::new(),
        }))
    }

    async fn list_windows(
        &self,
        request: Request<ListWindowsRequest>,
    ) -> Result<Response<ListWindowsResponse>, Status> {
        let req = request.into_inner();
        self.verify_cap(req.cap.as_ref())?;

        let ctrl = self.window.read().await;
        let windows = ctrl
            .list_windows(req.include_minimized)
            .map_err(|e| Status::internal(e.to_string()))?;

        let proto_windows: Vec<Window> = windows
            .into_iter()
            .map(|w| Window {
                id: w.id,
                title: w.title,
                app_name: w.app_name,
                process_name: w.process_name,
                pid: w.pid,
                bounds: Some(Rect {
                    x: w.x,
                    y: w.y,
                    width: w.width,
                    height: w.height,
                }),
                focused: w.focused,
                minimized: w.minimized,
                maximized: w.maximized,
                display_id: w.display_id,
            })
            .collect();

        Ok(Response::new(ListWindowsResponse {
            windows: proto_windows,
        }))
    }

    async fn focus_window(
        &self,
        request: Request<FocusWindowRequest>,
    ) -> Result<Response<crate::daemon_proto::Status>, Status> {
        let req = request.into_inner();
        self.verify_cap(req.cap.as_ref())?;

        let ctrl = self.window.read().await;
        ctrl.focus_window(&req.window_id)
            .map_err(|e| Status::internal(e.to_string()))?;

        Ok(Response::new(crate::daemon_proto::Status {
            success: true,
            message: "OK".to_string(),
            error_code: String::new(),
        }))
    }

    async fn list_files(
        &self,
        request: Request<ListFilesRequest>,
    ) -> Result<Response<ListFilesResponse>, Status> {
        let req = request.into_inner();
        self.verify_cap(req.cap.as_ref())?;

        let ctrl = self.file.read().await;
        let files = ctrl
            .list_files(&req.path, req.recursive)
            .map_err(|e| Status::internal(e.to_string()))?;

        let proto_files: Vec<FileInfo> = files
            .into_iter()
            .map(|f| FileInfo {
                path: f.path,
                name: f.name,
                is_dir: f.is_dir,
                size: f.size,
                modified_ms: f.modified_ms,
                created_ms: f.created_ms,
                permissions: String::new(),
            })
            .collect();

        Ok(Response::new(ListFilesResponse { files: proto_files }))
    }

    async fn read_file(
        &self,
        request: Request<ReadFileRequest>,
    ) -> Result<Response<ReadFileResponse>, Status> {
        let req = request.into_inner();
        self.verify_cap(req.cap.as_ref())?;

        let ctrl = self.file.read().await;
        let (data, truncated, total_size) = ctrl
            .read_file(&req.path, req.offset, req.max_bytes)
            .map_err(|e| Status::internal(e.to_string()))?;

        Ok(Response::new(ReadFileResponse {
            data,
            truncated,
            total_size,
        }))
    }

    async fn write_file(
        &self,
        request: Request<WriteFileRequest>,
    ) -> Result<Response<crate::daemon_proto::Status>, Status> {
        let req = request.into_inner();
        self.verify_cap(req.cap.as_ref())?;

        let ctrl = self.file.read().await;
        ctrl.write_file(&req.path, &req.data, req.create_dirs)
            .map_err(|e| Status::internal(e.to_string()))?;

        Ok(Response::new(crate::daemon_proto::Status {
            success: true,
            message: "OK".to_string(),
            error_code: String::new(),
        }))
    }

    async fn list_processes(
        &self,
        request: Request<ListProcessesRequest>,
    ) -> Result<Response<ListProcessesResponse>, Status> {
        let req = request.into_inner();
        self.verify_cap(req.cap.as_ref())?;

        let ctrl = self.process.read().await;
        let processes = ctrl
            .list_processes()
            .map_err(|e| Status::internal(e.to_string()))?;

        let proto_processes: Vec<ProcessInfo> = processes
            .into_iter()
            .map(|p| ProcessInfo {
                pid: p.pid,
                ppid: p.ppid,
                name: p.name,
                cmdline: p.cmdline,
                user: p.user,
                cpu_percent: p.cpu_percent,
                memory_bytes: p.memory_bytes,
                started_ms: p.started_ms,
                status: p.status,
            })
            .collect();

        Ok(Response::new(ListProcessesResponse {
            processes: proto_processes,
        }))
    }

    async fn start_process(
        &self,
        request: Request<StartProcessRequest>,
    ) -> Result<Response<StartProcessResponse>, Status> {
        let req = request.into_inner();
        self.verify_cap(req.cap.as_ref())?;

        let ctrl = self.process.read().await;
        let working_dir = if req.working_dir.is_empty() {
            None
        } else {
            Some(req.working_dir.as_str())
        };

        let pid = ctrl
            .start_process(&req.command, &req.args, working_dir, &req.env, req.detached)
            .map_err(|e| Status::internal(e.to_string()))?;

        Ok(Response::new(StartProcessResponse { pid }))
    }

    async fn kill_process(
        &self,
        request: Request<KillProcessRequest>,
    ) -> Result<Response<crate::daemon_proto::Status>, Status> {
        let req = request.into_inner();
        self.verify_cap(req.cap.as_ref())?;

        let ctrl = self.process.read().await;
        ctrl.kill_process(req.pid, &req.signal)
            .map_err(|e| Status::internal(e.to_string()))?;

        Ok(Response::new(crate::daemon_proto::Status {
            success: true,
            message: "OK".to_string(),
            error_code: String::new(),
        }))
    }

    async fn shell_exec(
        &self,
        request: Request<ShellExecRequest>,
    ) -> Result<Response<ShellExecResponse>, Status> {
        let req = request.into_inner();
        self.verify_cap(req.cap.as_ref())?;

        let ctrl = self.process.read().await;
        let working_dir = if req.working_dir.is_empty() {
            None
        } else {
            Some(req.working_dir.as_str())
        };

        let result = ctrl
            .shell_exec(&req.command, working_dir, &req.env, req.timeout_seconds as u32)
            .map_err(|e| Status::internal(e.to_string()))?;

        Ok(Response::new(ShellExecResponse {
            exit_code: result.exit_code,
            stdout: result.stdout,
            stderr: result.stderr,
            duration_ms: result.duration_ms,
        }))
    }

    async fn get_clipboard(
        &self,
        request: Request<GetClipboardRequest>,
    ) -> Result<Response<GetClipboardResponse>, Status> {
        let req = request.into_inner();
        self.verify_cap(req.cap.as_ref())?;

        // TODO: Implement clipboard access
        Ok(Response::new(GetClipboardResponse {
            text: String::new(),
            image: vec![],
            mime_type: String::new(),
        }))
    }

    async fn set_clipboard(
        &self,
        request: Request<SetClipboardRequest>,
    ) -> Result<Response<crate::daemon_proto::Status>, Status> {
        let req = request.into_inner();
        self.verify_cap(req.cap.as_ref())?;

        // TODO: Implement clipboard access
        Ok(Response::new(crate::daemon_proto::Status {
            success: true,
            message: "OK".to_string(),
            error_code: String::new(),
        }))
    }
}
