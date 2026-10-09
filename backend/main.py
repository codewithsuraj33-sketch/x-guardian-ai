# ─────────────────────────────────────────────
# X-Guardian — AI Vision & Database Service Entrypoint
# FastAPI Application with CORS & SQLite integration
# ─────────────────────────────────────────────

import sys
import os

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import router
from app.services.db_service import init_db

# Initialize SQLite database schema and initial records
print("📦 Initializing SQLite Database (xguardian.db)...")
init_db()
print("✅ Database initialized successfully.")

# Sync persisted cameras into stream_manager
from app.database import SessionLocal
from app.models.db_models import CameraDB
from app.services.stream_manager import stream_manager

_db_startup = SessionLocal()
try:
    for _cam in _db_startup.query(CameraDB).all():
        if _cam.stream_url and _cam.stream_url != "demo":
            stream_manager.register_camera(
                camera_id=_cam.camera_id,
                name=_cam.name,
                zone_id=_cam.zone_id,
                stream_url=_cam.stream_url,
                fps=_cam.fps or 15,
            )
            print(f"📡 Restored active camera feed {_cam.camera_id}: {_cam.stream_url}")
finally:
    _db_startup.close()

app = FastAPI(
    title="X-Guardian AI Vision & Database Service",
    description="Industrial safety control microservice with real-time YOLOv8 PPE detection and SQLite database",
    version="0.3.0",
)

# Configure CORS to permit Vite development server and local clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API endpoints
app.include_router(router)


@app.get("/")
def root():
    return {
        "service": "X-Guardian AI Vision & Database Service",
        "version": "0.3.0",
        "database": "SQLite (SQLAlchemy)",
        "docs": "/docs",
        "health": "/health",
        "incidents": "/api/v1/incidents",
        "cameras": "/api/v1/cameras",
        "workers": "/api/v1/workers",
        "zones": "/api/v1/zones",
        "analytics": "/api/v1/analytics/stats",
    }


if __name__ == "__main__":
    import uvicorn

    print("🚀 Starting X-Guardian Service on http://127.0.0.1:8000 ...")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
