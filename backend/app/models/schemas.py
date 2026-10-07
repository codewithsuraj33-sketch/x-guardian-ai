# ─────────────────────────────────────────────
# X-Guardian — Pydantic Schemas for AI Vision Service
# Exactly mirrors TypeScript interfaces in src/types/index.ts
# ─────────────────────────────────────────────

from typing import List, Optional, Dict
from pydantic import BaseModel, Field


class BoundingBoxSchema(BaseModel):
    """Bounding box coordinates (normalized or pixel-space)."""
    x: float = Field(..., description="X coordinate of top-left corner")
    y: float = Field(..., description="Y coordinate of top-left corner")
    width: float = Field(..., description="Width of bounding box")
    height: float = Field(..., description="Height of bounding box")


class DetectionItemSchema(BaseModel):
    """Individual object detected by the computer vision model."""
    detectionId: str = Field(..., description="Unique ID for detection")
    className: str = Field(..., description="Class: person, helmet, vest, gloves, shoes")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score 0.0-1.0")
    boundingBox: BoundingBoxSchema
    trackId: Optional[str] = Field(None, description="Persistent tracking ID from ByteTrack/BoTSORT")
    ppeState: Optional[str] = Field(None, description="Temporal PPE state for an associated tracked person")
    timestamp: str
    source: str = Field("image", description="Input source such as image or webcam")


class PPESummarySchema(BaseModel):
    """Aggregated PPE status detected on person(s) in frame."""
    person: bool = Field(False, description="Person present in frame")
    helmet: bool = Field(False, description="Compliant hard hat / helmet detected")
    vest: bool = Field(False, description="Compliant high-visibility safety vest detected")
    gloves: bool = Field(False, description="Compliant safety gloves detected")
    shoes: bool = Field(False, description="Compliant safety footwear detected")
    mask: bool = Field(False, description="Compliant safety face mask detected")
    goggles: bool = Field(False, description="Compliant safety goggles / glasses detected")
    confidences: Optional[Dict[str, float]] = Field(default_factory=dict)


class FireSmokeSchema(BaseModel):
    """Fire and Smoke detection schema."""
    hasFire: bool = Field(False, description="Active flame/fire detected")
    fireConfidence: float = Field(0.0, ge=0.0, le=1.0, description="Confidence of fire detection")
    fireBbox: Optional[BoundingBoxSchema] = None
    hasSmoke: bool = Field(False, description="Smoke plume detected")
    smokeConfidence: float = Field(0.0, ge=0.0, le=1.0, description="Confidence of smoke detection")
    smokeBbox: Optional[BoundingBoxSchema] = None
    smokeDensity: float = Field(0.0, ge=0.0, le=100.0, description="Estimated smoke haze density %")


class KeypointSchema(BaseModel):
    """Single body joint keypoint in normalized coordinates."""
    x: float = Field(..., description="Normalized X coordinate (0.0 to 1.0)")
    y: float = Field(..., description="Normalized Y coordinate (0.0 to 1.0)")
    confidence: float = Field(..., description="Confidence score 0.0-1.0")
    name: Optional[str] = Field(None, description="Joint name (e.g. nose, left_shoulder)")


class SkeletonPoseSchema(BaseModel):
    """Full 17-point human pose skeleton and posture analysis."""
    trackId: Optional[str] = None
    keypoints: List[KeypointSchema] = Field(default_factory=list)
    postureState: str = Field("STANDING", description="Postural state: STANDING, BENDING, SITTING, CROUCHING, FALLEN")
    torsoAngle: Optional[float] = Field(None, description="Torso angle relative to ground (degrees)")
    isFall: bool = Field(False, description="True if fall / collapse is detected")
    isAbnormalPosture: bool = Field(False, description="True if ergonomic strain or abnormal posture detected")
    dropVelocity: Optional[float] = Field(None, description="Vertical downward velocity (normalized units/sec)")
    poseChange: Optional[float] = Field(None, description="Skeleton change displacement from previous frame")
    postureTransition: Optional[str] = Field(None, description="Dynamic transition in posture (e.g. STANDING -> BENDING)")
    ergonomicRisk: Optional[str] = Field("LOW", description="Ergonomic strain evaluation: LOW, MODERATE, HIGH")


class PersonSafetySchema(BaseModel):
    trackId: str
    boundingBox: BoundingBoxSchema
    visible: bool = True
    ppeStates: Dict[str, str] = Field(default_factory=dict)
    violationTypes: List[str] = Field(default_factory=list)
    skeleton: Optional[SkeletonPoseSchema] = None


class VisionFrameResponse(BaseModel):
    """Full frame inference response from vision backend."""
    timestamp: str
    cameraId: str
    source: str = Field("image", description="Input source such as image or webcam")
    detections: List[DetectionItemSchema] = Field(default_factory=list)
    ppeSummary: Optional[PPESummarySchema] = None
    fireSmoke: Optional[FireSmokeSchema] = None
    inferenceTimeMs: Optional[float] = Field(None, description="Inference latency in milliseconds")
    persons: List[PersonSafetySchema] = Field(default_factory=list)
    skeletons: List[SkeletonPoseSchema] = Field(default_factory=list)
    incidents: List["VisionIncidentSchema"] = Field(default_factory=list)


class VisionIncidentSchema(BaseModel):
    incidentId: str
    trackId: Optional[str] = "HAZARD"
    violationType: str
    requiredPpe: str
    timestamp: str
    frameNumber: int
    confidence: Optional[float] = None
    cameraId: str
    zone: str
    evidenceImage: Optional[str] = None


class HealthResponse(BaseModel):
    """Health check response schema."""
    status: str = "ok"
    service: str = "x-guardian-vision"
    version: str = "0.2.0"
    engineReady: bool = False
    engineReason: Optional[str] = None
