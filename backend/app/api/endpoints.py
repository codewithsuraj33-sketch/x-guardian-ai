# ─────────────────────────────────────────────
# X-Guardian — FastAPI Vision & Database API Endpoints
# ─────────────────────────────────────────────

from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.models.schemas import HealthResponse, VisionFrameResponse
from app.services.detector import VisionDetector, get_detector
from app.database import get_db
from app.services.db_service import (
    save_incident,
    get_incidents,
    update_incident_status,
    get_all_cameras,
    get_all_workers,
    get_all_zones,
    get_analytics_summary,
)

router = APIRouter()


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
