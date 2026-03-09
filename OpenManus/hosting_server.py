#!/usr/bin/env python3
"""
Static file hosting server for OpenManus published projects.
Serves projects from /var/www/manus-projects/{subdomain}/ on port 8182.

Cloudflare tunnel should route *.rasputin.to to this server.
The server extracts the subdomain from the Host header and serves the corresponding project.
"""

import os
import httpx
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import mimetypes
import asyncio
import websockets

PROJECTS_DIR = "/var/www/manus-projects"
DEFAULT_INDEX = "index.html"
VOICE_SERVER_WS = "ws://127.0.0.1:8765/ws"

app = FastAPI(title="OpenManus Hosting")


@app.websocket("/ws")
async def voice_ws_proxy(websocket: WebSocket):
    """Proxy WebSocket connections for voice.rasputin.to to the voice server."""
    host = websocket.headers.get("host", "")
    if "voice" not in host:
        await websocket.close(code=1008)
        return
    
    await websocket.accept()
    
    try:
        async with websockets.connect(VOICE_SERVER_WS, max_size=10_000_000) as upstream:
            async def client_to_server():
                try:
                    while True:
                        data = await websocket.receive()
                        if "text" in data:
                            await upstream.send(data["text"])
                        elif "bytes" in data:
                            await upstream.send(data["bytes"])
                except WebSocketDisconnect:
                    pass
            
            async def server_to_client():
                try:
                    async for msg in upstream:
                        if isinstance(msg, str):
                            await websocket.send_text(msg)
                        else:
                            await websocket.send_bytes(msg)
                except Exception:
                    pass
            
            await asyncio.gather(client_to_server(), server_to_client())
    except Exception as e:
        print(f"Voice WS proxy error: {e}")
    finally:
        try:
            await websocket.close()
        except Exception:
            pass

os.makedirs(PROJECTS_DIR, exist_ok=True)


def get_subdomain(host: str) -> str:
    """Extract subdomain from host header."""
    parts = host.split(".")
    if len(parts) >= 3:
        return parts[0].lower()
    return None


def get_project_path(subdomain: str) -> Path:
    """Get the path to a project's directory."""
    return Path(PROJECTS_DIR) / subdomain


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "manus-hosting"}


@app.get("/api/projects")
async def list_projects():
    """List all hosted projects."""
    projects = []
    for entry in Path(PROJECTS_DIR).iterdir():
        if entry.is_dir() and not entry.name.startswith("."):
            manifest_path = entry / "manifest.json"
            if manifest_path.exists():
                import json

                with open(manifest_path) as f:
                    manifest = json.load(f)
                projects.append(
                    {
                        "subdomain": entry.name,
                        "name": manifest.get("name", entry.name),
                        "type": manifest.get("type", "unknown"),
                        "url": f"https://{entry.name}.rasputin.to",
                    }
                )
            else:
                projects.append(
                    {
                        "subdomain": entry.name,
                        "name": entry.name,
                        "type": "static",
                        "url": f"https://{entry.name}.rasputin.to",
                    }
                )
    return {"projects": projects, "total": len(projects)}


# ── Dashboard API Proxies (for dash.rasputin.to) ──
# These proxy local services so the browser can reach them via the hosting domain

@app.get("/api/proxy/costs")
async def proxy_costs():
    """Proxy cartu-proxy cost data."""
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get("http://localhost:8889/costs", timeout=5)
            return JSONResponse(content=r.json())
    except Exception:
        return JSONResponse(content={"error": "unavailable"}, status_code=503)

@app.get("/api/proxy/providers")
async def proxy_providers():
    """Proxy cartu-proxy provider data."""
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get("http://localhost:8889/providers", timeout=5)
            return JSONResponse(content=r.json())
    except Exception:
        return JSONResponse(content={"error": "unavailable"}, status_code=503)

@app.get("/api/proxy/memory")
async def proxy_memory():
    """Proxy Qdrant second brain stats."""
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get("http://localhost:7777/stats", timeout=5)
            return JSONResponse(content=r.json())
    except Exception:
        return JSONResponse(content={"error": "unavailable"}, status_code=503)

@app.get("/api/proxy/quality")
async def proxy_quality():
    """Proxy cartu-proxy quality gate stats."""
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get("http://localhost:8889/quality", timeout=5)
            return JSONResponse(content=r.json())
    except Exception:
        return JSONResponse(content={"error": "unavailable"}, status_code=503)

