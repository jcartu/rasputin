from typing import Optional, List
from langchain_core.tools import tool
import os
import aiofiles
from pathlib import Path


class FileTools:
    def __init__(self, workspace_path: str = "/workspace"):
        self.workspace_path = workspace_path
        os.makedirs(workspace_path, exist_ok=True)
    
    def _safe_path(self, path: str) -> str:
        full_path = os.path.normpath(os.path.join(self.workspace_path, path.lstrip("/")))
        if not full_path.startswith(self.workspace_path):
            raise ValueError(f"Path {path} is outside workspace")
        return full_path

    async def read_file(self, path: str) -> dict:
        try:
            full_path = self._safe_path(path)
            async with aiofiles.open(full_path, 'r') as f:
                content = await f.read()
            return {"success": True, "content": content[:10000]}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def write_file(self, path: str, content: str) -> dict:
        try:
            full_path = self._safe_path(path)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            async with aiofiles.open(full_path, 'w') as f:
                await f.write(content)
            return {"success": True, "path": path}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def list_files(self, path: str = "") -> dict:
        try:
            full_path = self._safe_path(path) if path else self.workspace_path
            entries = []
            for entry in os.scandir(full_path):
                entries.append({
                    "name": entry.name,
                    "path": os.path.relpath(entry.path, self.workspace_path),
                    "is_dir": entry.is_dir(),
                    "size": entry.stat().st_size if entry.is_file() else 0
                })
            return {"success": True, "files": entries, "path": path or "/"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def delete_file(self, path: str) -> dict:
        try:
            full_path = self._safe_path(path)
            if os.path.isdir(full_path):
                import shutil
                shutil.rmtree(full_path)
            else:
                os.remove(full_path)
            return {"success": True, "deleted": path}
        except Exception as e:
            return {"success": False, "error": str(e)}


def create_file_tools(file_tools: FileTools) -> List:
    @tool
    async def read_file(path: str) -> str:
        """Read contents of a file in the workspace."""
        result = await file_tools.read_file(path)
        return str(result)

    @tool
    async def write_file(path: str, content: str) -> str:
        """Write content to a file in the workspace. Creates directories as needed."""
        result = await file_tools.write_file(path, content)
        return str(result)

    @tool
    async def list_files(path: str = "") -> str:
        """List files and directories in the workspace. Use empty path for root."""
        result = await file_tools.list_files(path)
        return str(result)

    @tool
    async def delete_file(path: str) -> str:
        """Delete a file or directory from the workspace."""
        result = await file_tools.delete_file(path)
        return str(result)

    return [read_file, write_file, list_files, delete_file]
