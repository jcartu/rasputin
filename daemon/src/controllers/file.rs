use anyhow::Result;
use std::fs;
use std::path::Path;

pub struct FileController {}

impl FileController {
    pub fn new() -> Self {
        Self {}
    }

    pub fn list_files(&self, path: &str, recursive: bool) -> Result<Vec<FileInfo>> {
        let mut files = vec![];
        let p = Path::new(path);

        if p.is_dir() {
            for entry in fs::read_dir(p)? {
                let entry = entry?;
                let metadata = entry.metadata()?;
                files.push(FileInfo {
                    path: entry.path().to_string_lossy().to_string(),
                    name: entry.file_name().to_string_lossy().to_string(),
                    is_dir: metadata.is_dir(),
                    size: metadata.len() as i64,
                    modified_ms: metadata.modified()
                        .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64)
                        .unwrap_or(0),
                    created_ms: metadata.created()
                        .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64)
                        .unwrap_or(0),
                });

                if recursive && metadata.is_dir() {
                    if let Ok(sub) = self.list_files(&entry.path().to_string_lossy(), true) {
                        files.extend(sub);
                    }
                }
            }
        }
        Ok(files)
    }

    pub fn read_file(&self, path: &str, offset: i64, max_bytes: i64) -> Result<(Vec<u8>, bool, i64)> {
        let data = fs::read(path)?;
        let total = data.len() as i64;
        let start = offset.min(total) as usize;
        let end = if max_bytes > 0 {
            (offset + max_bytes).min(total) as usize
        } else {
            total as usize
        };
        let truncated = end < total as usize;
        Ok((data[start..end].to_vec(), truncated, total))
    }

    pub fn write_file(&self, path: &str, data: &[u8], create_dirs: bool) -> Result<()> {
        if create_dirs {
            if let Some(parent) = Path::new(path).parent() {
                fs::create_dir_all(parent)?;
            }
        }
        fs::write(path, data)?;
        Ok(())
    }
}

pub struct FileInfo {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub size: i64,
    pub modified_ms: i64,
    pub created_ms: i64,
}
