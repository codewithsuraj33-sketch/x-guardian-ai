# ─────────────────────────────────────────────
# X-Guardian — Database Service & CRUD Layer
# ─────────────────────────────────────────────

from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from app.database import engine, Base, SessionLocal
from app.models.db_models import ZoneDB, CameraDB, WorkerDB, IncidentDB


def init_db():
    """Create all database tables and seed initial records if empty."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # 1. Seed Zones
        if db.query(ZoneDB).count() == 0:
            initial_zones = [
                ZoneDB(
                    id="ZONE-01",
                    name="Entry",
                    camera_id="CAM-01",
                    safety_status="LOW",
                    worker_count=1,
                    description="Main entry point and check-in area for all factory personnel.",
                    color="#3b82f6",
                    is_restricted=False,
                ),
                ZoneDB(
                    id="ZONE-02",
                    name="Assembly",
                    camera_id="CAM-02",
                    safety_status="LOW",
                    worker_count=2,
                    description="Primary assembly line for component manufacturing and quality control.",
                    color="#10b981",
                    is_restricted=False,
                ),
                ZoneDB(
                    id="ZONE-03",
                    name="Welding",
                    camera_id="CAM-03",
                    safety_status="MEDIUM",
                    worker_count=1,
                    description="High-temperature welding operations. Full PPE required at all times.",
                    color="#f59e0b",
                    is_restricted=False,
                ),
                ZoneDB(
                    id="ZONE-04",
                    name="Storage",
                    camera_id="CAM-04",
                    safety_status="LOW",
                    worker_count=1,
                    description="Raw materials and finished goods storage area.",
                    color="#8b5cf6",
                    is_restricted=False,
                ),
                ZoneDB(
                    id="ZONE-05",
                    name="Restricted Zone",
                    camera_id="CAM-05",
                    safety_status="HIGH",
                    worker_count=0,
                    description="Authorized personnel only. High-risk operations and hazardous materials.",
                    color="#ef4444",
                    is_restricted=True,
                ),
            ]
            db.add_all(initial_zones)
            db.commit()

        # 2. Seed Cameras
        if db.query(CameraDB).count() == 0:
            initial_cameras = [
                CameraDB(
                    camera_id="CAM-01",
                    zone_id="ZONE-01",
                    name="Main Entrance & Turnstiles",
                    feed_url="/images/cam01_entry.jpg",
                    resolution="1920x1080",
                    fps=30,
                    status="ONLINE",
                ),
                CameraDB(
                    camera_id="CAM-02",
                    zone_id="ZONE-02",
                    name="Assembly Line Alpha",
                    feed_url="/images/cam02_assembly.jpg",
                    resolution="1920x1080",
                    fps=30,
                    status="ONLINE",
                ),
                CameraDB(
                    camera_id="CAM-03",
                    zone_id="ZONE-03",
                    name="High-Temp Welding Bay",
                    feed_url="/images/cam03_welding.jpg",
                    resolution="1920x1080",
                    fps=30,
                    status="ONLINE",
                ),
                CameraDB(
                    camera_id="CAM-04",
                    zone_id="ZONE-04",
                    name="Logistics & High Storage Racks",
                    feed_url="/images/cam04_storage.jpg",
                    resolution="1920x1080",
                    fps=30,
                    status="ONLINE",
                ),
                CameraDB(
                    camera_id="CAM-05",
                    zone_id="ZONE-05",
                    name="Restricted Chemical Sector",
                    feed_url="/images/cam05_restricted.jpg",
                    resolution="1920x1080",
                    fps=30,
                    status="ONLINE",
                ),
            ]
            db.add_all(initial_cameras)
            db.commit()

        # 3. Seed Workers
        if db.query(WorkerDB).count() == 0:
            initial_workers = [
                WorkerDB(
                    id="W-1001",
                    name="Marcus Vance",
                    zone_id="ZONE-01",
                    tracker_id="RFID-8821",
                    risk_level="LOW",
                    risk_score=0,
                    status="ACTIVE",
                    helmet=True,
                    vest=True,
                    gloves=True,
                    shoes=True,
                    mask=True,
                    goggles=True,
                    violations="[]",
                ),
                WorkerDB(
                    id="W-1002",
                    name="Elena Rostova",
                    zone_id="ZONE-02",
                    tracker_id="RFID-8822",
                    risk_level="LOW",
                    risk_score=0,
                    status="ACTIVE",
                    helmet=True,
                    vest=True,
                    gloves=True,
                    shoes=True,
                    mask=True,
                    goggles=True,
                    violations="[]",
                ),
                WorkerDB(
                    id="W-1003",
                    name="Devon Chen",
                    zone_id="ZONE-03",
                    tracker_id="RFID-8823",
                    risk_level="MEDIUM",
                    risk_score=20,
                    status="ACTIVE",
                    helmet=True,
                    vest=True,
                    gloves=False,
                    shoes=True,
                    mask=True,
                    goggles=False,
                    violations='["Missing Gloves", "Missing Safety Goggles"]',
                ),
                WorkerDB(
                    id="W-1004",
                    name="Priya Sharma",
                    zone_id="ZONE-04",
                    tracker_id="RFID-8824",
                    risk_level="LOW",
                    risk_score=0,
                    status="ACTIVE",
                    helmet=True,
                    vest=True,
                    gloves=True,
                    shoes=True,
                    mask=True,
                    goggles=True,
                    violations="[]",
                ),
                WorkerDB(
                    id="W-1005",
                    name="Tariq Al-Mansoor",
                    zone_id="ZONE-02",
                    tracker_id="RFID-8825",
                    risk_level="LOW",
                    risk_score=0,
                    status="ACTIVE",
                    helmet=True,
                    vest=True,
                    gloves=True,
                    shoes=True,
                    mask=True,
                    goggles=True,
                    violations="[]",
                ),
            ]
            db.add_all(initial_workers)
            db.commit()

        # 4. Seed Initial Sample Incidents if none exist
        if db.query(IncidentDB).count() == 0:
            now_iso = datetime.now(timezone.utc).isoformat()
            sample_incidents = [
                IncidentDB(
                    incident_id="INC-INIT-001",
                    camera_id="CAM-03",
                    zone_id="ZONE-03",
                    worker_id="W-1003",
                    track_id="TRK-8823",
                    violation="Missing Gloves in Welding Bay",
                    severity="MEDIUM",
                    confidence=0.88,
                    frame_number=142,
                    status="OPEN",
                    timestamp=now_iso,
                    evidence_image=None,
                ),
            ]
            db.add_all(sample_incidents)
            db.commit()

    finally:
        db.close()


def save_incident(
    db: Session,
    incident_id: str,
    camera_id: str,
    violation: str,
    severity: str = "HIGH",
    worker_id: Optional[str] = None,
    track_id: Optional[str] = None,
    zone_id: Optional[str] = None,
    confidence: float = 0.90,
    frame_number: int = 0,
    status: str = "OPEN",
    timestamp: Optional[str] = None,
    evidence_image: Optional[str] = None,
) -> IncidentDB:
    """Save an incident to SQLite, updating if existing."""
    if not timestamp:
        timestamp = datetime.now(timezone.utc).isoformat()

    existing = db.query(IncidentDB).filter(IncidentDB.incident_id == incident_id).first()
    if existing:
        existing.status = status
        existing.confidence = max(existing.confidence or 0.0, confidence)
        if evidence_image and not existing.evidence_image:
            existing.evidence_image = evidence_image
        db.commit()
        db.refresh(existing)
        return existing

    record = IncidentDB(
        incident_id=incident_id,
        camera_id=camera_id,
        zone_id=zone_id or "ZONE-01",
        worker_id=worker_id,
        track_id=track_id,
        violation=violation,
        severity=severity,
        confidence=confidence,
        frame_number=frame_number,
        status=status,
        timestamp=timestamp,
        evidence_image=evidence_image,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_incidents(
    db: Session,
    limit: int = 100,
    status: Optional[str] = None,
    camera_id: Optional[str] = None,
) -> List[IncidentDB]:
    """Retrieve incidents with optional status or camera filters."""
    query = db.query(IncidentDB)
    if status:
        query = query.filter(IncidentDB.status == status)
    if camera_id:
        query = query.filter(IncidentDB.camera_id == camera_id)
    return query.order_by(IncidentDB.created_at.desc()).limit(limit).all()


def update_incident_status(db: Session, incident_id: str, next_status: str) -> Optional[IncidentDB]:
    """Update incident status (OPEN -> ACKNOWLEDGED -> RESOLVED)."""
    incident = db.query(IncidentDB).filter(IncidentDB.incident_id == incident_id).first()
    if incident:
        incident.status = next_status
        db.commit()
        db.refresh(incident)
    return incident


def get_all_cameras(db: Session) -> List[CameraDB]:
    return db.query(CameraDB).all()


def add_or_update_camera(
    db: Session,
    camera_id: str,
    name: str,
    zone_id: str = "ZONE-01",
    feed_url: Optional[str] = None,
    stream_url: Optional[str] = None,
    resolution: str = "1920x1080",
    fps: int = 15,
) -> CameraDB:
    existing = db.query(CameraDB).filter(CameraDB.camera_id == camera_id).first()
    if existing:
        existing.name = name
        existing.zone_id = zone_id
        if feed_url:
            existing.feed_url = feed_url
        if stream_url:
            existing.stream_url = stream_url
        existing.resolution = resolution
        existing.fps = fps
        existing.status = "ONLINE"
        db.commit()
        db.refresh(existing)
        return existing

    cam = CameraDB(
        camera_id=camera_id,
        name=name,
        zone_id=zone_id,
        feed_url=feed_url,
        stream_url=stream_url,
        resolution=resolution,
        fps=fps,
        status="ONLINE",
    )
    db.add(cam)
    db.commit()
    db.refresh(cam)
    return cam


def delete_camera_db(db: Session, camera_id: str) -> bool:
    cam = db.query(CameraDB).filter(CameraDB.camera_id == camera_id).first()
    if cam:
        db.delete(cam)
        db.commit()
        return True
    return False


def get_all_workers(db: Session) -> List[WorkerDB]:
    return db.query(WorkerDB).all()


def get_all_zones(db: Session) -> List[ZoneDB]:
    return db.query(ZoneDB).all()


def get_analytics_summary(db: Session) -> Dict[str, Any]:
    """Calculate aggregated safety statistics directly from the database."""
    total_incidents = db.query(IncidentDB).count()
    open_incidents = db.query(IncidentDB).filter(IncidentDB.status == "OPEN").count()
    ack_incidents = db.query(IncidentDB).filter(IncidentDB.status == "ACKNOWLEDGED").count()
    resolved_incidents = db.query(IncidentDB).filter(IncidentDB.status == "RESOLVED").count()
    total_workers = db.query(WorkerDB).count()
    safe_workers = db.query(WorkerDB).filter(WorkerDB.risk_score == 0).count()
    active_cameras = db.query(CameraDB).filter(CameraDB.status == "ONLINE").count()

    compliance_rate = round((safe_workers / max(1, total_workers)) * 100, 1)

    return {
        "totalIncidents": total_incidents,
        "openIncidents": open_incidents,
        "acknowledgedIncidents": ack_incidents,
        "resolvedIncidents": resolved_incidents,
        "totalWorkers": total_workers,
        "safeWorkers": safe_workers,
        "activeCameras": active_cameras,
        "complianceRate": compliance_rate,
        "databaseType": "SQLite (xguardian.db)",
    }
