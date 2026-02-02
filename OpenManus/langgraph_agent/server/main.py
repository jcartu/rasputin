import asyncio
import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
import aiofiles

from ..agents.manus_graph import ManusAgent


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

app = FastAPI(title="Manus LangGraph Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_api_key() -> str:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        config_path = Path(__file__).parent.parent.parent / "config" / "config.toml"
        if config_path.exists():
            import tomli
            with open(config_path, "rb") as f:
                config = tomli.load(f)
                api_key = config.get("llm", {}).get("api_key", "")
    return api_key or ""


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(websocket, session_id)
    
    workspace_path = f"/tmp/manus-workspace/{session_id}"
    os.makedirs(workspace_path, exist_ok=True)
    
    if session_id not in sessions:
        sessions[session_id] = {
            "messages": [],
            "workspace_path": workspace_path,
            "agent": None
        }
    
    async def on_event(event_type: str, data: dict):
        await manager.send_event(session_id, event_type, data)
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "message":
                prompt = data.get("content", "")
                
                await manager.send_event(session_id, "status", {"state": "thinking"})
                
                api_key = get_api_key()
                if not api_key:
                    await manager.send_event(session_id, "error", {
                        "message": "No API key configured"
                    })
                    continue
                
                agent = ManusAgent(
                    api_key=api_key,
                    workspace_path=workspace_path,
                    on_event=on_event
                )
                sessions[session_id]["agent"] = agent
                
                try:
                    await agent.run(prompt, thread_id=session_id)
                    
                    files = agent.get_files()
                    await manager.send_event(session_id, "files_updated", {"files": files})
                    
                    await manager.send_event(session_id, "complete", {"success": True})
                except Exception as e:
                    await manager.send_event(session_id, "error", {"message": str(e)})
                finally:
                    await agent.cleanup()
                    
    except WebSocketDisconnect:
        manager.disconnect(session_id)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/sessions/{session_id}/files")
async def list_files(session_id: str, path: str = ""):
    workspace = f"/tmp/manus-workspace/{session_id}"
    if not os.path.exists(workspace):
        raise HTTPException(status_code=404, detail="Session not found")
    
    target_path = os.path.join(workspace, path.lstrip("/")) if path else workspace
    if not os.path.exists(target_path):
        raise HTTPException(status_code=404, detail="Path not found")
    
    files = []
    for entry in os.scandir(target_path):
        files.append({
            "name": entry.name,
            "path": os.path.relpath(entry.path, workspace),
            "is_dir": entry.is_dir(),
            "size": entry.stat().st_size if entry.is_file() else 0
        })
    
    return {"files": files, "path": path or "/"}


@app.get("/api/sessions/{session_id}/files/download")
async def download_file(session_id: str, path: str):
    workspace = f"/tmp/manus-workspace/{session_id}"
    full_path = os.path.join(workspace, path.lstrip("/"))
    
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    if not full_path.startswith(workspace):
        raise HTTPException(status_code=403, detail="Access denied")
    
    async with aiofiles.open(full_path, "rb") as f:
        content = await f.read()
    
    filename = os.path.basename(path)
    return Response(
        content=content,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


static_path = Path(__file__).parent.parent.parent / "web" / "dist"
if static_path.exists():
    app.mount("/assets", StaticFiles(directory=static_path / "assets"), name="assets")
    
    @app.get("/")
    async def serve_root():
        return FileResponse(static_path / "index.html")


def run_server(host: str = "0.0.0.0", port: int = 8181):
    import uvicorn
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    run_server()
