use anyhow::Result;
use std::collections::HashMap;
use std::process::{Command, Stdio};

pub struct ProcessController {}

impl ProcessController {
    pub fn new() -> Self {
        Self {}
    }

    #[cfg(target_os = "windows")]
    pub fn list_processes(&self) -> Result<Vec<ProcessInfo>> {
        let output = Command::new("tasklist")
            .args(["/FO", "CSV", "/NH"])
            .output()?;
        
        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut processes = Vec::new();
        
        for line in stdout.lines() {
            let parts: Vec<&str> = line.split(',')
                .map(|s| s.trim_matches('"'))
                .collect();
            
            if parts.len() >= 5 {
                let pid: i32 = parts[1].parse().unwrap_or(0);
                let mem_str = parts[4].replace(",", "").replace(" K", "");
                let mem_kb: i64 = mem_str.parse().unwrap_or(0);
                
                processes.push(ProcessInfo {
                    pid,
                    ppid: 0,
                    name: parts[0].to_string(),
                    cmdline: String::new(),
                    user: String::new(),
                    cpu_percent: 0.0,
                    memory_bytes: mem_kb * 1024,
                    started_ms: 0,
                    status: "running".to_string(),
                });
            }
        }
        
        Ok(processes)
    }

    #[cfg(not(target_os = "windows"))]
    pub fn list_processes(&self) -> Result<Vec<ProcessInfo>> {
        Ok(vec![])
    }

    pub fn start_process(
        &self,
        command: &str,
        args: &[String],
        working_dir: Option<&str>,
        env: &HashMap<String, String>,
        detached: bool,
    ) -> Result<i32> {
        let mut cmd = Command::new(command);
        cmd.args(args);

        if let Some(dir) = working_dir {
            cmd.current_dir(dir);
        }

        for (k, v) in env {
            cmd.env(k, v);
        }

        if detached {
            cmd.stdout(Stdio::null()).stderr(Stdio::null());
        }

        let child = cmd.spawn()?;
        Ok(child.id() as i32)
    }

    #[cfg(target_os = "windows")]
    pub fn kill_process(&self, pid: i32, _signal: &str) -> Result<()> {
        Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .output()?;
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    pub fn kill_process(&self, pid: i32, signal: &str) -> Result<()> {
        let sig = match signal {
            "SIGTERM" | "15" => 15,
            "SIGKILL" | "9" => 9,
            "SIGINT" | "2" => 2,
            _ => 15,
        };

        #[cfg(unix)]
        unsafe {
            libc::kill(pid, sig);
        }

        Ok(())
    }

    pub fn shell_exec(
        &self,
        command: &str,
        working_dir: Option<&str>,
        env: &HashMap<String, String>,
        _timeout_seconds: u32,
    ) -> Result<ShellResult> {
        let start = std::time::Instant::now();

        #[cfg(target_os = "windows")]
        let mut cmd = {
            let mut c = Command::new("cmd");
            c.args(["/C", command]);
            c
        };

        #[cfg(not(target_os = "windows"))]
        let mut cmd = {
            let mut c = Command::new("sh");
            c.arg("-c").arg(command);
            c
        };

        if let Some(dir) = working_dir {
            cmd.current_dir(dir);
        }

        for (k, v) in env {
            cmd.env(k, v);
        }

        let output = cmd.output()?;

        Ok(ShellResult {
            exit_code: output.status.code().unwrap_or(-1),
            stdout: output.stdout,
            stderr: output.stderr,
            duration_ms: start.elapsed().as_millis() as i64,
        })
    }
}

pub struct ProcessInfo {
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

pub struct ShellResult {
    pub exit_code: i32,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
    pub duration_ms: i64,
}
