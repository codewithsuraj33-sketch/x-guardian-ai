# ─────────────────────────────────────────────
# X-Guardian — FastAPI Vision & Database API Endpoints
# ─────────────────────────────────────────────

from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status, Query, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.schemas import HealthResponse, VisionFrameResponse
from app.services.detector import VisionDetector, get_detector
from app.services.stream_manager import stream_manager
from app.database import get_db, SessionLocal
from app.services.db_service import (
    save_incident,
    get_incidents,
    update_incident_status,
    get_all_cameras,
    add_or_update_camera,
    delete_camera_db,
    get_all_workers,
    get_all_zones,
    get_analytics_summary,
)
from app.models.db_models import CameraDB

router = APIRouter()


class RegisterCameraPayload(BaseModel):
    id: Optional[str] = None
    name: str
    zoneId: str = "ZONE-01"
    streamUrl: str  # IP webcam e.g. http://192.168.1.5:8080/video or rtsp://...
    fps: int = 10


class TestStreamPayload(BaseModel):
    streamUrl: str


@router.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check(detector: VisionDetector = Depends(get_detector)):
    """
    Standard service health probe for X-Guardian Vision Service.
    Reports operational status and AI model readiness.
    """
    return HealthResponse(
        status="ok",
        service="x-guardian-vision",
        version="0.2.0",
        engineReady=detector.is_ready(),
        engineReason=getattr(detector, "reason", None) or getattr(detector, "load_error", None),
    )


@router.post("/api/v1/detect", response_model=VisionFrameResponse, tags=["Vision Inference"])
async def detect_ppe(
    file: UploadFile = File(..., description="JPEG/PNG encoded video frame from browser camera"),
    camera_id: str = Form("CAM-01", description="Assigned factory camera/zone identifier"),
    source: str = Form("image", description="Input source: image, webcam, or video"),
    detector: VisionDetector = Depends(get_detector),
    db: Session = Depends(get_db),
):
    """
    Ingest a single video frame, return structured detection results, and
    automatically log verified safety incidents into the SQLite database.
    """
    if not detector.is_ready():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI detection model is not connected. Awaiting AI inference.",
        )

    # Accept image content types or common binary fallbacks from canvas blobs
    is_valid_type = (
        file.content_type
        and (file.content_type.startswith("image/") or file.content_type == "application/octet-stream")
    ) or (file.filename and file.filename.lower().endswith((".jpg", ".jpeg", ".png", ".webp")))
    if not is_valid_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file content type: {file.content_type}. Expected image/jpeg or image/png.",
        )

    try:
        image_bytes = await file.read()
        if len(image_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Received empty image file.",
            )

        result = detector.detect(image_bytes=image_bytes, camera_id=camera_id, source=source)

        # Automatically persist generated incidents to the SQLite database
        if result.incidents:
            for inc in result.incidents:
                try:
                    save_incident(
                        db=db,
                        incident_id=inc.incidentId,
                        camera_id=camera_id,
                        violation=inc.violationType,
                        severity="CRITICAL" if "fall" in inc.violationType.lower() else "HIGH",
                        worker_id=f"W-{inc.trackId}",
                        track_id=str(inc.trackId),
                        zone_id=inc.zone or "ZONE-01",
                        confidence=inc.confidence or 0.90,
                        frame_number=inc.frameNumber or 0,
                        status="OPEN",
                        timestamp=inc.timestamp,
                        evidence_image=inc.evidenceImage,
                    )
                except Exception as save_err:
                    print(f"Warning: Incident auto-save error: {save_err}")

        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Vision inference error: {str(e)}",
        )


# ─────────────────────────────────────────────
# Database REST Endpoints (Incidents, Cameras, Workers, Zones)
# ─────────────────────────────────────────────

@router.get("/api/v1/incidents", tags=["Incidents Database"])
async def list_incidents(
    limit: int = Query(50, ge=1, le=500),
    status: Optional[str] = Query(None, description="Filter by status: OPEN, ACKNOWLEDGED, RESOLVED"),
    camera_id: Optional[str] = Query(None, description="Filter by camera ID"),
    db: Session = Depends(get_db),
):
    """Retrieve verified safety incidents stored in the SQLite database."""
    records = get_incidents(db, limit=limit, status=status, camera_id=camera_id)
    return [
        {
            "incidentId": r.incident_id,
            "cameraId": r.camera_id,
            "zoneId": r.zone_id,
            "workerId": r.worker_id,
            "trackId": r.track_id,
            "violation": r.violation,
            "severity": r.severity,
            "confidence": r.confidence,
            "frameNumber": r.frame_number,
            "status": r.status,
            "timestamp": r.timestamp,
            "evidenceImage": r.evidence_image,
        }
        for r in records
    ]


