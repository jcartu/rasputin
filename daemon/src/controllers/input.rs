pub use anyhow::Result;

pub struct InputController {}

impl InputController {
    pub fn new() -> Self {
        Self {}
    }

    #[cfg(target_os = "windows")]
    pub fn mouse_move(&self, x: i32, y: i32, relative: bool) -> Result<()> {
        use windows::Win32::UI::Input::KeyboardAndMouse::{
            SendInput, INPUT, INPUT_MOUSE, MOUSEEVENTF_ABSOLUTE, MOUSEEVENTF_MOVE,
            MOUSEEVENTF_VIRTUALDESK, MOUSEINPUT,
        };
        use windows::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, SM_CXSCREEN, SM_CYSCREEN};

        unsafe {
            let (abs_x, abs_y) = if relative {
                let mut point = windows::Win32::Foundation::POINT::default();
                windows::Win32::UI::WindowsAndMessaging::GetCursorPos(&mut point)?;
                (point.x + x, point.y + y)
            } else {
                (x, y)
            };

            let screen_w = GetSystemMetrics(SM_CXSCREEN);
            let screen_h = GetSystemMetrics(SM_CYSCREEN);
            
            let norm_x = (abs_x * 65535 / screen_w) as i32;
            let norm_y = (abs_y * 65535 / screen_h) as i32;

            let input = INPUT {
                r#type: INPUT_MOUSE,
                Anonymous: windows::Win32::UI::Input::KeyboardAndMouse::INPUT_0 {
                    mi: MOUSEINPUT {
                        dx: norm_x,
                        dy: norm_y,
                        dwFlags: MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK,
                        ..std::mem::zeroed()
                    },
                },
            };

            SendInput(&[input], std::mem::size_of::<INPUT>() as i32);
        }
        
        tracing::info!("Mouse move to ({}, {})", x, y);
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    pub fn mouse_move(&self, x: i32, y: i32, _relative: bool) -> Result<()> {
        tracing::info!("Mouse move to ({}, {})", x, y);
        Ok(())
    }

    #[cfg(target_os = "windows")]
    pub fn mouse_button(&self, button: MouseButton, action: ButtonAction) -> Result<()> {
        use windows::Win32::UI::Input::KeyboardAndMouse::{
            SendInput, INPUT, INPUT_MOUSE, MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP,
            MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP, MOUSEEVENTF_MIDDLEDOWN,
            MOUSEEVENTF_MIDDLEUP, MOUSEINPUT, MOUSE_EVENT_FLAGS,
        };

        let (down_flag, up_flag): (MOUSE_EVENT_FLAGS, MOUSE_EVENT_FLAGS) = match button {
            MouseButton::Left => (MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP),
            MouseButton::Right => (MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP),
            MouseButton::Middle => (MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP),
        };

        unsafe {
            let make_input = |flags: MOUSE_EVENT_FLAGS| INPUT {
                r#type: INPUT_MOUSE,
                Anonymous: windows::Win32::UI::Input::KeyboardAndMouse::INPUT_0 {
                    mi: MOUSEINPUT {
                        dwFlags: flags,
                        ..std::mem::zeroed()
                    },
                },
            };

            match action {
                ButtonAction::Press => {
                    SendInput(&[make_input(down_flag)], std::mem::size_of::<INPUT>() as i32);
                }
                ButtonAction::Release => {
                    SendInput(&[make_input(up_flag)], std::mem::size_of::<INPUT>() as i32);
                }
                ButtonAction::Click => {
                    SendInput(&[make_input(down_flag), make_input(up_flag)], std::mem::size_of::<INPUT>() as i32);
                }
                ButtonAction::DoubleClick => {
                    SendInput(&[
                        make_input(down_flag), make_input(up_flag),
                        make_input(down_flag), make_input(up_flag),
                    ], std::mem::size_of::<INPUT>() as i32);
                }
            }
        }

        tracing::info!("Mouse {:?} {:?}", button, action);
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    pub fn mouse_button(&self, button: MouseButton, action: ButtonAction) -> Result<()> {
        tracing::info!("Mouse {:?} {:?}", button, action);
        Ok(())
    }

    pub fn mouse_scroll(&self, delta_x: i32, delta_y: i32) -> Result<()> {
        tracing::info!("Mouse scroll ({}, {})", delta_x, delta_y);
        Ok(())
    }

    #[cfg(target_os = "windows")]
    pub fn keyboard_key(&self, key: &str, action: KeyAction) -> Result<()> {
        use windows::Win32::UI::Input::KeyboardAndMouse::{
            SendInput, INPUT, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VIRTUAL_KEY,
            VK_RETURN, VK_ESCAPE, VK_TAB, VK_BACK, VK_DELETE, VK_UP, VK_DOWN, VK_LEFT,
            VK_RIGHT, VK_HOME, VK_END, VK_PRIOR, VK_NEXT, VK_F1, VK_F2, VK_F3, VK_F4,
            VK_F5, VK_F6, VK_F7, VK_F8, VK_F9, VK_F10, VK_F11, VK_F12, VK_CONTROL,
            VK_SHIFT, VK_MENU, VK_LWIN, VK_SPACE, KEYBD_EVENT_FLAGS,
        };

        let vk: VIRTUAL_KEY = match key.to_lowercase().as_str() {
            "return" | "enter" => VK_RETURN,
            "escape" | "esc" => VK_ESCAPE,
            "tab" => VK_TAB,
            "backspace" => VK_BACK,
            "delete" => VK_DELETE,
            "up" => VK_UP,
            "down" => VK_DOWN,
            "left" => VK_LEFT,
            "right" => VK_RIGHT,
            "home" => VK_HOME,
            "end" => VK_END,
            "pageup" => VK_PRIOR,
            "pagedown" => VK_NEXT,
            "f1" => VK_F1, "f2" => VK_F2, "f3" => VK_F3, "f4" => VK_F4,
            "f5" => VK_F5, "f6" => VK_F6, "f7" => VK_F7, "f8" => VK_F8,
            "f9" => VK_F9, "f10" => VK_F10, "f11" => VK_F11, "f12" => VK_F12,
            "ctrl" | "control" => VK_CONTROL,
            "shift" => VK_SHIFT,
            "alt" => VK_MENU,
            "super" | "win" | "meta" => VK_LWIN,
            "space" => VK_SPACE,
            k if k.len() == 1 => VIRTUAL_KEY(k.chars().next().unwrap().to_ascii_uppercase() as u16),
            _ => return Err(anyhow::anyhow!("Unknown key: {}", key)),
        };

        unsafe {
            let make_input = |flags: KEYBD_EVENT_FLAGS| INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: windows::Win32::UI::Input::KeyboardAndMouse::INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: vk,
                        dwFlags: flags,
                        ..std::mem::zeroed()
                    },
                },
            };

