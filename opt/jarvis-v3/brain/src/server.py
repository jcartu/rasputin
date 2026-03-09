"""FastAPI server for LangGraph streaming."""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="JARVIS Brain",
    description="LangGraph-powered AI assistant",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connection manager for WebSocket clients
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"Client {client_id} connected")
    
    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logger.info(f"Client {client_id} disconnected")
    
    async def send_json(self, client_id: str, data: dict):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_json(data)

manager = ConnectionManager()

class HealthResponse(BaseModel):
    status: str
    version: str
    graph_loaded: bool

@app.get("/health", response_model=HealthResponse)
async def health_check():
    try:
        from .graph import graph
        graph_loaded = graph is not None
    except Exception:
        graph_loaded = False
    
    return HealthResponse(
        status="ok",
        version="0.1.0",
        graph_loaded=graph_loaded
    )

@app.get("/threads")
async def list_threads():
    return {
        "active_connections": list(manager.active_connections.keys()),
        "count": len(manager.active_connections)
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    client_id = f"client_{id(websocket)}"
    await manager.connect(websocket, client_id)
    
    try:
        # Import graph inside to avoid circular imports
        from .graph import graph
        from langchain_core.messages import HumanMessage
        
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "error": "Invalid JSON"
                })
                continue
            
            msg_type = message.get("type", "message")
            content = message.get("content", "")
            thread_id = message.get("thread_id", client_id)
            
            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
                continue
            
            if not content:
                await websocket.send_json({
                    "type": "error",
                    "error": "No content provided"
                })
                continue
            
            logger.info(f"Processing message from {client_id}: {content[:50]}...")
            
            # Configure graph execution
            config = {"configurable": {"thread_id": thread_id}}
            
            # Stream graph execution
            try:
                input_state = {
                    "messages": [HumanMessage(content=content)],
                    "current_agent": "supervisor",
                    "task_status": "pending",
                    "artifacts": {}
                }
                
                async for chunk in graph.astream(input_state, config=config):
                    # Send each update to client
                    await websocket.send_json({
                        "type": "update",
                        "thread_id": thread_id,
                        "data": {
                            k: (
                                [{"role": m.type, "content": m.content} for m in v]
                                if k == "messages" and isinstance(v, list)
                                else v
                            )
                            for k, v in chunk.items()
                        } if isinstance(chunk, dict) else str(chunk)
                    })
                
                await websocket.send_json({
                    "type": "done",
                    "thread_id": thread_id
                })
                
            except Exception as e:
                logger.error(f"Graph execution error: {e}")
                await websocket.send_json({
                    "type": "error",
                    "error": str(e)
                })
    
    except WebSocketDisconnect:
        manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(client_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
