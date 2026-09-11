# ─────────────────────────────────────────────
# X-Guardian — AI Vision Service Entrypoint
# FastAPI Application with CORS for React frontend
# ─────────────────────────────────────────────

import sys
import os

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import router

app = FastAPI(
    title="X-Guardian AI Vision Service",
    description="Python computer vision microservice for real-time industrial PPE compliance detection",
    version="0.2.0",
)

# Configure CORS to permit Vite development server and local clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "*",  # Permissive for local network testing / mobile devices
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
        "service": "X-Guardian AI Vision Inference Service",
        "version": "0.2.0",
        "docs": "/docs",
        "health": "/health",
    }


if __name__ == "__main__":
    import uvicorn

    print("🚀 Starting X-Guardian Vision Service on http://127.0.0.1:8000 ...")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