@router.patch("/api/v1/incidents/{incident_id}", tags=["Incidents Database"])
async def update_incident(
    incident_id: str,
    status: str = Form(..., description="Target status: OPEN, ACKNOWLEDGED, RESOLVED"),
    db: Session = Depends(get_db),
):
    """Update lifecycle status of an incident in SQLite."""
    updated = update_incident_status(db, incident_id=incident_id, next_status=status.upper())
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Incident {incident_id} not found in database.",
        )
    return {
        "incidentId": updated.incident_id,
        "status": updated.status,
        "message": "Status updated successfully",
    }


@router.get("/api/v1/cameras", tags=["Factory Database"])
async def list_cameras(db: Session = Depends(get_db)):
    """Retrieve all factory surveillance camera nodes from SQLite."""
    records = get_all_cameras(db)
    # Also sync with stream_manager
    for r in records:
        if not stream_manager.get_camera(r.camera_id):
            stream_manager.register_camera(
                camera_id=r.camera_id,
                name=r.name,
                zone_id=r.zone_id,
                stream_url=r.feed_url or "demo",
                fps=r.fps or 10,
            )
    return [
        {
            "cameraId": c.camera_id,
            "zoneId": c.zone_id,
            "name": c.name,
            "feedUrl": c.feed_url,
            "resolution": c.resolution,
            "fps": c.fps,
            "status": c.status,
        }
        for c in records
    ]


@router.post("/api/v1/cameras", tags=["IP Cameras"])
async def register_camera(payload: RegisterCameraPayload, db: Session = Depends(get_db)):
    """Add or update an IP / RTSP / Mobile CCTV camera feed."""
    cam_id = payload.id
    if not cam_id:
        existing = get_all_cameras(db)
        cam_id = f"CAM-0{len(existing) + 1}" if len(existing) < 9 else f"CAM-{len(existing) + 1}"

    # Register in active stream manager
    mgr_cam = stream_manager.register_camera(
        camera_id=cam_id,
        name=payload.name,
        zone_id=payload.zoneId,
        stream_url=payload.streamUrl,
        fps=payload.fps,
    )

    # Persist in SQLite database
    stream_feed = f"/api/v1/stream/{cam_id}"
    add_or_update_camera(
        db=db,
        camera_id=cam_id,
        name=payload.name,
        zone_id=payload.zoneId,
        feed_url=stream_feed,
        stream_url=mgr_cam.get("streamUrl", payload.streamUrl),
        resolution=mgr_cam.get("resolution", "1080p"),
        fps=payload.fps,
    )

    return {
        "status": "registered",
        "cameraId": cam_id,
        "camera": {
            "cameraId": cam_id,
            "name": payload.name,
            "zoneId": payload.zoneId,
            "feedUrl": stream_feed,
            "streamUrl": mgr_cam.get("streamUrl", payload.streamUrl),
            "fps": payload.fps,
            "status": "ONLINE",
            "isCustom": True,
        },
    }


@router.delete("/api/v1/cameras/{camera_id}", tags=["IP Cameras"])
async def delete_camera_endpoint(camera_id: str, db: Session = Depends(get_db)):
    """Remove a camera feed from system and database."""
    mgr_deleted = stream_manager.delete_camera(camera_id)
    db_deleted = delete_camera_db(db, camera_id)
    return {
        "status": "deleted" if (mgr_deleted or db_deleted) else "not_found",
        "cameraId": camera_id,
    }


@router.post("/api/v1/stream/test", tags=["IP Cameras"])
async def test_camera_stream(payload: TestStreamPayload):
    """Probe an RTSP or IP Webcam URL to verify connection."""
    res = stream_manager.test_stream_connection(payload.streamUrl)
    return res


