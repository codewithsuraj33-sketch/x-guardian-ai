# ─────────────────────────────────────────────
# X-Guardian — SQLAlchemy Database Models
# ─────────────────────────────────────────────

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    Text,
    DateTime,
    ForeignKey,
)
from app.database import Base


class ZoneDB(Base):
    __tablename__ = "zones"

    id = Column(String(50), primary_key=True, index=True)  # e.g. ZONE-01
    name = Column(String(100), nullable=False)             # e.g. Entry, Assembly
    camera_id = Column(String(50), nullable=False)         # e.g. CAM-01
    safety_status = Column(String(20), default="LOW")      # LOW, MEDIUM, HIGH, CRITICAL
    worker_count = Column(Integer, default=0)
    description = Column(Text, nullable=True)
    color = Column(String(20), default="#3b82f6")
    is_restricted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class CameraDB(Base):
    __tablename__ = "cameras"

    camera_id = Column(String(50), primary_key=True, index=True)  # e.g. CAM-01
    zone_id = Column(String(50), nullable=False)                  # e.g. ZONE-01
    name = Column(String(100), nullable=False)
    feed_url = Column(String(255), nullable=True)
    stream_url = Column(String(500), nullable=True)
    resolution = Column(String(20), default="1920x1080")
    fps = Column(Integer, default=30)
    status = Column(String(20), default="ONLINE")                 # ONLINE, OFFLINE
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class WorkerDB(Base):
    __tablename__ = "workers"

    id = Column(String(50), primary_key=True, index=True)         # e.g. W-1001
    name = Column(String(100), nullable=False)
    zone_id = Column(String(50), nullable=False)
    tracker_id = Column(String(50), unique=True, index=True)      # RFID ID
    risk_level = Column(String(20), default="LOW")
    risk_score = Column(Integer, default=0)
    status = Column(String(20), default="ACTIVE")                 # ACTIVE, BREAK, OFFLINE
    helmet = Column(Boolean, default=True)
    vest = Column(Boolean, default=True)
    gloves = Column(Boolean, default=True)
    shoes = Column(Boolean, default=True)
    mask = Column(Boolean, default=True)
    goggles = Column(Boolean, default=True)
    violations = Column(Text, default="[]")                       # JSON array string
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class IncidentDB(Base):
    __tablename__ = "incidents"

    incident_id = Column(String(100), primary_key=True, index=True)
    camera_id = Column(String(50), nullable=False, index=True)
    zone_id = Column(String(50), nullable=True, index=True)
    worker_id = Column(String(50), nullable=True)
    track_id = Column(String(50), nullable=True)
    violation = Column(String(150), nullable=False)               # Missing Helmet, Worker Fall, etc.
    severity = Column(String(20), default="HIGH")                 # LOW, MEDIUM, HIGH, CRITICAL
    confidence = Column(Float, default=0.90)
    frame_number = Column(Integer, default=0)
    status = Column(String(20), default="OPEN", index=True)       # OPEN, ACKNOWLEDGED, RESOLVED
    timestamp = Column(String(50), nullable=False)
    evidence_image = Column(Text, nullable=True)                  # Base64 or image path
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
