from typing import Optional
from langchain_core.tools import tool
import asyncio
import subprocess


class ShellTools:
    def __init__(self, workspace_path: str = "/workspace"):
        self.workspace_path = workspace_path
    
    async def execute(self, command: str, timeout: int = 60) -> dict:
        try:
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=self.workspace_path
            )
            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(), 
                    timeout=timeout
                )
                return {
                    "success": process.returncode == 0,
                    "returncode": process.returncode,
                    "stdout": stdout.decode()[:5000],
                    "stderr": stderr.decode()[:2000]
                }
            except asyncio.TimeoutError:
                process.kill()
                return {"success": False, "error": f"Command timed out after {timeout}s"}
        except Exception as e:
            return {"success": False, "error": str(e)}


def create_shell_tool(shell_tools: ShellTools):
    @tool
    async def run_shell(command: str) -> str:
        """Execute a shell command in the workspace. Use for running scripts, installing packages, etc."""
        result = await shell_tools.execute(command)
        return str(result)
    
    return run_shell