@router.get("/api/v1/stream/{camera_id}", tags=["IP Cameras"])
async def get_camera_stream(
    camera_id: str,
    detector: VisionDetector = Depends(get_detector),
    db: Session = Depends(get_db),
):
    """
    Live multipart MJPEG stream viewable directly in HTML <img> tags or canvas.
    Feeds real RTSP, mobile IP camera, or simulated industrial CCTV with YOLOv8 PPE bounding boxes.
    """
    # Auto-restore custom camera from database into stream_manager if missing from memory
    if not stream_manager.get_camera(camera_id):
        db_cam = db.query(CameraDB).filter(CameraDB.camera_id == camera_id).first()
        if db_cam and db_cam.stream_url:
            stream_manager.register_camera(
                camera_id=db_cam.camera_id,
                name=db_cam.name,
                zone_id=db_cam.zone_id,
                stream_url=db_cam.stream_url,
                fps=db_cam.fps or 15,
            )

    def incident_saver(**kwargs):
        try:
            with SessionLocal() as session:
                save_incident(session, **kwargs)
        except Exception as save_err:
            print(f"Stream incident auto-save error: {save_err}")

    return StreamingResponse(
        stream_manager.generate_mjpeg_stream(
            camera_id=camera_id,
            detector=detector,
            db_saver=incident_saver,
        ),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@router.get("/api/v1/stream/{camera_id}/snapshot", tags=["IP Cameras"])
async def get_camera_snapshot(camera_id: str):
    """Retrieve latest JPEG snapshot from an IP or CCTV stream."""
    frame_bytes = stream_manager.get_latest_frame(camera_id)
    if not frame_bytes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No frame available yet for camera {camera_id}.",
        )
    return Response(content=frame_bytes, media_type="image/jpeg")


@router.get("/api/v1/stream/{camera_id}/telemetry", tags=["IP Cameras"])
async def get_camera_telemetry(camera_id: str):
    """Retrieve real-time PPE telemetry, detections, posture and worker statuses from an active IP/CCTV stream."""
    telemetry = stream_manager.get_latest_telemetry(camera_id)
    if not telemetry:
        return {
            "detections": [],
            "persons": [],
            "skeletons": [],
            "incidents": [],
            "ppeSummary": {"helmet": False, "vest": False, "gloves": False, "boots": False, "mask": False, "glass": False},
            "fireSmoke": {"hasFire": False, "hasSmoke": False, "fireConfidence": 0.0, "smokeDensity": 0.0},
        }
    return telemetry


@router.get("/api/v1/workers", tags=["Factory Database"])
async def list_workers(db: Session = Depends(get_db)):
    """Retrieve the workforce roster and safety compliance scores from SQLite."""
    records = get_all_workers(db)
    return [
        {
            "id": w.id,
            "name": w.name,
            "zoneId": w.zone_id,
            "trackerId": w.tracker_id,
            "riskLevel": w.risk_level,
            "riskScore": w.risk_score,
            "status": w.status,
            "ppe": {
                "helmet": w.helmet,
                "vest": w.vest,
                "gloves": w.gloves,
                "shoes": w.shoes,
                "mask": w.mask,
                "goggles": getattr(w, "goggles", True),
            },
        }
        for w in records
    ]


@router.get("/api/v1/zones", tags=["Factory Database"])
async def list_zones(db: Session = Depends(get_db)):
    """Retrieve all physical factory zones and hazard designations from SQLite."""
    records = get_all_zones(db)
    return [
        {
            "id": z.id,
            "name": z.name,
            "cameraId": z.camera_id,
            "safetyStatus": z.safety_status,
            "workerCount": z.worker_count,
            "description": z.description,
            "color": z.color,
            "isRestricted": z.is_restricted,
        }
        for z in records
    ]


@router.get("/api/v1/analytics/stats", tags=["Factory Database"])
async def analytics_summary(db: Session = Depends(get_db)):
    """Retrieve aggregated safety KPI statistics directly from the database."""
    return get_analytics_summary(db)


@router.delete("/api/v1/session/{camera_id}", tags=["Vision Inference"])
async def reset_detection_session(camera_id: str, detector: VisionDetector = Depends(get_detector)):
    reset_session = getattr(detector, "reset_session", None)
    if reset_session:
        reset_session(camera_id)
    return {"status": "reset", "cameraId": camera_id}


@router.get("/api/v1/models/info", tags=["AI Architecture"])
async def model_architecture_info():
    """Expose target AI model specifications and PPE class coverage."""
    return {
        "service": "x-guardian-vision",
        "phase": "2B Foundation",
        "database": "SQLite (SQLAlchemy ORM)",
        "targetArchitecture": "FastAPI + model-independent PPE detector adapter",
        "requiredClasses": ["person", "helmet", "vest", "gloves", "shoes"],
        "modelResearch": {
            "cocoBaseline": {
                "supported": ["person"],
                "missing": ["helmet", "vest", "gloves", "shoes"],
                "verdict": "Insufficient for industrial PPE safety monitoring.",
            },
            "recommendedApproach": {
                "name": "PPE-specific trained checkpoint",
                "classes": ["Hardhat", "Safety Vest", "Person", "Gloves", "Safety Boots"],
                "inputResolution": "640x640 RGB",
                "recommendedFPS": [5, 10, 15],
            },
        },
    }
