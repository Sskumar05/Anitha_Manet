import sys
import asyncio
if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    except Exception:
        pass

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.services.db_service import db_service
from app.services.simulation_service import simulation_service
from app.api.health_routes import router as health_router
from app.api.simulation_routes import router as simulation_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database tables
    await db_service.init_db()
    yield
    # Shutdown logic if needed

app = FastAPI(
    title="MANET Routing Research Dashboard API",
    description="Backend API for Energy-Aware AODV (eAODV) vs Standard AODV simulation with NS-3 engine integration.",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(health_router, prefix="/api")
app.include_router(simulation_router, prefix="/api")

@app.websocket("/ws/simulation/{run_id}")
async def websocket_simulation_endpoint(websocket: WebSocket, run_id: str):
    """
    Live WebSocket stream for simulation progress, stdout lines, and real-time completion events.
    """
    await websocket.accept()
    simulation_service.register_ws(run_id, websocket)

    # Send current status immediately if available
    status_obj = await simulation_service.get_status(run_id)
    if status_obj:
        await websocket.send_json({
            "type": "status_update",
            "status": status_obj.status.value,
            "progress": status_obj.progress_percent,
            "step": status_obj.current_step,
            "logs": status_obj.logs[-10:] if status_obj.logs else []
        })

    try:
        while True:
            # Keep connection alive; listen for incoming messages (e.g. heartbeat or client cancel)
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
            elif data == "cancel":
                await simulation_service.cancel_simulation(run_id)
    except WebSocketDisconnect:
        simulation_service.unregister_ws(run_id, websocket)
    except Exception:
        simulation_service.unregister_ws(run_id, websocket)

@app.get("/")
async def root():
    return {
        "title": "MANET Routing Research Dashboard API",
        "docs": "/docs",
        "health": "/api/health",
        "status": "operational"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