            match action {
                KeyAction::Press => {
                    SendInput(&[make_input(KEYBD_EVENT_FLAGS(0))], std::mem::size_of::<INPUT>() as i32);
                }
                KeyAction::Release => {
                    SendInput(&[make_input(KEYEVENTF_KEYUP)], std::mem::size_of::<INPUT>() as i32);
                }
                KeyAction::Tap => {
                    SendInput(&[make_input(KEYBD_EVENT_FLAGS(0)), make_input(KEYEVENTF_KEYUP)], std::mem::size_of::<INPUT>() as i32);
                }
            }
        }

        tracing::info!("Key {} {:?}", key, action);
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    pub fn keyboard_key(&self, key: &str, action: KeyAction) -> Result<()> {
        tracing::info!("Key {} {:?}", key, action);
        Ok(())
    }

    #[cfg(target_os = "windows")]
    pub fn keyboard_type(&self, text: &str, delay_ms: i32) -> Result<()> {
        use windows::Win32::UI::Input::KeyboardAndMouse::{
            SendInput, INPUT, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_UNICODE, KEYEVENTF_KEYUP,
        };

        for ch in text.chars() {
            unsafe {
                let inputs = [
                    INPUT {
                        r#type: INPUT_KEYBOARD,
                        Anonymous: windows::Win32::UI::Input::KeyboardAndMouse::INPUT_0 {
                            ki: KEYBDINPUT {
                                wScan: ch as u16,
                                dwFlags: KEYEVENTF_UNICODE,
                                ..std::mem::zeroed()
                            },
                        },
                    },
                    INPUT {
                        r#type: INPUT_KEYBOARD,
                        Anonymous: windows::Win32::UI::Input::KeyboardAndMouse::INPUT_0 {
                            ki: KEYBDINPUT {
                                wScan: ch as u16,
                                dwFlags: KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                                ..std::mem::zeroed()
                            },
                        },
                    },
                ];
                SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
            }
            
            if delay_ms > 0 {
                std::thread::sleep(std::time::Duration::from_millis(delay_ms as u64));
            }
        }

        tracing::info!("Type text: {}", text);
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    pub fn keyboard_type(&self, text: &str, _delay_ms: i32) -> Result<()> {
        tracing::info!("Type text: {}", text);
        Ok(())
    }
}

#[derive(Debug)]
pub enum MouseButton {
    Left,
    Right,
    Middle,
}

#[derive(Debug)]
pub enum ButtonAction {
    Press,
    Release,
    Click,
    DoubleClick,
}

#[derive(Debug)]
pub enum KeyAction {
    Press,
    Release,
    Tap,
}
