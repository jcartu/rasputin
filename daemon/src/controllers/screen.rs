use anyhow::Result;

pub struct ScreenController {}

impl ScreenController {
    pub fn new() -> Self {
        Self {}
    }

    #[cfg(target_os = "windows")]
    pub fn list_displays(&self) -> Result<Vec<Display>> {
        use windows::Win32::Graphics::Gdi::{
            EnumDisplayMonitors, GetMonitorInfoW, HDC, HMONITOR, MONITORINFOEXW,
        };
        use windows::Win32::Foundation::{BOOL, LPARAM, RECT};
        use std::mem::zeroed;

        let mut displays = Vec::new();
        
        unsafe extern "system" fn enum_callback(
            monitor: HMONITOR,
            _hdc: HDC,
            _rect: *mut RECT,
            data: LPARAM,
        ) -> BOOL {
            let displays = &mut *(data.0 as *mut Vec<Display>);
            let mut info: MONITORINFOEXW = zeroed();
            info.monitorInfo.cbSize = std::mem::size_of::<MONITORINFOEXW>() as u32;
            
            if GetMonitorInfoW(monitor, &mut info.monitorInfo).as_bool() {
                let rc = info.monitorInfo.rcMonitor;
                let primary = (info.monitorInfo.dwFlags & 1) != 0;
                displays.push(Display {
                    id: displays.len() as i32,
                    name: String::from_utf16_lossy(&info.szDevice).trim_end_matches('\0').to_string(),
                    width: rc.right - rc.left,
                    height: rc.bottom - rc.top,
                    scale: 1.0,
                    primary,
                });
            }
            BOOL(1)
        }

        unsafe {
            let _ = EnumDisplayMonitors(
                HDC::default(),
                None,
                Some(enum_callback),
                LPARAM(&mut displays as *mut _ as isize),
            );
        }

        if displays.is_empty() {
            displays.push(Display {
                id: 0,
                name: "Primary".to_string(),
                width: 1920,
                height: 1080,
                scale: 1.0,
                primary: true,
            });
        }

        Ok(displays)
    }

    #[cfg(not(target_os = "windows"))]
    pub fn list_displays(&self) -> Result<Vec<Display>> {
        Ok(vec![Display {
            id: 0,
            name: "Primary".to_string(),
            width: 1920,
            height: 1080,
            scale: 1.0,
            primary: true,
        }])
    }

    #[cfg(target_os = "windows")]
    pub fn screenshot(&self, _display_id: i32, _region: Option<Rect>) -> Result<Vec<u8>> {
        use windows::Win32::Graphics::Gdi::{
            BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject,
            GetDC, GetDIBits, ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER,
            BI_RGB, DIB_RGB_COLORS, SRCCOPY,
        };
        use windows::Win32::UI::WindowsAndMessaging::GetSystemMetrics;
        use windows::Win32::UI::WindowsAndMessaging::{SM_CXSCREEN, SM_CYSCREEN};

        unsafe {
            let width = GetSystemMetrics(SM_CXSCREEN);
            let height = GetSystemMetrics(SM_CYSCREEN);

            let hdc_screen = GetDC(None);
            let hdc_mem = CreateCompatibleDC(hdc_screen);
            let hbitmap = CreateCompatibleBitmap(hdc_screen, width, height);
            
            SelectObject(hdc_mem, hbitmap);
            let _ = BitBlt(hdc_mem, 0, 0, width, height, hdc_screen, 0, 0, SRCCOPY);

            let mut bmi = BITMAPINFO {
                bmiHeader: BITMAPINFOHEADER {
                    biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                    biWidth: width,
                    biHeight: -height,
                    biPlanes: 1,
                    biBitCount: 24,
                    biCompression: BI_RGB.0,
                    ..std::mem::zeroed()
                },
                ..std::mem::zeroed()
            };

            let row_size = ((width * 3 + 3) & !3) as usize;
            let mut pixels = vec![0u8; row_size * height as usize];
            
            GetDIBits(
                hdc_mem,
                hbitmap,
                0,
                height as u32,
                Some(pixels.as_mut_ptr() as *mut _),
                &mut bmi,
                DIB_RGB_COLORS,
            );

            DeleteObject(hbitmap);
            DeleteDC(hdc_mem);
            ReleaseDC(None, hdc_screen);

            let mut png_data = Vec::new();
            let encoder = image::codecs::png::PngEncoder::new(&mut png_data);
            let rgb: Vec<u8> = pixels.chunks(3).flat_map(|bgr| [bgr[2], bgr[1], bgr[0]]).collect();
            encoder.encode(&rgb, width as u32, height as u32, image::ExtendedColorType::Rgb8)?;
            
            Ok(png_data)
        }
    }

    #[cfg(not(target_os = "windows"))]
    pub fn screenshot(&self, _display_id: i32, _region: Option<Rect>) -> Result<Vec<u8>> {
        Ok(vec![])
    }
}

pub struct Display {
    pub id: i32,
    pub name: String,
    pub width: i32,
    pub height: i32,
    pub scale: f32,
    pub primary: bool,
}

pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}
