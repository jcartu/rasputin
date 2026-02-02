from typing import Optional, Callable, Awaitable
from langchain_core.tools import tool
import asyncio


class ShellTools:
    def __init__(
        self,
        workspace_path: str = "/workspace",
        on_output: Optional[Callable[[str, str, str], Awaitable[None]]] = None
    ):
        self.workspace_path = workspace_path
        self.on_output = on_output

    async def _emit(self, output_type: str, command: str, content: str):
        if self.on_output:
            await self.on_output(output_type, command, content)

    async def execute(self, command: str, timeout: int = 60) -> dict:
        await self._emit("command", command, command)

        try:
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=self.workspace_path
            )

            async def read_stream(stream, stream_type: str):
                output_lines = []
                while True:
                    line = await stream.readline()
                    if not line:
                        break
                    decoded = line.decode().rstrip('\n')
                    output_lines.append(decoded)
                    await self._emit(stream_type, command, decoded)
                return '\n'.join(output_lines)

            try:
                stdout_task = asyncio.create_task(read_stream(process.stdout, "stdout"))
                stderr_task = asyncio.create_task(read_stream(process.stderr, "stderr"))

                done, pending = await asyncio.wait(
                    [stdout_task, stderr_task, asyncio.create_task(process.wait())],
                    timeout=timeout
                )

                for task in pending:
                    task.cancel()

                if process.returncode is None:
                    process.kill()
                    await self._emit("system", command, f"Command timed out after {timeout}s")
                    return {"success": False, "error": f"Command timed out after {timeout}s"}

                stdout = stdout_task.result() if stdout_task.done() else ""
                stderr = stderr_task.result() if stderr_task.done() else ""

                return {
                    "success": process.returncode == 0,
                    "returncode": process.returncode,
                    "stdout": stdout[:5000],
                    "stderr": stderr[:2000]
                }

            except asyncio.TimeoutError:
                process.kill()
                await self._emit("system", command, f"Command timed out after {timeout}s")
                return {"success": False, "error": f"Command timed out after {timeout}s"}

        except Exception as e:
            await self._emit("system", command, f"Error: {str(e)}")
            return {"success": False, "error": str(e)}


def create_shell_tool(shell_tools: ShellTools):
    @tool
    async def run_shell(command: str) -> str:
        """Execute a shell command in the workspace. Use for running scripts, installing packages, etc."""
        result = await shell_tools.execute(command)
        return str(result)

    return run_shell
