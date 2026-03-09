import asyncio
import json
import mimetypes
import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager

sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response, HTMLResponse

from langgraph_agent.agents.manus_graph import ManusAgent

PROJECTS_DIR = Path("/var/www/manus-projects")


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
            try:
                await self.active_connections[session_id].send_json(
                    {"type": event_type, "data": data}
                )
            except Exception:
                pass


manager = ConnectionManager()
sessions: dict[str, dict] = {}


def get_workspace_path(session_id: str) -> str:
    base_path = Path("/tmp/manus-workspaces")
    workspace = base_path / session_id
    workspace.mkdir(parents=True, exist_ok=True)
    return str(workspace)


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


async def create_event_handler(session_id: str):
    async def on_event(event_type: str, data: dict):
        await manager.send_event(session_id, event_type, data)

    return on_event


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(websocket, session_id)

    if session_id not in sessions:
        sessions[session_id] = {
            "messages": [],
            "workspace": get_workspace_path(session_id),
        }

    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") == "message":
                prompt = data.get("content", "")
                mode = data.get("mode", "adaptive")
                project_instructions = data.get("project_instructions", "")

                await manager.send_event(session_id, "status", {"state": "thinking"})

                api_key = os.environ.get("ANTHROPIC_API_KEY", "")
                if not api_key:
                    await manager.send_event(
                        session_id, "error", {"message": "ANTHROPIC_API_KEY not set"}
                    )
                    continue

                on_event = await create_event_handler(session_id)
                agent = ManusAgent(
                    api_key=api_key,
                    workspace_path=sessions[session_id]["workspace"],
                    on_event=on_event,
                )
                sessions[session_id]["agent"] = agent

                try:
                    final_state = await agent.run(
                        user_message=prompt,
                        thread_id=session_id,
                        mode=mode,
                        project_instructions=project_instructions,
                    )

                    if final_state.get("final_answer"):
                        await manager.send_event(
                            session_id,
                            "final_answer",
                            {"content": final_state["final_answer"]},
                        )

                    await manager.send_event(
                        session_id,
                        "complete",
                        {
                            "success": True,
                            "routed_to": final_state.get("routed_to", "agent"),
                        },
                    )
                except Exception as e:
                    import traceback

                    traceback.print_exc()
                    await manager.send_event(session_id, "error", {"message": str(e)})
                finally:
                    await agent.cleanup()

            elif data.get("type") == "stop":
                if session_id in sessions and "agent" in sessions[session_id]:
                    try:
                        await sessions[session_id]["agent"].cleanup()
                    except Exception:
                        pass
                await manager.send_event(session_id, "stopped", {})

    except WebSocketDisconnect:
        manager.disconnect(session_id)


@app.get("/api/health")
async def health():
    return {"status": "ok", "agent": "langgraph"}


@app.get("/api/projects")
async def list_published_projects():
    projects = []
    if PROJECTS_DIR.exists():
        for entry in PROJECTS_DIR.iterdir():
            if entry.is_dir() and not entry.name.startswith("."):
                manifest_path = entry / "manifest.json"
                if manifest_path.exists():
                    with open(manifest_path) as f:
                        manifest = json.load(f)
                    projects.append(
                        {
                            "subdomain": entry.name,
                            "name": manifest.get("name", entry.name),
                            "type": manifest.get("type", "unknown"),
                            "url": f"/projects/{entry.name}/",
                        }
                    )
                else:
                    projects.append(
                        {
                            "subdomain": entry.name,
                            "name": entry.name,
                            "type": "static",
                            "url": f"/projects/{entry.name}/",
                        }
                    )
    return {"projects": projects, "total": len(projects)}


