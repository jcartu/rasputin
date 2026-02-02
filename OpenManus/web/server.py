import asyncio
import base64
import json
import re
import sys
import uuid
from pathlib import Path
from typing import Optional, List
from contextlib import asynccontextmanager

sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from app.agent.sandbox_agent import SandboxManus
from app.schema import Message
from app.config import config


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket

    def disconnect(self, session_id: str):
        self.active_connections.pop(session_id, None)

    async def send_event(self, session_id: str, event_type: str, data: dict):
        if session_id in self.active_connections:
            await self.active_connections[session_id].send_json({
                "type": event_type,
                "data": data
            })


manager = ConnectionManager()
sessions: dict[str, dict] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    for session_id, session in sessions.items():
        if "agent" in session:
            try:
                await session["agent"].cleanup()
            except Exception:
                pass


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StreamingAgent(SandboxManus):
    def __init__(self, session_id: str, **kwargs):
        super().__init__(**kwargs)
        self.session_id = session_id
        self._step_count = 0
        self._vnc_url_emitted = False

    async def _emit(self, event_type: str, data: dict):
        await manager.send_event(self.session_id, event_type, data)

    async def _emit_sandbox_links(self):
        if self._vnc_url_emitted:
            return
        if self.sandbox_link:
            for sandbox_id, links in self.sandbox_link.items():
                await self._emit("sandbox_ready", {
                    "sandbox_id": sandbox_id,
                    "vnc_url": links.get("vnc", ""),
                    "website_url": links.get("website", "")
                })
                self._vnc_url_emitted = True
                break

    async def think(self) -> bool:
        self._step_count += 1
        await self._emit_sandbox_links()
        await self._emit("step_start", {
            "step": self._step_count,
            "max_steps": self.max_steps
        })

        if self.next_step_prompt:
            user_msg = Message.user_message(self.next_step_prompt)
            self.messages += [user_msg]

        try:
            response = await self.llm.ask_tool(
                messages=self.messages,
                system_msgs=(
                    [Message.system_message(self.system_prompt)]
                    if self.system_prompt
                    else None
                ),
                tools=self.available_tools.to_params(),
                tool_choice=self.tool_choices,
            )
        except Exception as e:
            await self._emit("error", {"message": str(e)})
            raise

        self.tool_calls = tool_calls = (
            response.tool_calls if response and response.tool_calls else []
        )
        content = response.content if response and response.content else ""

        if content:
            await self._emit("thought", {"content": content})

        if tool_calls:
            tools_info = [
                {"name": tc.function.name, "args": tc.function.arguments}
                for tc in tool_calls
            ]
            await self._emit("tools_selected", {"tools": tools_info})

        from app.schema import ToolChoice, AgentState
        
        if response is None:
            raise RuntimeError("No response received from the LLM")

        if self.tool_choices == ToolChoice.NONE:
            if content:
                self.memory.add_message(Message.assistant_message(content))
                return True
            return False

        assistant_msg = (
            Message.from_tool_calls(content=content, tool_calls=self.tool_calls)
            if self.tool_calls
            else Message.assistant_message(content)
        )
        self.memory.add_message(assistant_msg)

        if self.tool_choices == ToolChoice.REQUIRED and not self.tool_calls:
            return True

        if self.tool_choices == ToolChoice.AUTO and not self.tool_calls:
            return bool(content)

        return bool(self.tool_calls)

    async def execute_tool(self, command) -> str:
        import json as json_module
        from app.schema import AgentState
        
        if not command or not command.function or not command.function.name:
            return "Error: Invalid command format"

        name = command.function.name
        if name not in self.available_tools.tool_map:
            return f"Error: Unknown tool '{name}'"

        try:
            args = json_module.loads(command.function.arguments or "{}")
            
            await self._emit("tool_start", {
                "name": name,
                "args": args
            })

            result = await self.available_tools.execute(name=name, tool_input=args)

            await self._handle_special_tool(name=name, result=result)

            if hasattr(result, "base64_image") and result.base64_image:
                self._current_base64_image = result.base64_image
                await self._emit("tool_result", {
                    "name": name,
                    "result": str(result)[:500],
                    "has_image": True,
                    "base64_image": result.base64_image
                })
            else:
                await self._emit("tool_result", {
                    "name": name,
                    "result": str(result)[:500],
                    "has_image": False
                })

            observation = (
                f"Observed output of cmd `{name}` executed:\n{str(result)}"
                if result
                else f"Cmd `{name}` completed with no output"
            )

            return observation
        except json_module.JSONDecodeError:
            error_msg = f"Error parsing arguments for {name}: Invalid JSON format"
            await self._emit("tool_error", {"name": name, "error": error_msg})
            return f"Error: {error_msg}"
        except Exception as e:
            error_msg = f"Tool '{name}' encountered a problem: {str(e)}"
            await self._emit("tool_error", {"name": name, "error": error_msg})
            return f"Error: {error_msg}"


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(websocket, session_id)
    
    if session_id not in sessions:
        sessions[session_id] = {"messages": []}
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "message":
                prompt = data.get("content", "")
                
                await manager.send_event(session_id, "status", {"state": "thinking"})
                
                agent = await StreamingAgent.create(session_id=session_id)
                sessions[session_id]["agent"] = agent
                
                try:
                    await agent.run(prompt)
                    await manager.send_event(session_id, "complete", {
                        "success": True
                    })
                except Exception as e:
                    await manager.send_event(session_id, "error", {
                        "message": str(e)
                    })
                finally:
                    await agent.cleanup()
                    
    except WebSocketDisconnect:
        manager.disconnect(session_id)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/sessions/{session_id}/files")
async def list_files(session_id: str, path: str = "/workspace"):
    if session_id not in sessions or "agent" not in sessions[session_id]:
        raise HTTPException(status_code=404, detail="Session not found")
    
    agent = sessions[session_id]["agent"]
    if not hasattr(agent, "sandbox") or not agent.sandbox:
        raise HTTPException(status_code=400, detail="Sandbox not available")
    
    try:
        files = agent.sandbox.fs.list_files(path)
        result = []
        for f in files:
            result.append({
                "name": f.name if hasattr(f, "name") else str(f),
                "path": f"{path}/{f.name}" if hasattr(f, "name") else f"{path}/{f}",
                "is_dir": f.is_dir if hasattr(f, "is_dir") else False,
                "size": f.size if hasattr(f, "size") else 0,
            })
        return {"files": result, "path": path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sessions/{session_id}/files/download")
async def download_file(session_id: str, path: str):
    if session_id not in sessions or "agent" not in sessions[session_id]:
        raise HTTPException(status_code=404, detail="Session not found")
    
    agent = sessions[session_id]["agent"]
    if not hasattr(agent, "sandbox") or not agent.sandbox:
        raise HTTPException(status_code=400, detail="Sandbox not available")
    
    try:
        content = agent.sandbox.fs.download_file(path)
        filename = Path(path).name
        return Response(
            content=content,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


static_path = Path(__file__).parent / "dist"
if static_path.exists():
    app.mount("/assets", StaticFiles(directory=static_path / "assets"), name="assets")
    
    @app.get("/")
    async def serve_root():
        return FileResponse(static_path / "index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8181)
