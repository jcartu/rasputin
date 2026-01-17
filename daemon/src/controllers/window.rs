use anyhow::Result;

pub struct WindowController {}

impl WindowController {
    pub fn new() -> Self {
        Self {}
    }

    #[cfg(target_os = "windows")]
    pub fn list_windows(&self, include_minimized: bool) -> Result<Vec<WindowInfo>> {
        use windows::Win32::Foundation::{BOOL, HWND, LPARAM};
        use windows::Win32::UI::WindowsAndMessaging::{
            EnumWindows, GetWindowTextW, GetWindowTextLengthW, IsWindowVisible, IsIconic,
            GetWindowThreadProcessId, GetWindowRect,
        };
        use std::ffi::OsString;
        use std::os::windows::ffi::OsStringExt;

        let mut windows = Vec::new();

        unsafe extern "system" fn enum_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
            let (windows, include_minimized) = &mut *(lparam.0 as *mut (Vec<WindowInfo>, bool));
            
            if !IsWindowVisible(hwnd).as_bool() {
                return BOOL(1);
            }
            
            if !*include_minimized && IsIconic(hwnd).as_bool() {
                return BOOL(1);
            }

            let len = GetWindowTextLengthW(hwnd);
            if len == 0 {
                return BOOL(1);
            }

            let mut title = vec![0u16; (len + 1) as usize];
            GetWindowTextW(hwnd, &mut title);
            let title = OsString::from_wide(&title[..len as usize])
                .to_string_lossy()
                .to_string();

            let mut pid = 0u32;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));

            let mut rect = windows::Win32::Foundation::RECT::default();
            let _ = GetWindowRect(hwnd, &mut rect);

            windows.push(WindowInfo {
                id: format!("{:?}", hwnd),
                title,
                app_name: String::new(),
                process_name: String::new(),
                pid: pid as i32,
                x: rect.left,
                y: rect.top,
                width: rect.right - rect.left,
                height: rect.bottom - rect.top,
                focused: false,
                minimized: IsIconic(hwnd).as_bool(),
                maximized: false,
                display_id: 0,
            });

            BOOL(1)
        }

        unsafe {
            let mut data = (windows, include_minimized);
            let _ = EnumWindows(
                Some(enum_callback),
                LPARAM(&mut data as *mut _ as isize),
            );
            windows = data.0;
        }

        Ok(windows)
    }

    #[cfg(not(target_os = "windows"))]
    pub fn list_windows(&self, _include_minimized: bool) -> Result<Vec<WindowInfo>> {
        Ok(vec![])
    }

    #[cfg(target_os = "windows")]
    pub fn focus_window(&self, window_id: &str) -> Result<()> {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::WindowsAndMessaging::{SetForegroundWindow, ShowWindow, SW_RESTORE};

        let hwnd_val: isize = window_id
            .trim_start_matches("HWND(")
            .trim_end_matches(")")
            .parse()
            .map_err(|_| anyhow::anyhow!("Invalid window ID: {}", window_id))?;
        
        unsafe {
            let hwnd = HWND(hwnd_val as *mut _);
            let _ = ShowWindow(hwnd, SW_RESTORE);
            SetForegroundWindow(hwnd);
        }

        tracing::info!("Focus window: {}", window_id);
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    pub fn focus_window(&self, window_id: &str) -> Result<()> {
        tracing::info!("Focus window: {}", window_id);
        Ok(())
    }
}

pub struct WindowInfo {
    pub id: String,
    pub title: String,
    pub app_name: String,
    pub process_name: String,
    pub pid: i32,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub focused: bool,
    pub minimized: bool,
    pub maximized: bool,
    pub display_id: i32,
}