@app.get("/api/proxy/sessions")
async def proxy_sessions():
    """Proxy active sessions/sub-agents info."""
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get("http://localhost:18789/api/sessions", timeout=5)
            return JSONResponse(content=r.json())
    except Exception:
        return JSONResponse(content={"error": "unavailable"}, status_code=503)


# ── Pipeline UI Reverse Proxy (pipeline.rasputin.to → localhost:3847) ──

PROXY_SUBDOMAINS = {
    "pipeline": "http://127.0.0.1:3847",
    "health": "http://127.0.0.1:9002",
}
# Backwards compat
PIPELINE_PROXY_SUBDOMAINS = set(PROXY_SUBDOMAINS.keys())
PIPELINE_UPSTREAM = "http://127.0.0.1:3847"

@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def serve_file(request: Request, path: str = ""):
    """Serve static files or reverse-proxy dynamic apps based on subdomain."""
    host = request.headers.get("host", "")
    subdomain = get_subdomain(host)

    # Reverse proxy for dynamic app subdomains (pipeline UI, health dashboard, etc.)
    if subdomain in PROXY_SUBDOMAINS:
        try:
            upstream = PROXY_SUBDOMAINS[subdomain]
            url = f"{upstream}/{path}"
            body = await request.body()
            headers = dict(request.headers)
            headers.pop("host", None)
            headers.pop("content-length", None)
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.request(
                    method=request.method,
                    url=url,
                    headers=headers,
                    content=body if body else None,
                    params=dict(request.query_params),
                    follow_redirects=True,
                )
                excluded = {"transfer-encoding", "content-encoding", "content-length", "connection"}
                resp_headers = {k: v for k, v in resp.headers.items() if k.lower() not in excluded}
                from starlette.responses import Response
                return Response(
                    content=resp.content,
                    status_code=resp.status_code,
                    headers=resp_headers,
                    media_type=resp.headers.get("content-type"),
                )
        except Exception as e:
            return HTMLResponse(content=f"<h1>Pipeline UI Unavailable</h1><p>{e}</p>", status_code=502)

    if not subdomain:
        return HTMLResponse(
            content="""
<!DOCTYPE html>
<html>
<head>
    <title>OpenManus Hosting</title>
    <style>
        body { font-family: -apple-system, sans-serif; background: #0a0a0b; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
        .container { text-align: center; padding: 2rem; }
        h1 { font-size: 3rem; margin-bottom: 1rem; background: linear-gradient(135deg, #3b82f6, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        p { color: #a1a1aa; font-size: 1.25rem; }
        a { color: #3b82f6; }
    </style>
</head>
<body>
    <div class="container">
        <h1>OpenManus Hosting</h1>
        <p>Create and publish projects with <a href="https://manus.rasputin.to">OpenManus</a></p>
    </div>
</body>
</html>
        """,
            status_code=200,
        )

    project_path = get_project_path(subdomain)

    if not project_path.exists():
        return HTMLResponse(
            content=f"""
<!DOCTYPE html>
<html>
<head>
    <title>Project Not Found</title>
    <style>
        body {{ font-family: -apple-system, sans-serif; background: #0a0a0b; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }}
        .container {{ text-align: center; padding: 2rem; }}
        h1 {{ font-size: 2rem; color: #ef4444; }}
        p {{ color: #a1a1aa; }}
        a {{ color: #3b82f6; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>Project Not Found</h1>
        <p>The project "{subdomain}" does not exist or has been unpublished.</p>
        <p><a href="https://manus.rasputin.to">Create a new project with OpenManus</a></p>
    </div>
</body>
</html>
        """,
            status_code=404,
        )

    if not path or path == "/":
        path = DEFAULT_INDEX

    file_path = project_path / path

    if not str(file_path.resolve()).startswith(str(project_path.resolve())):
        raise HTTPException(status_code=403, detail="Access denied")

    if file_path.is_dir():
        file_path = file_path / DEFAULT_INDEX

    if not file_path.exists():
        index_path = project_path / DEFAULT_INDEX
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
        headers={"Cache-Control": "public, max-age=3600", "X-Project": subdomain},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8182)
