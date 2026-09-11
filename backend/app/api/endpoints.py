# ─────────────────────────────────────────────
# X-Guardian — FastAPI Vision API Endpoints
# ─────────────────────────────────────────────

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from app.models.schemas import HealthResponse, VisionFrameResponse
from app.services.detector import VisionDetector, get_detector

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check(detector: VisionDetector = Depends(get_detector)):
    """
    Standard service health probe for X-Guardian Vision Service.
    Required by Phase 2B specification.
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
):
    """
    Ingest a single video frame and return structured detection results.
    Future AI YOLOv8 model processes frame within the detector service.
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
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Vision inference error: {str(e)}",
        )


@router.delete("/api/v1/session/{camera_id}", tags=["Vision Inference"])
async def reset_detection_session(camera_id: str, detector: VisionDetector = Depends(get_detector)):
    reset_session = getattr(detector, "reset_session", None)
    if reset_session:
        reset_session(camera_id)
    return {"status": "reset", "cameraId": camera_id}


@router.get("/api/v1/models/info", tags=["AI Architecture"])
async def model_architecture_info():
    """
    Expose target AI model specifications and PPE class coverage.
    """
    return {
        "service": "x-guardian-vision",
        "phase": "2B Foundation",
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
