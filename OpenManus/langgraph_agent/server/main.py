import asyncio
import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
import aiofiles

from ..agents.manus_graph import ManusAgent
from ..storage.session_store import SessionStore


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
session_store = SessionStore()

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
            "agent": None,
            "latest_screenshot": None,
        }

    async def on_event(event_type: str, data: dict):
        await manager.send_event(session_id, event_type, data)

        if event_type == "screenshot" and data.get("base64_image"):
            sessions[session_id]["latest_screenshot"] = data["base64_image"]

        if event_type == "task_plan":
            session_store.update_tasks(session_id, data.get("tasks", []))

    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") == "message":
                prompt = data.get("content", "")
                mode = data.get("mode", "adaptive")

                stored_session = session_store.load(session_id)
                if not stored_session:
                    title = prompt[:50] + ("..." if len(prompt) > 50 else "")
                    session_store.create(session_id, title)

                session_store.add_message(session_id, "user", prompt)

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
                    result = await agent.run(prompt, thread_id=session_id, mode=mode)

                    final_answer = result.get("final_answer", "")
                    if final_answer:
                        session_store.add_message(session_id, "assistant", final_answer)

                    if sessions[session_id].get("latest_screenshot"):
                        session_store.set_thumbnail(
                            session_id,
                            sessions[session_id]["latest_screenshot"][:1000]
                        )

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


@app.get("/api/sessions")
async def list_sessions(limit: int = 50):
    return {"sessions": session_store.list_sessions(limit)}


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    session = session_store.load(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.to_dict()


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    if session_store.delete(session_id):
        return {"status": "deleted"}
    raise HTTPException(status_code=404, detail="Session not found")


def get_config_path() -> Path:
    return Path(__file__).parent.parent.parent / "config" / "config.toml"


@app.get("/api/settings")
async def get_settings():
    config_path = get_config_path()
    settings = {
        "model": "claude-sonnet-4-20250514",
        "api_key_configured": False,
        "available_models": [
            {"id": "claude-sonnet-4-20250514", "name": "Claude Sonnet 4"},
            {"id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet"},
            {"id": "claude-3-opus-20240229", "name": "Claude 3 Opus"},
        ],
    }

    if config_path.exists():
        import tomli
        with open(config_path, "rb") as f:
            config = tomli.load(f)
            llm_config = config.get("llm", {})
            settings["model"] = llm_config.get("model", settings["model"])
            api_key = llm_config.get("api_key", "")
            settings["api_key_configured"] = bool(api_key and len(api_key) > 10)
            if api_key:
                settings["api_key_preview"] = api_key[:8] + "..." + api_key[-4:]

    return settings


@app.put("/api/settings")
async def update_settings(model: Optional[str] = None, api_key: Optional[str] = None):
    config_path = get_config_path()

    config = {}
    if config_path.exists():
        import tomli
        with open(config_path, "rb") as f:
            config = tomli.load(f)

    if "llm" not in config:
        config["llm"] = {}

    if model:
        config["llm"]["model"] = model
    if api_key:
        config["llm"]["api_key"] = api_key

    config_path.parent.mkdir(parents=True, exist_ok=True)
    import tomli_w
    with open(config_path, "wb") as f:
        tomli_w.dump(config, f)

    return {"status": "updated"}


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


@app.post("/api/sessions/{session_id}/files/upload")
async def upload_file(session_id: str, file: UploadFile = File(...), path: str = ""):
    workspace = f"/tmp/manus-workspace/{session_id}"
    os.makedirs(workspace, exist_ok=True)
    
    target_dir = os.path.join(workspace, path.lstrip("/")) if path else workspace
    os.makedirs(target_dir, exist_ok=True)
    
    if not target_dir.startswith(workspace):
        raise HTTPException(status_code=403, detail="Access denied")
    
    file_path = os.path.join(target_dir, file.filename or "uploaded_file")
    
    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)
    
    return {
        "status": "uploaded",
        "path": os.path.relpath(file_path, workspace),
        "name": file.filename,
        "size": len(content)
    }


@app.post("/api/sessions/{session_id}/files/upload-multiple")
async def upload_multiple_files(session_id: str, files: list[UploadFile] = File(...), path: str = ""):
    workspace = f"/tmp/manus-workspace/{session_id}"
    os.makedirs(workspace, exist_ok=True)
    
    target_dir = os.path.join(workspace, path.lstrip("/")) if path else workspace
    os.makedirs(target_dir, exist_ok=True)
    
    if not target_dir.startswith(workspace):
        raise HTTPException(status_code=403, detail="Access denied")
    
    uploaded = []
    for file in files:
        file_path = os.path.join(target_dir, file.filename or f"uploaded_file_{len(uploaded)}")
        
        async with aiofiles.open(file_path, "wb") as f:
            content = await file.read()
            await f.write(content)
        
        uploaded.append({
            "path": os.path.relpath(file_path, workspace),
            "name": file.filename,
            "size": len(content)
        })
    
    return {"status": "uploaded", "files": uploaded}


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