@app.get("/projects/")
@app.get("/projects")
async def serve_projects_listing():
    """Serve an HTML listing of all published projects."""
    projects = []
    if PROJECTS_DIR.exists():
        for entry in PROJECTS_DIR.iterdir():
            if entry.is_dir() and not entry.name.startswith("."):
                manifest_path = entry / "manifest.json"
                if manifest_path.exists():
                    with open(manifest_path) as f:
                        manifest = json.load(f)
                    projects.append(
                        {
                            "subdomain": entry.name,
                            "name": manifest.get("name", entry.name),
                            "description": manifest.get("description", ""),
                            "type": manifest.get("type", "unknown"),
                        }
                    )
                else:
                    projects.append(
                        {
                            "subdomain": entry.name,
                            "name": entry.name,
                            "description": "",
                            "type": "static",
                        }
                    )

    projects_html = ""
    for p in sorted(projects, key=lambda x: x["name"].lower()):
        projects_html += f"""
        <a href="/projects/{p["subdomain"]}/" class="project-card">
            <div class="project-type">{p["type"]}</div>
            <h2>{p["name"]}</h2>
            <p>{p["description"] or "No description"}</p>
            <span class="project-link">View Project →</span>
        </a>"""

    if not projects_html:
        projects_html = '<p class="no-projects">No projects published yet. Create one from the main app!</p>'

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Published Projects - OpenManus</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0a0a0b 0%, #1a1a2e 50%, #16213e 100%);
            color: #fff;
            min-height: 100vh;
            padding: 2rem;
        }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        header {{ text-align: center; margin-bottom: 3rem; }}
        h1 {{ 
            font-size: 2.5rem; 
            background: linear-gradient(135deg, #fff 0%, #6366f1 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 0.5rem;
        }}
        .subtitle {{ color: #a1a1aa; }}
        .back-link {{ 
            display: inline-block;
            margin-top: 1rem;
            color: #6366f1;
            text-decoration: none;
        }}
        .back-link:hover {{ text-decoration: underline; }}
        .projects-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 1.5rem;
        }}
        .project-card {{
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 1rem;
            padding: 1.5rem;
            text-decoration: none;
            color: inherit;
            transition: all 0.3s ease;
            display: block;
        }}
        .project-card:hover {{
            transform: translateY(-4px);
            border-color: #6366f1;
            background: rgba(99, 102, 241, 0.1);
        }}
        .project-type {{
            display: inline-block;
            padding: 0.25rem 0.75rem;
            background: rgba(99, 102, 241, 0.2);
            color: #a5b4fc;
            border-radius: 9999px;
            font-size: 0.75rem;
            text-transform: uppercase;
            margin-bottom: 0.75rem;
        }}
        .project-card h2 {{ font-size: 1.25rem; margin-bottom: 0.5rem; }}
        .project-card p {{ color: #a1a1aa; font-size: 0.9rem; margin-bottom: 1rem; }}
        .project-link {{ color: #6366f1; font-size: 0.9rem; }}
        .no-projects {{ text-align: center; color: #a1a1aa; padding: 3rem; }}
        .count {{ color: #a1a1aa; font-size: 0.9rem; margin-top: 2rem; text-align: center; }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Published Projects</h1>
            <p class="subtitle">Websites and apps created with OpenManus</p>
            <a href="/" class="back-link">← Back to OpenManus</a>
        </header>
        <div class="projects-grid">
            {projects_html}
        </div>
        <p class="count">{len(projects)} project(s) published</p>
    </div>
</body>
</html>"""
    return HTMLResponse(content=html)


@app.get("/projects/{subdomain}/{path:path}")
async def serve_hosted_project(subdomain: str, path: str = ""):
    project_path = PROJECTS_DIR / subdomain

    if not project_path.exists():
        return HTMLResponse(
            content=f"""<!DOCTYPE html>
<html><head><title>Project Not Found</title>
<style>body {{ font-family: -apple-system, sans-serif; background: #0a0a0b; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }}
.container {{ text-align: center; padding: 2rem; }} h1 {{ font-size: 2rem; color: #ef4444; }} p {{ color: #a1a1aa; }} a {{ color: #3b82f6; }}</style>
</head><body><div class="container"><h1>Project Not Found</h1>
<p>The project "{subdomain}" does not exist.</p>
<p><a href="/">Back to OpenManus</a></p></div></body></html>""",
            status_code=404,
        )

    if not path:
        path = "index.html"

    file_path = project_path / path

    if not str(file_path.resolve()).startswith(str(project_path.resolve())):
        raise HTTPException(status_code=403, detail="Access denied")

    if file_path.is_dir():
        file_path = file_path / "index.html"

    if not file_path.exists():
        index_path = project_path / "index.html"
        if index_path.exists():
            file_path = index_path
        else:
            raise HTTPException(status_code=404, detail="File not found")

    content_type, _ = mimetypes.guess_type(str(file_path))
    if content_type is None:
        content_type = "application/octet-stream"

    return FileResponse(
        path=str(file_path),
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=3600"},
    )


@app.get("/api/sessions/{session_id}/files")
async def list_files(session_id: str, path: str = ""):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    workspace = sessions[session_id].get("workspace", get_workspace_path(session_id))

    if path:
        full_path = Path(workspace) / path
    else:
        full_path = Path(workspace)

    if not full_path.exists():
        return {"files": [], "path": path}

    if not full_path.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory")

    files = []
    try:
        for item in full_path.iterdir():
            rel_path = str(item.relative_to(workspace))
            files.append(
                {
                    "name": item.name,
                    "path": rel_path,
                    "is_dir": item.is_dir(),
                    "size": item.stat().st_size if item.is_file() else 0,
                }
            )
        return {"files": files, "path": path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sessions/{session_id}/files/content")
async def read_file(session_id: str, path: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    workspace = sessions[session_id].get("workspace", get_workspace_path(session_id))
    full_path = Path(workspace) / path

    if not full_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    if not full_path.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")

    try:
        content = full_path.read_text()
        return {"content": content, "path": path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sessions/{session_id}/files/download")
async def download_file(session_id: str, path: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    workspace = sessions[session_id].get("workspace", get_workspace_path(session_id))
    full_path = Path(workspace) / path

    if not full_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    if not full_path.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")

    try:
        content = full_path.read_bytes()
        return Response(
            content=content,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{full_path.name}"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


static_path = Path(__file__).parent / "dist"
if static_path.exists():
    app.mount("/assets", StaticFiles(directory=static_path / "assets"), name="assets")

    @app.get("/")
    async def serve_root():
        return FileResponse(static_path / "index.html")

    @app.get("/{path:path}")
    async def serve_spa(path: str):
        file_path = static_path / path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(static_path / "index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8181)
